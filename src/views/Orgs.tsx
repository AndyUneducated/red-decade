import { SubNav } from '../components/SubNav'
import * as d3 from 'd3'
import type { ScaleLinear } from 'd3'
import { useMemo, useRef, type ReactNode } from 'react'
import { Cite, Entity, Verify } from '../components/bits'
import { EventList } from '../components/Drawer'
import { LONG_MARKS, Scrubber } from '../components/Scrubber'
import type { Tenure } from '../data/atlas'
import { ORG_KINDS, ORG_LEVELS, type Org, type OrgKind, type OrgLink, type Person } from '../data/schema'
import { fmtDate, fmtRange, fmtT, toT } from '../lib/dates'
import { existsAt, isHead, KIND_ORDER, LEVEL_ORDER, parentAt, placeAt, segments, suspendedAt, within } from '../lib/orgs'
import { CONTROL_FROM, CONTROL_TO, controlAt, controlRuns, type Run } from '../lib/control'
import { heldAt } from '../lib/positions'
import { useSize } from '../lib/useSize'
import { useApp, useHistoryState } from '../state'

const T0 = 1920
const T1 = 1990
const TICKS = [1921, 1937, 1949, 1966, 1976, 1989]

export const orgColor = (k: OrgKind) => `var(--org-${k})`

const when = (s: { from?: string; to?: string }) =>
  s.from && s.to ? fmtRange(s.from, s.to) : s.from ? `${fmtDate(s.from)}起` : s.to ? `至${fmtDate(s.to)}` : ''

// a dated link read from either end: [before the other org's name, after it]
const OUT: Record<OrgLink, [string, string]> = {
  lead: ['领导', ''],
  found: ['设立', ''],
  oppose: ['与', '对立'],
  merge: ['并入', ''],
  takeover: ['夺权 / 接管', ''],
  replace: ['取代', ''],
}
const IN: Record<OrgLink, [string, string]> = {
  lead: ['受', '领导'],
  found: ['由', '设立'],
  oppose: ['与', '对立'],
  merge: ['', '并入本机构'],
  takeover: ['被', '夺权 / 接管'],
  replace: ['被', '取代'],
}

export function Orgs() {
  const { doc } = useApp()
  return doc ? <OrgPage key={doc} id={doc} /> : <Directory />
}

function OrgLinkBtn({ id }: { id: string }) {
  const { ix, openOrg } = useApp()
  const o = ix.org.get(id)
  if (!o) return null
  return (
    <button className="linklike orglink" title={o.name} onClick={() => openOrg(id)}>
      {o.short ?? o.name}
    </button>
  )
}

const order = (a: Org, b: Org) =>
  LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) ||
  KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
  (a.from ?? '0').localeCompare(b.from ?? '0')

// The hierarchy as it stood at t. Orgs whose parent is filtered out become roots; roots are grouped by kind.
function tree(list: Org[], t: number) {
  const ids = new Set(list.map((o) => o.id))
  const kids = new Map<string, Org[]>()
  const roots: Org[] = []
  for (const o of list) {
    const p = parentAt(o, t)
    if (p && ids.has(p)) kids.set(p, [...(kids.get(p) ?? []), o])
    else roots.push(o)
  }
  const seen = new Set<string>()
  const walk = (o: Org, depth: number, out: { o: Org; depth: number }[]) => {
    if (seen.has(o.id)) return
    seen.add(o.id)
    out.push({ o, depth })
    for (const c of (kids.get(o.id) ?? []).sort(order)) walk(c, depth + 1, out)
  }
  return KIND_ORDER.map((kind) => {
    const rows: { o: Org; depth: number }[] = []
    roots
      .filter((o) => o.kind === kind)
      .sort(order)
      .forEach((o) => walk(o, 0, rows))
    return { kind, rows }
  }).filter((g) => g.rows.length)
}

