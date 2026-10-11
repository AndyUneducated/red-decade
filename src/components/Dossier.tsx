import type { ScaleLinear } from 'd3'
import { useRef } from 'react'
import { DEATH_KINDS, type Person } from '../data/schema'
import { fmtDate, fmtT, toT } from '../lib/dates'
import { heldAt, SYSTEMS, systemOf, type Sys } from '../lib/positions'
import { useSize } from '../lib/useSize'
import { useApp } from '../state'
import { LifeStrip } from './LifeStrip'

// ── 职务时间带: the life strip plus one swimlane per system, on one time axis ──

const SYS_COLOR: Record<Sys, string> = { party: '#9e1b32', gov: '#2f5d8a', army: '#4d6b35', other: '#7a7468' }
const ROW = 12
const ROW_GAP = 2
const LANE_GAP = 7
const STRIP_H = 14

type Bar = { a: number; b: number; row: number; pos: Person['positions'][number] }

function lanes(p: Person, lo: number, hi: number) {
  const by = new Map<Sys, Bar[]>()
  const sorted = [...p.positions].sort((u, v) => toT(u.from ?? '0') - toT(v.from ?? '0'))
  for (const pos of sorted) {
    const a = pos.from ? toT(pos.from) : lo
    const b = pos.to ? toT(pos.to, true) : p.died ? toT(p.died, true) : hi
    const sys = systemOf(pos)
    if (!by.has(sys)) by.set(sys, [])
    by.get(sys)!.push({ a, b: Math.max(b, a + 0.1), row: 0, pos })
  }
  return (Object.keys(SYSTEMS) as Sys[])
    .filter((s) => by.has(s))
    .map((sys) => {
      const ends: number[] = []
      for (const bar of by.get(sys)!) {
        let r = ends.findIndex((e) => e <= bar.a + 0.01)
        if (r < 0) r = ends.length
        ends[r] = bar.b
        bar.row = r
      }
      return { sys, bars: by.get(sys)!, rows: ends.length }
    })
}

export function ProfileTimeline({ p, x, width, end, ticks }: { p: Person; x: ScaleLinear<number, number>; width: number; end: number; ticks: number[] }) {
  const { t, setT } = useApp()
  const [lo, hi] = x.domain()
  const ls = lanes(p, lo, hi)
  let y = 0
  const placed = ls.map((l) => {
    const top = y
    y += l.rows * (ROW + ROW_GAP) - ROW_GAP + LANE_GAP
    return { ...l, top }
  })
  const bandH = Math.max(0, y - LANE_GAP)
  const inRange = t >= lo && t <= hi
  const held = p.positions.filter((pos) => heldAt(pos, t))
  const pick = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    setT(Math.min(hi, Math.max(lo, x.invert(e.clientX - r.left))))
  }

  return (
    <div className="ptl">
      <div className="ptl-plot" style={{ width }} onClick={pick} title="点击移动当前时刻">
        <LifeStrip p={p} x={x} T1={end} width={width} height={STRIP_H} ticks={ticks} mark={1966} />
        {bandH > 0 && (
          <svg width={width} height={bandH} style={{ display: 'block', overflow: 'visible', marginTop: 8 }}>
            {ticks.map((yr) => (
              <line key={yr} x1={x(yr)} x2={x(yr)} y1={-4} y2={bandH} stroke="var(--rule)" />
            ))}
            {placed.map((l) => (
              <g key={l.sys} transform={`translate(0,${l.top})`}>
                <text x={-8} y={(l.rows * (ROW + ROW_GAP) - ROW_GAP) / 2 + 4} textAnchor="end" fontSize={11} fill={SYS_COLOR[l.sys]}>
                  {SYSTEMS[l.sys]}
                </text>
                {l.bars.map((bar, i) => {
                  const x0 = x(bar.a)
                  const w = Math.max(2, x(bar.b) - x0)
                  const on = heldAt(bar.pos, t)
                  const head = bar.pos.title.split('、')[0]
                  const fit = Math.floor((w - 6) / 10.5)
                  const label = head.length <= fit ? head : fit >= 4 ? head.slice(0, fit - 1) + '…' : ''
                  return (
                    <g key={i} transform={`translate(${x0},${bar.row * (ROW + ROW_GAP)})`}>
                      <rect
                        width={w}
                        height={ROW}
                        rx={2}
                        fill={SYS_COLOR[l.sys]}
                        fillOpacity={on ? 1 : 0.2}
                        stroke={SYS_COLOR[l.sys]}
                        strokeOpacity={on ? 1 : 0.45}
                        strokeDasharray={bar.pos.verify ? '3 2' : undefined}
                      >
                        <title>
                          {bar.pos.title}
                          {bar.pos.orgName && !bar.pos.title.includes(bar.pos.orgName) ? `（${bar.pos.orgName}）` : ''}
                          {` · ${bar.pos.from ? fmtDate(bar.pos.from) : '?'}–${bar.pos.to ? fmtDate(bar.pos.to) : ''}`}
                          {bar.pos.verify ? ' · 待核' : ''}
                        </title>
                      </rect>
                      {label && (
                        <text x={4} y={ROW - 2.5} fontSize={10} fill={on ? '#fff' : SYS_COLOR[l.sys]} pointerEvents="none">
                          {label}
                        </text>
                      )}
                    </g>
                  )
                })}
              </g>
            ))}
          </svg>
        )}
        {inRange && <div className="ptl-now" style={{ left: x(t) }} />}
      </div>
      <p className="ptl-cap">
        <b>{fmtT(t, 'month')}</b>
        {!inRange
          ? ' 在此人生平之外'
          : held.length
            ? `在任：${held.map((h) => h.title.split('、')[0]).join('、')}`
            : ' 无在任职务记录'}
        <span>
          · 点击色带或职务带移动时刻 · {(Object.keys(SYSTEMS) as Sys[]).filter((s) => ls.some((l) => l.sys === s)).map((s) => SYSTEMS[s]).join(' / ')}分道，虚线框为待核
        </span>
      </p>
    </div>
  )
}

