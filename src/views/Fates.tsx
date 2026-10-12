import * as d3 from 'd3'
import { useMemo, useRef } from 'react'
import { StatusLegend, statusColor, useTip } from '../components/bits'
import { statusAt } from '../data/atlas'
import { STATUSES, type Person, type Status } from '../data/schema'
import { fmtDate, fmtT, toT } from '../lib/dates'
import { useSize } from '../lib/useSize'
import { useApp, useHistoryState } from '../state'

const T0 = 1965
const T1 = 1981
const LABEL_W = 168
const ROW = 17
const SUMMARY_H = 70
const AXIS_H = 22
const BAD: Status[] = ['attacked', 'sidelined', 'purged', 'detained', 'dead']

type Sort = 'faction' | 'fall' | 'tier'
const SORTS: Record<Sort, string> = { faction: '按派系', fall: '按首次遭难时间', tier: '按地位' }

function firstFall(p: Person) {
  const f = p.fate.find((f) => BAD.includes(f.s))
  return f ? toT(f.date) : Infinity
}

export function Fates() {
  const { ix, sel, select, t, setT } = useApp()
  const wrap = useRef<HTMLDivElement>(null)
  const { width } = useSize(wrap)
  const { tip, setTip } = useTip()
  const [sort, setSort] = useHistoryState<Sort>('fates.sort', 'faction')

  const plotW = Math.max(300, width - LABEL_W - 24)
  const x = useMemo(() => d3.scaleLinear().domain([T0, T1]).range([LABEL_W, LABEL_W + plotW]), [plotW])

  const rows = useMemo(() => {
    const fOrder = new Map(ix.factions.map((f, i) => [f.id, i]))
    const people = [...ix.people]
    if (sort === 'faction')
      people.sort((a, b) => fOrder.get(a.factions[0])! - fOrder.get(b.factions[0])! || a.tier - b.tier || firstFall(a) - firstFall(b))
    if (sort === 'fall') people.sort((a, b) => firstFall(a) - firstFall(b) || a.tier - b.tier)
    if (sort === 'tier') people.sort((a, b) => a.tier - b.tier || firstFall(a) - firstFall(b))
    const list: ({ kind: 'group'; label: string; color: string } | { kind: 'person'; p: Person })[] = []
    let last = ''
    for (const p of people) {
      if (sort === 'faction' && p.factions[0] !== last) {
        last = p.factions[0]
        const f = ix.faction.get(last)!
        list.push({ kind: 'group', label: f.name, color: f.color })
      }
      list.push({ kind: 'person', p })
    }
    return list
  }, [ix, sort])

  const runs = (p: Person) => {
    const pts = p.fate.map((f) => ({ t: toT(f.date), f }))
    const end = p.died ? Math.min(T1, toT(p.died)) : T1
    const segs: { a: number; b: number; s: Status; note?: string; date: string; verify?: boolean }[] = []
    pts.forEach((pt, i) => {
      const b = i + 1 < pts.length ? pts[i + 1].t : T1
      const a = Math.max(T0, pt.t)
      const bb = Math.min(T1, b)
      if (bb > a) segs.push({ a, b: bb, s: pt.f.s, note: pt.f.note, date: pt.f.date, verify: pt.f.verify })
    })
    if (pts.length && pts[0].t > T0) segs.unshift({ a: T0, b: Math.min(pts[0].t, T1), s: 'normal', date: '' })
    if (!pts.length) segs.push({ a: T0, b: end, s: 'normal', date: '' })
    return segs
  }

  const summary = useMemo(() => {
    const order: Status[] = ['power', 'rise', 'restored', 'normal', 'sidelined', 'attacked', 'purged', 'detained', 'dead']
    const months = d3.range(T0 * 12, T1 * 12 + 1).map((m) => m / 12)
    const data = months.map((tt) => {
      const r: Record<string, number> = { t: tt }
      for (const s of order) r[s] = 0
      for (const p of ix.people) r[statusAt(p, tt) ?? 'normal']++
      return r
    })
    const y = d3.scaleLinear().domain([0, ix.people.length]).range([SUMMARY_H - 2, 2])
    const area = d3
      .area<d3.SeriesPoint<Record<string, number>>>()
      .x((d) => x(d.data.t))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(d3.curveStepAfter)
    return d3.stack<Record<string, number>>().keys(order)(data).map((s) => ({ key: s.key as Status, d: area(s) ?? '' }))
  }, [ix.people, x])

  const top = SUMMARY_H + AXIS_H + 8
  const height = top + rows.length * ROW + 30
  const tip_ = (e: React.MouseEvent, content: React.ReactNode) => {
    const rect = wrap.current!.getBoundingClientRect()
    setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top + wrap.current!.scrollTop, content })
  }

  return (
    <div className="view">
      <div className="viewhead">
        <div>
          <h1>命运矩阵</h1>
          <p>每一行是一个人 1965–1980 年的政治命运。上方堆叠图是全体人物的状态构成。点击任意位置把时间游标移到那里。</p>
        </div>
        <div className="spacer" />
        <div className="legend">
          {(Object.keys(SORTS) as Sort[]).map((k) => (
            <button key={k} className="chip" aria-pressed={sort === k} style={sort === k ? { background: 'var(--ink)', color: 'var(--paper)' } : undefined} onClick={() => setSort(k)}>
              {SORTS[k]}
            </button>
          ))}
        </div>
      </div>
      <div className="canvas" ref={wrap} style={{ overflowY: 'auto' }} onMouseLeave={() => setTip(null)}>
        <svg width="100%" height={height} style={{ display: 'block' }}>
          <rect
            x={LABEL_W}
            width={plotW}
            height={height}
            fill="transparent"
            onClick={(e) => {
              const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
              setT(x.invert(e.clientX - rect.left))
            }}
          />
          <text x={16} y={22} fontSize={12.5} fontWeight={500} fill="var(--ink-2)">
            全体构成
          </text>
          <text x={16} y={38} fontSize={10.5} fill="var(--muted)">
            {ix.people.length} 人
          </text>
          <g pointerEvents="none">
            {summary.map((s) => (
              <path key={s.key} d={s.d} fill={statusColor(s.key)} />
            ))}
          </g>
          <g transform={`translate(0, ${SUMMARY_H})`} pointerEvents="none">
            {d3.range(T0, T1 + 1).map((y) => (
              <g key={y}>
                <line x1={x(y)} x2={x(y)} y1={0} y2={height} stroke={y === 1966 || y === 1976 ? 'var(--accent)' : 'var(--rule)'} strokeOpacity={y === 1966 || y === 1976 ? 0.35 : 1} />
                <text x={x(y) + 3} y={15} fontSize={10.5} fill="var(--ink-2)">
                  {plotW / (T1 - T0) > 44 ? y : y % 2 ? '' : y}
                </text>
              </g>
            ))}
          </g>
          {rows.map((r, i) => {
            const y = top + i * ROW
            if (r.kind === 'group')
              return (
                <g key={`g${i}`} pointerEvents="none">
                  <rect x={8} y={y + 5} width={4} height={10} fill={r.color} rx={1} />
                  <text x={18} y={y + 13} fontSize={11} fontWeight={600} fill={r.color} style={{ letterSpacing: '0.06em' }}>
                    {r.label}
                  </text>
                </g>
              )
            const p = r.p
            const selected = sel?.type === 'person' && sel.id === p.id
            return (
              <g key={p.id}>
                {selected && <rect x={0} y={y} width={LABEL_W + plotW + 8} height={ROW} fill="var(--accent-soft)" />}
                <text
                  x={LABEL_W - 8}
                  y={y + 12.5}
                  textAnchor="end"
                  fontSize={12}
                  fontWeight={p.tier === 1 ? 600 : 400}
                  fill="var(--ink)"
                  style={{ cursor: 'pointer' }}
                  onClick={() => select({ type: 'person', id: p.id })}
                >
                  {p.name}
                  {p.verify ? ' ·' : ''}
                </text>
                {runs(p).map((s, j) => (
                  <rect
                    key={j}
                    x={x(s.a)}
                    y={y + 2}
                    width={Math.max(0.5, x(s.b) - x(s.a) - 0.5)}
                    height={ROW - 4}
                    fill={statusColor(s.s)}
                    opacity={s.s === 'normal' ? 0.55 : 1}
                    stroke={s.verify ? 'var(--warn)' : 'none'}
                    strokeDasharray="2 2"
                    strokeWidth={0.8}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      select({ type: 'person', id: p.id })
                      const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
                      setT(x.invert(e.clientX - rect.left))
                    }}
                    onMouseMove={(e) =>
                      tip_(
                        e,
                        <>
                          <b>{p.name}</b>
                          <small>
                            {STATUSES[s.s]} {s.date && `· 自 ${fmtDate(s.date)}`}
                            {s.verify ? ' · 待核' : ''}
                          </small>
                          {s.note && <div style={{ marginTop: 4 }}>{s.note}</div>}
                        </>,
                      )
                    }
                  />
                ))}
              </g>
            )
          })}
          <g pointerEvents="none">
            <line x1={x(t)} x2={x(t)} y1={0} y2={height} stroke="var(--accent)" strokeWidth={1.4} />
            <rect x={x(t) - 50} y={SUMMARY_H + 2} width={100} height={16} rx={3} fill="var(--accent)" />
            <text x={x(t)} y={SUMMARY_H + 14} textAnchor="middle" fontSize={11} fill="var(--on-accent)">
              {fmtT(t)}
            </text>
          </g>
        </svg>
        {tip}
      </div>
      <div style={{ padding: '6px 20px 8px', borderTop: '1px solid var(--rule)' }}>
        <StatusLegend />
      </div>
    </div>
  )
}