function OrgBar({ o, x, width, t, height = 10, runs }: { o: Org; x: ScaleLinear<number, number>; width: number; t: number; height?: number; runs?: Run[] }) {
  const { ix } = useApp()
  const [lo, hi] = x.domain()
  const a = o.from ? toT(o.from) : lo
  const b = o.to ? toT(o.to, true) : hi
  const c = runs ? 'var(--muted)' : orgColor(o.kind)
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <rect x={x(a)} width={Math.max(2, x(b) - x(a))} height={height} rx={2} fill={c} fillOpacity={runs ? 0.22 : 0.8} />
      {runs?.map((r, i) => (
        <rect key={i} x={x(r.a)} width={Math.max(1, x(r.b) - x(r.a))} height={height} fill={ix.faction.get(r.f)?.color} fillOpacity={r.by ? 0.9 : 0.55} />
      ))}
      {!o.from && <rect x={x(lo)} width={Math.min(14, x(b) - x(lo))} height={height} fill="url(#org-fade)" />}
      {o.suspended.map((s, i) => {
        const sa = Math.max(a, toT(s.from))
        const sb = Math.min(b, s.to ? toT(s.to, true) : b)
        return <rect key={i} x={x(sa)} width={Math.max(1, x(sb) - x(sa))} y={1.5} height={height - 3} fill="var(--paper)" stroke={c} strokeDasharray="2 2" />
      })}
      {t >= lo && t <= hi && <line x1={x(t)} x2={x(t)} y1={-3} y2={height + 3} stroke="var(--accent)" strokeWidth={1.2} />}
    </svg>
  )
}