// ── 身份证式档案卡: six fixed slots, same glyph vocabulary for everyone ──

const LABOUR = /贫农|佃农|雇农|贫苦|工人|苦力/
const PROPERTIED = /地主|富农|资本家|官僚|买办/

function classTier(c?: string): 0 | 1 | 2 | undefined {
  if (!c) return undefined
  if (PROPERTIED.test(c)) return 2
  if (LABOUR.test(c)) return 0
  return 1
}

function Glyph({ kind, p }: { kind: string; p: Person }) {
  const ink = 'var(--ink)'
  const off = 'var(--rule-2)'
  switch (kind) {
    case 'gender':
      if (!p.gender) return <circle cx={13} cy={13} r={6} fill="none" stroke={off} strokeDasharray="2 2" />
      return p.gender === 'm' ? (
        <g fill="none" stroke={ink} strokeWidth={1.6}>
          <circle cx={11} cy={15} r={6} />
          <path d="M15.5 10.5 L21 5 M16 5 H21 V10" />
        </g>
      ) : (
        <g fill="none" stroke="var(--accent)" strokeWidth={1.6}>
          <circle cx={13} cy={10} r={6} />
          <path d="M13 16 V24 M9.5 20.5 H16.5" />
        </g>
      )
    case 'eth': {
      const ch = p.ethnicity?.[0]
      return (
        <g>
          <rect x={4} y={4} width={18} height={18} rx={2} fill="none" stroke={ch ? (ch === '汉' ? ink : 'var(--accent)') : off} strokeWidth={1.4} strokeDasharray={ch ? undefined : '2 2'} />
          {ch && (
            <text x={13} y={17.5} textAnchor="middle" fontSize={12} fill={ch === '汉' ? ink : 'var(--accent)'}>
              {ch}
            </text>
          )}
        </g>
      )
    }
    case 'class': {
      const tier = classTier(p.classOrigin)
      const d = 'M4 12 L13 4 L22 12 V22 H4 Z'
      if (tier === undefined) return <path d={d} fill="none" stroke={off} strokeDasharray="2 2" />
      return (
        <g>
          <clipPath id="cls-clip">
            <path d={d} />
          </clipPath>
          <path d={d} fill="none" stroke={ink} strokeWidth={1.4} />
          {tier > 0 && <rect x={0} y={tier === 2 ? 0 : 13} width={26} height={26} fill={ink} clipPath="url(#cls-clip)" />}
        </g>
      )
    }
    case 'rank': {
      const r = p.rank?.rank ?? ''
      const star = (cx: number, cy: number, s: number, fill: string) => {
        const pts = Array.from({ length: 10 }, (_, i) => {
          const a = (Math.PI / 5) * i - Math.PI / 2
          const rr = i % 2 ? s * 0.42 : s
          return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`
        }).join(' ')
        return <polygon key={`${cx}-${cy}`} points={pts} fill={fill} />
      }
      if (!r) return <g opacity={0.6}>{star(13, 13.5, 8, off)}</g>
      if (r.includes('元帅')) return star(13, 13.5, 10, 'var(--accent)')
      const n = r.includes('大将') ? 4 : r.includes('上将') ? 3 : r.includes('中将') ? 2 : r.includes('少将') ? 1 : 0
      if (!n) return star(13, 13.5, 7, ink)
      const xs = Array.from({ length: n }, (_, i) => 13 + (i - (n - 1) / 2) * 6.2)
      return <g>{xs.map((cx) => star(cx, 13.5, 3.6, ink))}</g>
    }
    case 'fate': {
      const k = p.deathKind
      if (!p.died) return <circle cx={13} cy={13} r={7} fill="none" stroke={off} strokeDasharray="2 2" />
      if (!k || k === 'unknown')
        return (
          <g>
            <circle cx={13} cy={13} r={8} fill="none" stroke={ink} strokeWidth={1.4} />
            <text x={13} y={17} textAnchor="middle" fontSize={11} fill={ink}>
              ?
            </text>
          </g>
        )
      if (k === 'natural') return <circle cx={13} cy={13} r={8} fill="none" stroke={ink} strokeWidth={1.6} />
      if (k === 'accident' || k === 'war') return <path d="M13 4 L22 21 H4 Z" fill="none" stroke={ink} strokeWidth={1.6} />
      if (k === 'executed') return <rect x={5} y={5} width={16} height={16} fill="var(--s-dead)" />
      const mark = { suicide: 'M13 8 V18', persecuted: 'M9 9 L17 17 M17 9 L9 17', killed: 'M9 9 L17 17' }[k]
      return (
        <g>
          <circle cx={13} cy={13} r={9} fill="var(--s-dead)" />
          <path d={mark} stroke="#fff" strokeWidth={2} strokeLinecap="round" />
        </g>
      )
    }
    case 'rehab': {
      const posthumous = p.died && p.rehab.some((r) => toT(r.date) > toT(p.died!))
      if (!p.rehab.length) return <circle cx={13} cy={13} r={8} fill="none" stroke={off} strokeDasharray="2 2" />
      return (
        <g fill="none" stroke="var(--s-restored)" strokeWidth={1.8}>
          <circle cx={13} cy={13} r={9} strokeDasharray={posthumous ? '3 2' : undefined} />
          <path d="M8.5 13.5 L12 17 L18 9.5" />
        </g>
      )
    }
  }
  return null
}

function ageAt(p: Person, date?: string) {
  if (!p.born || !date) return undefined
  return Math.floor(toT(date) - toT(p.born) + 1e-6)
}

export function IdCard({ p }: { p: Person }) {
  const rank = p.rank?.rank.replace(/^(中华人民共和国|中国人民解放军)/, '')
  const died = ageAt(p, p.died)
  const posthumous = p.died && p.rehab.some((r) => toT(r.date) > toT(p.died!))
  const slots: { k: string; label: string; value?: string; tip?: string }[] = [
    { k: 'gender', label: '性别', value: p.gender && (p.gender === 'f' ? '女' : '男') },
    { k: 'eth', label: '民族', value: p.ethnicity },
    {
      k: 'class',
      label: '家庭出身',
      value: p.classOrigin?.replace(/（.*）$/, ''),
      tip: p.classOrigin ? `${p.classOrigin}。图形按成分粗分三档：空心为劳动者，半填为中间阶层，全填为有产者` : undefined,
    },
    { k: 'rank', label: '军衔', value: rank ? `${rank}（${p.rank!.date.slice(0, 4)}）` : p.rank ? undefined : '无' },
    {
      k: 'fate',
      label: died !== undefined ? `结局 · ${died}岁` : '结局',
      value: p.died ? `${p.deathKind ? DEATH_KINDS[p.deathKind] : '死因未录'}${p.deathContested ? '？' : ''}` : '无卒年记录',
    },
    { k: 'rehab', label: '平反', value: p.rehab.length ? `${posthumous ? '身后' : '生前'} · ${p.rehab[0].date.slice(0, 4)}` : '无记录' },
  ]
  return (
    <div className="idcard">
      {slots.map((s) => (
        <div key={s.k} className="idcell" title={s.tip ?? (s.value ? `${s.label}：${s.value}` : `${s.label}未录`)} data-empty={!s.value || undefined}>
          <svg width={26} height={26} viewBox="0 0 26 26">
            <Glyph kind={s.k} p={p} />
          </svg>
          <span>
            <small>{s.label}</small>
            {s.value ?? '未录'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── 年龄标尺: milestones placed by age on one fixed 0–100 ruler ──

const MAX_AGE = 100

export function AgeRuler({ p }: { p: Person }) {
  const { t } = useApp()
  const ref = useRef<HTMLDivElement>(null)
  const { width } = useSize(ref)
  if (!p.born) return <p className="muted-note">生年未录，无法按年龄标注。</p>
  const born = toT(p.born)
  const firstFate = (s: string, after = -Infinity) => p.fate.find((f) => f.s === s && toT(f.date) >= after)
  const detained = firstFate('detained')
  const purged = firstFate('purged')
  const restored = purged || detained ? firstFate('restored', toT((purged ?? detained)!.date)) : undefined
  const marks: { date: string; label: string; tone: 'ink' | 'accent' | 'dead' | 'restored' | 'muted' }[] = []
  if (p.joinedRevolution) marks.push({ date: p.joinedRevolution, label: '参加革命', tone: 'ink' })
  if (p.joinedParty) marks.push({ date: p.joinedParty, label: '入党', tone: 'ink' })
  if (!p.died || toT(p.died) > 1966.37) marks.push({ date: '1966-05-16', label: '1966', tone: 'accent' })
  if (purged) marks.push({ date: purged.date, label: '首次被打倒', tone: 'muted' })
  if (detained) marks.push({ date: detained.date, label: '首次被关押', tone: 'dead' })
  if (restored && (!p.died || toT(restored.date) < toT(p.died))) marks.push({ date: restored.date, label: '复出', tone: 'restored' })
  if (p.died) marks.push({ date: p.died, label: '去世', tone: 'dead' })
  const rehab = p.rehab[0]
  if (rehab && p.died && toT(rehab.date) > toT(p.died)) marks.push({ date: rehab.date, label: '身后平反', tone: 'restored' })

  const W = Math.max(200, width)
  const pad = 8
  const ax = (age: number) => pad + (age / MAX_AGE) * (W - pad * 2)
  const items = marks
    .map((m) => ({ ...m, age: toT(m.date) - born }))
    .filter((m) => m.age >= 0 && m.age <= MAX_AGE)
    .sort((a, b) => a.age - b.age)
  // greedy rows so labels never overlap
  const rowEnds: number[] = []
  const placed = items.map((m) => {
    const text = `${m.label} ${Math.floor(m.age + 1e-6)}岁`
    const w = text.length * 11 - 6
    const left = Math.min(W - w, Math.max(0, ax(m.age) - w / 2))
    let row = rowEnds.findIndex((e) => e + 6 <= left)
    if (row < 0) row = rowEnds.length
    rowEnds[row] = left + w
    return { ...m, text, left, w, row }
  })
  const lifeEnd = p.died ? toT(p.died) - born : Math.min(MAX_AGE, 2026 - born)
  const nowAge = t - born
  const base = 20
  const H = base + 14 + rowEnds.length * 16
  const color = { ink: 'var(--ink)', accent: 'var(--accent)', dead: 'var(--s-dead)', restored: 'var(--s-restored)', muted: 'var(--s-purged)' }

  return (
    <div ref={ref} className="ageruler">
      {width > 0 && (
        <svg width={W} height={H} style={{ display: 'block' }}>
          <rect x={ax(0)} y={base - 5} width={ax(lifeEnd) - ax(0)} height={5} fill="var(--s-normal)" />
          {lifeEnd > 0 && !p.died && <rect x={ax(lifeEnd) - 1} y={base - 5} width={1} height={5} fill="var(--rule-2)" />}
          <line x1={ax(0)} x2={ax(MAX_AGE)} y1={base} y2={base} stroke="var(--ink-2)" />
          {Array.from({ length: MAX_AGE / 5 + 1 }, (_, i) => i * 5).map((a) => (
            <g key={a}>
              <line x1={ax(a)} x2={ax(a)} y1={base} y2={base + (a % 10 ? 3 : 5)} stroke="var(--ink-2)" />
              {a % 20 === 0 && (
                <text x={ax(a)} y={9} textAnchor="middle" fontSize={9.5} fill="var(--muted)">
                  {a}
                </text>
              )}
            </g>
          ))}
          {nowAge >= 0 && nowAge <= lifeEnd && (
            <path d={`M${ax(nowAge)} ${base - 6} l-3.5 -5 h7 Z`} fill="var(--accent)">
              <title>{`当前时刻 ${fmtT(t, 'month')}：${Math.floor(nowAge)} 岁`}</title>
            </path>
          )}
          {placed.map((m, i) => {
            const y = base + 14 + m.row * 16
            const x0 = ax(m.age)
            return (
              <g key={i}>
                <line x1={x0} x2={x0} y1={base - 4} y2={y - 9} stroke={color[m.tone]} strokeWidth={m.tone === 'accent' ? 1.4 : 1} strokeDasharray={m.label === '身后平反' ? '2 2' : undefined} />
                <circle cx={x0} cy={base} r={2.6} fill={m.label === '身后平反' ? '#fff' : color[m.tone]} stroke={color[m.tone]} />
                <text x={m.left} y={y} fontSize={11} fill={color[m.tone]}>
                  <title>{`${m.label}：${fmtDate(m.date)}，${Math.floor(m.age + 1e-6)} 周岁`}</title>
                  {m.text}
                </text>
              </g>
            )
          })}
        </svg>
      )}
      <p className="muted-note">按周岁计，人人同一把 0–100 岁的尺；红三角为当前时刻的年龄。</p>
    </div>
  )
}