function Directory() {
  const { ix, openOrg, t } = useApp()
  const wrap = useRef<HTMLDivElement>(null)
  const { width } = useSize(wrap)
  const [kind, setKind] = useHistoryState<OrgKind | 'all'>('orgs.kind', 'all')
  const [now, setNow] = useHistoryState('orgs.now', true)
  const [q, setQ] = useHistoryState('orgs.q', '')
  const [byFaction, setByFaction] = useHistoryState('orgs.byFaction', false)
  const [fac, setFac] = useHistoryState<string | undefined>('orgs.fac', undefined)

  const narrow = width > 0 && width < 760
  const phone = width > 0 && width < 480
  const nameW = phone ? 148 : narrow ? 190 : 320
  const countW = narrow ? 56 : 88
  const stripW = Math.max(phone ? 80 : 160, width - nameW - countW - (phone ? 56 : 84))
  const ticks = phone ? [1921, 1949, 1989] : TICKS
  const indent = phone ? 10 : 16
  const x = useMemo(() => d3.scaleLinear().domain([T0, T1]).range([0, stripW]).clamp(true), [stripW])

  const control = useMemo(() => (byFaction ? new Map(ix.orgs.map((o) => [o.id, controlAt(ix, o, t)])) : undefined), [ix, t, byFaction])
  const heldBy = control && d3.rollup([...control.values()].filter((c) => !!c), (v) => v.length, (c) => c!.f)
  const facOn = byFaction && fac && heldBy?.has(fac) ? fac : undefined
  const list = ix.orgs.filter(
    (o) =>
      (kind === 'all' || o.kind === kind) &&
      (!now || existsAt(o, t)) &&
      (!q || [o.name, o.short ?? '', ...o.aliases].some((s) => s.includes(q))) &&
      (!facOn || control!.get(o.id)?.f === facOn),
  )
  const groups = tree(list, t)
  const alive = ix.orgs.filter((o) => existsAt(o, t)).length
  const inWindow = t >= CONTROL_FROM && t < CONTROL_TO

  return (
    <div className="view">
      <div className="viewhead">
        <div>
          <SubNav />
          <h1>机构</h1>
          <p>
            党、政、军、群团、群众组织与单位共 {ix.orgs.length} 个，{fmtT(t, 'month')}存在的有 {alive} 个。缩进是此刻的隶属关系，随时间轴改变，下属机构跟随上级排列（如军队在中央军委之下）；色条是存续期（{T0}–{T1}），虚线框为停止活动。右侧是此刻的负责人；没有负责人名单的机构显示库中在此任职的人数（此刻在任 / 总数）。
          </p>
        </div>
        <div className="spacer" />
        <div className="legend">
          <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="筛选机构名…" />
          <button className="chip" aria-pressed={now} onClick={() => setNow((v) => !v)}>
            只看此刻存在
          </button>
          <button className="chip" aria-pressed={kind === 'all'} onClick={() => setKind('all')}>
            全部
          </button>
          {KIND_ORDER.map((k) => (
            <button key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(kind === k ? 'all' : k)}>
              <i style={{ background: orgColor(k) }} />
              {ORG_KINDS[k]}
            </button>
          ))}
          <button className="chip" aria-pressed={byFaction} onClick={() => setByFaction((v) => !v)} title="色条改为按负责人所属派系着色">
            按派系着色
          </button>
        </div>
      </div>
      <Scrubber min={T0} max={T1} marks={LONG_MARKS} />
      {byFaction && (
        <div className="control-bar">
          {inWindow ? (
            <>
              <span className="muted-note">{fmtT(t, 'month')}掌握的机构：</span>
              {ix.factions
                .filter((f) => heldBy!.has(f.id))
                .map((f) => (
                  <button key={f.id} className="chip" aria-pressed={facOn === f.id} onClick={() => setFac(facOn === f.id ? undefined : f.id)}>
                    <i style={{ background: f.color }} />
                    {f.name} <b>{heldBy!.get(f.id)}</b>
                  </button>
                ))}
              <span className="muted-note">
                以此刻负责人的派系计（同时有几位负责人时取最后上任者，如主持日常工作的副主席）；没有负责人记录的机构（多为群众组织），取机构本身的派系标注，色浅；负责人不属于任何派系的不计。派系只按 1965–1966 年的格局划分，因此只计算 {Math.floor(CONTROL_FROM)}–{Math.floor(CONTROL_TO)} 年。
              </span>
            </>
          ) : (
            <span className="muted-note">
              派系只按 1965–1966 年的格局划分，掌控只计算 {Math.floor(CONTROL_FROM)} 年庐山会议后至 {Math.floor(CONTROL_TO)} 年历史决议；把时间轴移到这段时间内。
            </span>
          )}
        </div>
      )}
      <div className="canvas people-list" ref={wrap}>
        <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
          <defs>
            <linearGradient id="org-fade">
              <stop offset="0" stopColor="var(--paper)" stopOpacity={1} />
              <stop offset="1" stopColor="var(--paper)" stopOpacity={0} />
            </linearGradient>
          </defs>
        </svg>
        <div className="people-axis" style={{ paddingLeft: nameW + 22 }}>
          <svg width={stripW} height={16} style={{ display: 'block', overflow: 'visible' }}>
            {ticks.map((yr) => (
              <text key={yr} x={x(yr)} y={12} textAnchor="middle" fontSize={10.5} fill="var(--muted)">
                {yr}
              </text>
            ))}
          </svg>
        </div>
        {!groups.length && <p className="muted-note" style={{ padding: '16px 0' }}>没有符合条件的机构。</p>}
        {groups.map((g) => (
          <section key={g.kind}>
            <h2 className="people-group">
              {ORG_KINDS[g.kind]} <span>{g.rows.length}</span>
            </h2>
            {g.rows.map(({ o, depth }) => {
              const tenures = ix.tenuresByOrg.get(o.id) ?? []
              const held = tenures.filter((x) => heldAt(x.pos, t)).length
              const sus = suspendedAt(o, t)
              const off = !existsAt(o, t)
              const head = o.leaders.filter((l) => within(l, t)).pop()
              const c = control?.get(o.id)
              return (
                <button
                  key={o.id}
                  className="people-row org-row"
                  data-off={off || undefined}
                  title={[o.name, when(o), sus && `此刻停止活动${sus.note ? `：${sus.note}` : ''}`].filter(Boolean).join(' · ')}
                  onClick={() => openOrg(o.id)}
                  style={{ gridTemplateColumns: `${nameW}px ${stripW}px ${countW}px` }}
                >
                  <span className="nm" style={{ paddingLeft: Math.min(depth, 6) * indent }}>
                    {depth > 0 && <span className="org-branch" />}
                    <b>{o.short ?? o.name}</b>
                    <small>
                      {ORG_LEVELS[o.level]}
                      {sus ? ' · 停止活动' : ''}
                    </small>
                  </span>
                  <span className="strip">
                    <OrgBar o={o} x={x} width={stripW} t={t} runs={byFaction ? controlRuns(ix, o) : undefined} />
                  </span>
                  <span className="cnt" title={head ? `${head.name} · ${head.title}` : tenures.length ? `库中此刻在任 ${held} / 共 ${tenures.length}` : undefined}>
                    {c && <i className="status-dot" style={{ background: ix.faction.get(c.f)?.color }} title={ix.faction.get(c.f)?.name} />}
                    {head ? <span data-person={head.person ? '' : undefined}>{head.name}</span> : tenures.length ? `${held} / ${tenures.length}` : ''}
                  </span>
                </button>
              )
            })}
          </section>
        ))}
      </div>
    </div>
  )
}

// ── org page ─────────────────────────────────────────────

const ROW = 13
const LBL = 40

function OrgTimeline({ o, x, width }: { o: Org; x: ScaleLinear<number, number>; width: number }) {
  const { ix, t, setT } = useApp()
  const [lo, hi] = x.domain()
  const a = o.from ? toT(o.from) : lo
  const b = o.to ? toT(o.to, true) : hi
  const c = orgColor(o.kind)
  const plotW = width - LBL
  const fit = (label: string, w: number) => {
    const n = Math.floor((w - 6) / 10.5)
    return label.length <= n ? label : n >= 3 ? label.slice(0, n - 1) + '…' : ''
  }
  const dated = [
    ...o.links.filter((l) => l.date).map((l) => ({ date: l.date!, other: l.org, kind: l.kind, out: true })),
    ...(ix.linksInto.get(o.id) ?? []).filter((m) => m.link.date).map((m) => ({ date: m.link.date!, other: m.org.id, kind: m.link.kind, out: false })),
  ]
  const rows: { label: string; body: ReactNode }[] = [
    {
      label: '存续',
      body: (
        <>
          <rect x={x(a)} width={Math.max(2, x(b) - x(a))} height={ROW} rx={2} fill={c} />
          {o.suspended.map((s, i) => {
            const sa = Math.max(a, toT(s.from))
            const sb = Math.min(b, s.to ? toT(s.to, true) : b)
            return (
              <g key={i}>
                <rect x={x(sa)} width={Math.max(1, x(sb) - x(sa))} y={1.5} height={ROW - 3} fill="var(--paper)" stroke={c} strokeDasharray="2 2">
                  <title>{`停止活动 ${when(s)}${s.note ? `：${s.note}` : ''}`}</title>
                </rect>
                <text x={x(sa) + 4} y={ROW - 3} fontSize={10} fill={c} pointerEvents="none">
                  {fit('停止活动', x(sb) - x(sa))}
                </text>
              </g>
            )
          })}
        </>
      ),
    },
  ]
  if (o.places.length)
    rows.push({
      label: '驻地',
      body: segments(o.places, a, b).map(({ s, a: sa, b: sb }, i) => {
        const name = ix.place.get(s.at)?.name ?? s.at
        return (
          <g key={i}>
            <rect x={x(sa)} width={Math.max(2, x(sb) - x(sa) - 1)} height={ROW} rx={2} fill="var(--paper-2)" stroke="var(--rule-2)">
              <title>{`${name} ${when(s)}`}</title>
            </rect>
            <text x={x(sa) + 4} y={ROW - 3} fontSize={10} fill="var(--ink-2)" pointerEvents="none">
              {fit(name, x(sb) - x(sa))}
            </text>
          </g>
        )
      }),
    })
  if (o.under.length)
    rows.push({
      label: '隶属',
      body: segments(o.under, a, b).map(({ s, a: sa, b: sb }, i) => {
        const p = ix.org.get(s.org)
        const name = p?.short ?? p?.name ?? s.org
        return (
          <g key={i}>
            <rect x={x(sa)} width={Math.max(2, x(sb) - x(sa) - 1)} height={ROW} rx={2} fill="none" stroke={p ? orgColor(p.kind) : 'var(--rule-2)'}>
              <title>{`隶属 ${p?.name ?? s.org} ${when(s)}`}</title>
            </rect>
            <text x={x(sa) + 4} y={ROW - 3} fontSize={10} fill={p ? orgColor(p.kind) : 'var(--muted)'} pointerEvents="none">
              {fit(name, x(sb) - x(sa))}
            </text>
          </g>
        )
      }),
    })
  if (dated.length)
    rows.push({
      label: '关系',
      body: dated.map((d, i) => {
        const p = ix.org.get(d.other)
        const [pre, post] = (d.out ? OUT : IN)[d.kind]
        return (
          <g key={i} transform={`translate(${x(toT(d.date))},${ROW / 2})`}>
            <path d="M0,-5L5,0L0,5L-5,0Z" fill={d.kind === 'oppose' || d.kind === 'takeover' ? 'var(--accent)' : 'var(--ink-2)'} stroke="var(--card)">
              <title>{`${fmtDate(d.date)} ${pre}${p?.name ?? d.other}${post}`}</title>
            </path>
          </g>
        )
      }),
    })
  const H = rows.length * (ROW + 6) - 6
  const ticks = x.ticks(Math.max(3, Math.floor(plotW / 80))).filter((y) => Number.isInteger(y))
  const inRange = t >= lo && t <= hi
  const pick = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    setT(Math.min(hi, Math.max(lo, x.invert(e.clientX - r.left))))
  }
  const sus = suspendedAt(o, t)
  const parent = existsAt(o, t) ? parentAt(o, t) : undefined
  const seat = existsAt(o, t) ? placeAt(o, t) : undefined
  const held = (ix.tenuresByOrg.get(o.id) ?? []).filter((x) => heldAt(x.pos, t))
  const state = !existsAt(o, t) ? (o.from && t < toT(o.from) ? '尚未成立' : '已撤销或改组') : sus ? '停止活动' : '存在'

  return (
    <div className="ptl">
      <div style={{ display: 'flex' }}>
        <svg width={LBL} height={H + 18} style={{ flex: 'none' }}>
          {rows.map((r, i) => (
            <text key={r.label} x={LBL - 8} y={i * (ROW + 6) + ROW - 2} textAnchor="end" fontSize={11} fill="var(--muted)">
              {r.label}
            </text>
          ))}
        </svg>
        <div className="ptl-plot" style={{ width: plotW }} onClick={pick} title="点击移动当前时刻">
          <svg width={plotW} height={H + 18} style={{ display: 'block', overflow: 'visible' }}>
            {ticks.map((yr) => (
              <g key={yr}>
                <line x1={x(yr)} x2={x(yr)} y1={-4} y2={H} stroke="var(--rule)" />
                <text x={x(yr)} y={H + 14} textAnchor="middle" fontSize={10.5} fill="var(--muted)">
                  {yr}
                </text>
              </g>
            ))}
            {rows.map((r, i) => (
              <g key={r.label} transform={`translate(0,${i * (ROW + 6)})`}>
                {r.body}
              </g>
            ))}
          </svg>
          {inRange && <div className="ptl-now" style={{ left: x(t), bottom: 14 }} />}
        </div>
      </div>
      <p className="ptl-cap">
        <b>{fmtT(t, 'month')}</b>
        {state}
        {seat && ` · 驻${ix.place.get(seat)?.name ?? seat}`}
        {parent && <> · 隶属 <OrgLinkBtn id={parent} /></>}
        {existsAt(o, t) && ` · 库中在任 ${held.length} 人`}
        <span>· 点击时间带移动时刻；菱形为与其他机构的关系，红色为对立、夺权</span>
      </p>
    </div>
  )
}

// One row per tenure: a person in the atlas (linked, colored by primary faction) or a name only.
type Band = { name: string; person?: Person; title: string; from?: string; to?: string; verify?: boolean; unsourced?: boolean; note?: string }
const bandOfTenure = ({ person, pos }: Tenure): Band => ({ name: person.name, person, title: pos.title, from: pos.from, to: pos.to, verify: pos.verify })

function TenureBands({ list, x, width, end, from }: { list: Band[]; x: ScaleLinear<number, number>; width: number; end: number; from?: string }) {
  const { ix, t, select } = useApp()
  const [lo, hi] = x.domain()
  return (
    <div className="tenures">
      {list.map((r, i) => {
        const a = r.from ? toT(r.from) : from ? toT(from) : lo
        const b = r.to ? toT(r.to, true) : r.person?.died ? Math.min(end, toT(r.person.died, true)) : hi
        const on = a <= t && t < b
        const c = r.person ? (ix.primaryFaction(r.person)?.color ?? 'var(--muted)') : 'var(--muted)'
        const span = `${r.from ? fmtDate(r.from) : '?'}–${r.to ? fmtDate(r.to) : ''}`
        return (
          <div key={i} className="tenure" data-on={on || undefined}>
            {r.person ? (
              <button className="linklike" onClick={() => select({ type: 'person', id: r.person!.id })}>
                {r.name}
              </button>
            ) : (
              <span className="nolink" title="本站未收录此人">
                {r.name}
              </span>
            )}
            <span className="tt" title={[r.title, span, r.note].filter(Boolean).join(' · ')}>
              {r.title}
              {r.verify && <Verify />}
            </span>
            <svg width={width} height={10} style={{ display: 'block', overflow: 'visible' }}>
              <rect x={x(a)} width={Math.max(2, x(b) - x(a))} height={10} rx={2} fill={c} fillOpacity={on ? 1 : 0.35} stroke={c} strokeDasharray={r.verify || r.unsourced ? '3 2' : undefined}>
                <title>{[`${r.name} · ${r.title} · ${span}`, r.note].filter(Boolean).join('\n')}</title>
              </rect>
              {t >= lo && t <= hi && <line x1={x(t)} x2={x(t)} y1={-3} y2={13} stroke="var(--accent)" strokeWidth={1.2} />}
            </svg>
          </div>
        )
      })}
    </div>
  )
}

// The succession as one strip: consecutive heads side by side, overlaps (a nominal head and the one who
// ran daily work) stacked on a second line.
function Succession({ list, x, width }: { list: Band[]; x: ScaleLinear<number, number>; width: number }) {
  const { ix, t, select } = useApp()
  const [lo, hi] = x.domain()
  // a lane is free once its last head has left; year-only dates (“1965–” after “–1965”) count as a
  // hand-over, not an overlap, and the earlier bar is clipped at the later one's start
  const lanes: { end: number; loose: boolean; item?: { b: number } }[] = []
  const placed = list.map((r, i) => {
    const a = r.from ? toT(r.from) : lo
    const next = list.slice(i + 1).find((n) => n.from && toT(n.from) > a)
    const b = r.to ? toT(r.to, true) : r.person?.died ? Math.min(hi, toT(r.person.died, true), next?.from ? toT(next.from) : hi) : next?.from ? toT(next.from) : hi
    const loose = !!r.to && r.to.length === 4
    const fromLoose = !!r.from && r.from.length === 4
    let lane = lanes.findIndex((l) => l.end <= a + (fromLoose || l.loose ? 1 : 0.01))
    const item = { r, a, b, lane: 0 }
    if (lane < 0) lane = lanes.push({ end: b, loose }) - 1
    else {
      if (lanes[lane].item && lanes[lane].item!.b > a) lanes[lane].item!.b = a
      lanes[lane].end = b
      lanes[lane].loose = loose
    }
    lanes[lane].item = item
    item.lane = lane
    return item
  })
  const H = 22
  return (
    <svg width={width} height={lanes.length * (H + 3) + 14} style={{ display: 'block', overflow: 'visible' }} className="succession">
      {placed.map(({ r, a, b, lane }, i) => {
        const w = Math.max(2, x(b) - x(a))
        const c = r.person ? (ix.primaryFaction(r.person)?.color ?? 'var(--muted)') : 'var(--muted)'
        const on = a <= t && t < b
        return (
          <g
            key={i}
            transform={`translate(${x(a)},${lane * (H + 3)})`}
            style={{ cursor: r.person ? 'pointer' : 'default' }}
            onClick={() => r.person && select({ type: 'person', id: r.person.id })}
          >
            <rect width={w} height={H} rx={2} fill={c} fillOpacity={on ? 0.95 : 0.3} stroke="var(--card)" strokeWidth={1} />
            {w > r.name.length * 12 + 6 && (
              <text x={4} y={15} fontSize={11.5} fill={on ? 'var(--on-accent)' : 'var(--ink)'}>
                {r.name}
              </text>
            )}
            <title>{`${r.name} · ${r.title} · ${r.from ? fmtDate(r.from) : '?'}–${r.to ? fmtDate(r.to) : ''}${r.note ? `\n${r.note}` : ''}`}</title>
          </g>
        )
      })}
      {t >= lo && t <= hi && <line x1={x(t)} x2={x(t)} y1={-3} y2={lanes.length * (H + 3)} stroke="var(--accent)" strokeWidth={1.4} />}
      {d3.range(Math.ceil(lo / 10) * 10, hi, 10).map((yr) => (
        <text key={yr} x={x(yr)} y={lanes.length * (H + 3) + 11} fontSize={10} fill="var(--muted)" textAnchor="middle">
          {yr}
        </text>
      ))}
    </svg>
  )
}

function OrgPage({ id }: { id: string }) {
  const { ix, t, up } = useApp()
  const o = ix.org.get(id)
  const wrap = useRef<HTMLDivElement>(null)
  const { width } = useSize(wrap)
  if (!o) return <Directory />

  const mainW = Math.min(720, Math.max(280, (width > 1100 ? width - 420 : width) - 64))
  const tenures = [...(ix.tenuresByOrg.get(id) ?? [])].sort((u, v) => (u.pos.from ?? '').localeCompare(v.pos.from ?? ''))
  const years = [o.from, o.to, ...tenures.flatMap((x) => [x.pos.from, x.pos.to]), ...o.leaders.flatMap((l) => [l.from, l.to]), ...o.places.flatMap((p) => [p.from, p.to]), ...o.under.flatMap((u) => [u.from, u.to])]
    .filter((d): d is string => !!d)
    .map((d) => Number(d.slice(0, 4)))
  const start = Math.max(1890, Math.min(...years, o.from ? 9999 : 1949) - 2)
  const end = Math.max(...years, o.to ? 0 : 1990) + 2
  const x = d3.scaleLinear().domain([start, end]).range([0, mainW - LBL])
  const bandW = Math.max(160, mainW - 240)
  const xb = d3.scaleLinear().domain([start, end]).range([0, bandW])
  const xb2 = d3.scaleLinear().domain([start, end]).range([0, mainW])
  const leaders: Band[] = o.leaders.map((l) => ({ ...l, person: l.person ? ix.person.get(l.person) : undefined, unsourced: !l.cite }))
  // with a leaders list, the atlas tenures are shown as one list; without, heads are picked by title
  const heads = leaders.length ? [] : tenures.filter((x) => isHead(x.pos.title, o))
  const others = leaders.length ? tenures : tenures.filter((x) => !isHead(x.pos.title, o))
  const nowLeaders = leaders.filter((l) => within(l, t))
  const children = [...(ix.childrenOf.get(id) ?? [])].sort((a, b) => order(a.org, b.org))
  const linksIn = ix.linksInto.get(id) ?? []
  const events = ix.eventsByOrg.get(id) ?? []
  const seats = segments(o.places, o.from ? toT(o.from) : start, o.to ? toT(o.to, true) : end)

  // 沿革: everything dated, in order
  const chron: { date: string; text: ReactNode; cite?: string; verify?: boolean }[] = []
  if (o.from) chron.push({ date: o.from, text: `成立${seats[0] && seats[0].a <= toT(o.from) + 0.01 ? `，驻${ix.place.get(seats[0].s.at)?.name ?? ''}` : ''}` })
  for (const u of o.under) if (u.from && u.from !== o.from) chron.push({ date: u.from, text: <>改隶 <OrgLinkBtn id={u.org} /></> })
  for (const s of seats.slice(1)) if (s.s.from) chron.push({ date: s.s.from, text: `驻地迁至${ix.place.get(s.s.at)?.name ?? s.s.at}` })
  for (const s of o.suspended) {
    chron.push({ date: s.from, text: `停止活动${s.note ? `：${s.note}` : ''}` })
    if (s.to) chron.push({ date: s.to, text: '恢复活动' })
  }
  for (const l of o.links)
    if (l.date) {
      const [pre, post] = OUT[l.kind]
      chron.push({ date: l.date, text: <>{pre}<OrgLinkBtn id={l.org} />{post}{l.note && `。${l.note}`}</>, cite: l.cite, verify: l.verify })
    }
  for (const { org, link } of linksIn)
    if (link.date) {
      const [pre, post] = IN[link.kind]
      chron.push({ date: link.date, text: <>{pre}<OrgLinkBtn id={org.id} />{post}{link.note && `。${link.note}`}</>, cite: link.cite, verify: link.verify })
    }
  if (o.to) chron.push({ date: o.to, text: '撤销、改组或停止存在' })
  chron.sort((a, b) => toT(a.date) - toT(b.date))

  const names = [o.short, ...o.aliases].filter((n, i, xs): n is string => !!n && n !== o.name && xs.indexOf(n) === i)

  return (
    <div className="view">
      <div className="profile" ref={wrap}>
        <div className="profile-inner">
          <nav className="crumbs">
            <button className="linklike" onClick={() => up('orgs')}>
              ← 机构
            </button>
            {o.under.length > 0 && (
              <>
                {' · 上级 '}
                <OrgLinkBtn id={parentAt(o, t)!} />
              </>
            )}
          </nav>
          <header className="profile-head">
            <div className="kicker">
              机构 · {ORG_KINDS[o.kind]} · {ORG_LEVELS[o.level]}
            </div>
            <h1>
              {o.name} {o.verify && <Verify />}
            </h1>
            <div className="meta">{[when(o) || '存续期未录', names.length ? `又称 ${names.join('、')}` : undefined].filter(Boolean).join(' · ')}</div>
            {o.factions.length > 0 && (
              <div className="chips" style={{ marginTop: 10 }}>
                {o.factions.map((f) => (
                  <Entity key={f} refTo={{ type: 'faction', id: f }} dot={ix.faction.get(f)?.color} />
                ))}
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <OrgTimeline o={o} x={x} width={mainW} />
            </div>
          </header>
          <div className="profile-grid">
            <article className="bio">
              <p className="lead">{o.summary}</p>
              <div className="chips">
                {o.cites.map((c) => (
                  <Cite key={c} cite={c} />
                ))}
              </div>
              {chron.length > 0 && (
                <section>
                  <h2>沿革</h2>
                  <ul className="minilist chron">
                    {chron.map((c, i) => (
                      <li key={i}>
                        <time>{fmtDate(c.date)}</time>
                        <span>{c.text}</span> <Cite cite={c.cite} />
                        {c.verify && <Verify />}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {leaders.length > 0 && (
                <section>
                  <h2>
                    历任负责人
                    <time>
                      {leaders.length} 任 · {new Set(leaders.map((l) => l.name)).size} 人 · 此刻{nowLeaders.length ? nowLeaders.map((l) => l.name).join('、') : '无'}
                    </time>
                  </h2>
                  <Succession list={leaders} x={xb2} width={mainW} />
                  <TenureBands list={leaders} x={xb} width={bandW} end={end} from={o.from} />
                  <p className="muted-note">
                    含本站未收录的人物（灰色，无链接）。名单据通行史实整理，尚未逐条与组织史资料核对，均属待核；虚线框表示没有出处。重叠的色带是名义负责人与主持日常工作者并存。
                  </p>
                </section>
              )}
              {tenures.length > 0 && (
                <section>
                  <h2>
                    {leaders.length ? '本站人物在此任职' : '任职人物'}
                    <time>
                      库中 {tenures.length} 条任职 · 此刻在任 {tenures.filter((x) => heldAt(x.pos, t)).length} 人
                    </time>
                  </h2>
                  {heads.length > 0 && (
                    <>
                      <h3 className="tenure-h">负责人</h3>
                      <TenureBands list={heads.map(bandOfTenure)} x={xb} width={bandW} end={end} />
                    </>
                  )}
                  {others.length > 0 && (
                    <>
                      {!leaders.length && <h3 className="tenure-h">其他任职</h3>}
                      <TenureBands list={others.map(bandOfTenure)} x={xb} width={bandW} end={end} />
                    </>
                  )}
                  <p className="muted-note">只列本站 {ix.people.length} 位人物的任职，不是完整名单。色带颜色是人物的主要派系，实心为此刻在任，虚线框为待核。</p>
                </section>
              )}
            </article>
            <aside className="profile-side">
              <section>
                <h3>档案</h3>
                <dl className="facts">
                  <div>
                    <dt>类别</dt>
                    <dd>
                      {ORG_KINDS[o.kind]} · {ORG_LEVELS[o.level]}
                    </dd>
                  </div>
                  <div>
                    <dt>存续</dt>
                    <dd>{when(o) || '未录'}</dd>
                  </div>
                  {seats.length > 0 && (
                    <div>
                      <dt>驻地</dt>
                      <dd>
                        {seats.map(({ s }, i) => (
                          <div key={i}>
                            {ix.place.get(s.at)?.name ?? s.at}
                            {(s.from || s.to) && <time> {when(s)}</time>}
                          </div>
                        ))}
                      </dd>
                    </div>
                  )}
                  {o.suspended.length > 0 && (
                    <div>
                      <dt>停止活动</dt>
                      <dd>
                        {o.suspended.map((s, i) => (
                          <div key={i}>
                            <time>{when(s)}</time>
                            {s.note && ` ${s.note}`}
                          </div>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
              {o.under.length > 0 && (
                <section>
                  <h3>上级机构</h3>
                  <ul className="minilist">
                    {o.under.map((u, i) => (
                      <li key={i} style={{ opacity: within(u, t) ? 1 : 0.7 }}>
                        <OrgLinkBtn id={u.org} /> {(u.from || u.to) && <time>{when(u)}</time>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {children.length > 0 && (
                <section>
                  <h3>下属机构</h3>
                  <ul className="minilist">
                    {children.map(({ org: c, from, to }) => (
                      <li key={c.id} style={{ opacity: existsAt(c, t) ? 1 : 0.6 }}>
                        <i className="kind-dot" style={{ background: orgColor(c.kind) }} />
                        <OrgLinkBtn id={c.id} /> <time>{when(c) || when({ from, to })}</time>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {(o.links.length > 0 || linksIn.length > 0) && (
                <section>
                  <h3>与其他机构的关系</h3>
                  <ul className="minilist">
                    {o.links.map((l, i) => {
                      const [pre, post] = OUT[l.kind]
                      return (
                        <li key={`o${i}`}>
                          {l.date && <time>{fmtDate(l.date)} </time>}
                          {pre}
                          <OrgLinkBtn id={l.org} />
                          {post} <Cite cite={l.cite} />
                          {l.verify && <Verify />}
                        </li>
                      )
                    })}
                    {linksIn.map(({ org, link }, i) => {
                      const [pre, post] = IN[link.kind]
                      return (
                        <li key={`i${i}`}>
                          {link.date && <time>{fmtDate(link.date)} </time>}
                          {pre}
                          <OrgLinkBtn id={org.id} />
                          {post} <Cite cite={link.cite} />
                          {link.verify && <Verify />}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}
              {events.length > 0 && (
                <section>
                  <h3>相关事件</h3>
                  <EventList events={events} />
                  <p className="muted-note">按事件标题和摘要中出现的机构名称匹配。</p>
                </section>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
