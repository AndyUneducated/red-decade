import * as d3 from 'd3'
import { useMemo, useRef, useState } from 'react'
import { StatusLegend, statusColor, useTip } from '../components/bits'
import { factionAt, statusAt } from '../data/atlas'
import { STATUSES, type Faction, type Person, type Status } from '../data/schema'
import { fmtDate, fmtT, toT } from '../lib/dates'
import { useSize } from '../lib/useSize'
import { useApp } from '../state'

const LABEL_W = 150
const RIVER_H = 230
const AXIS_H = 22
const UNIT = 5.5
const LANE_MIN = 26
const MARK_H = 14
const GAP = 10
const ORDER: Status[] = ['power', 'rise', 'restored', 'normal', 'sidelined', 'attacked', 'purged', 'detained', 'dead']
const STANDING = new Set<Status>(['power', 'rise', 'restored', 'normal'])
const FALL = new Set<Status>(['attacked', 'purged', 'detained', 'dead'])

const RANGES = { early: [1965, 1969, '1965–1968'], all: [1965, 1981, '1965–1980'] } as const
type Range = keyof typeof RANGES

function sAt(p: Person, t: number): Status {
  if (p.died && t >= toT(p.died)) return 'dead'
  return statusAt(p, t) ?? 'normal'
}

const ym = (d: string) => d.split('-').slice(0, 2).map(Number).join('.')

function span(f: Faction): string {
  if (f.from && f.to) return ` · ${ym(f.from)}–${ym(f.to)}`
  if (f.from) return ` · ${ym(f.from)} 起`
  if (f.to) return ` · 至 ${ym(f.to)}`
  return ''
}

type Lane = { f: Faction; members: Person[]; top: number; h: number }

export function River() {
  const { ix, sel, select, t, setT } = useApp()
  const wrap = useRef<HTMLDivElement>(null)
  const { width } = useSize(wrap)
  const { tip, setTip } = useTip()
  const [range, setRange] = useState<Range>('early')
  const [T0, T1] = RANGES[range]

  const plotW = Math.max(300, width - LABEL_W - 24)
  const x = useMemo(() => d3.scaleLinear().domain([T0, T1]).range([LABEL_W, LABEL_W + plotW]), [T0, T1, plotW])
  const months = useMemo(() => d3.range(T0 * 12, T1 * 12 + 1).map((m) => m / 12), [T0, T1])

  const river = useMemo(() => {
    const keys = ix.factions.map((f) => f.id)
    const data = months.map((tt) => {
      const r: Record<string, number> = { t: tt }
      for (const k of keys) r[k] = 0
      for (const p of ix.people) if (STANDING.has(sAt(p, tt))) r[factionAt(p, tt)]++
      return r
    })
    const series = d3
      .stack<Record<string, number>>()
      .keys(keys)
      .offset(d3.stackOffsetSilhouette)
      .order(d3.stackOrderInsideOut)(data)
    const lo = d3.min(series, (s) => d3.min(s, (d) => d[0]))!
    const hi = d3.max(series, (s) => d3.max(s, (d) => d[1]))!
    const y = d3.scaleLinear().domain([lo, hi]).range([RIVER_H - 6, 30])
    const area = d3
      .area<d3.SeriesPoint<Record<string, number>>>()
      .x((d) => x(d.data.t))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(d3.curveMonotoneX)
    return series.map((s) => {
      const f = ix.faction.get(s.key)!
      const widest = d3.maxIndex(s, (d) => d[1] - d[0])
      const w = s[widest]
      return {
        f,
        d: area(s) ?? '',
        label: y(w[0]) - y(w[1]) > 13 ? { x: x(w.data.t), y: (y(w[0]) + y(w[1])) / 2 } : undefined,
        at: (tt: number) => s[Math.max(0, Math.min(s.length - 1, Math.round((tt - T0) * 12)))],
      }
    })
  }, [ix, months, x, T0])

  const lanes = useMemo(() => {
    let top = RIVER_H + AXIS_H + 14
    const out: Lane[] = []
    for (const f of ix.factions) {
      const members = ix.people.filter((p) => p.factions.includes(f.id))
      if (!members.length) continue
      const h = Math.max(LANE_MIN, members.length * UNIT)
      out.push({ f, members, top, h })
      top += h + MARK_H + GAP
    }
    return { list: out, bottom: top }
  }, [ix])

  const laneShapes = useMemo(
    () =>
      lanes.list.map((ln) => {
        const data = months.map((tt) => {
          const r: Record<string, number> = { t: tt }
          for (const s of ORDER) r[s] = 0
          for (const p of ln.members) r[sAt(p, tt)]++
          return r
        })
        const y = d3.scaleLinear().domain([0, ln.members.length]).range([ln.top + ln.h, ln.top])
        const area = d3
          .area<d3.SeriesPoint<Record<string, number>>>()
          .x((d) => x(d.data.t))
          .y0((d) => y(d[0]))
          .y1((d) => y(d[1]))
          .curve(d3.curveStepAfter)
        const paths = d3
          .stack<Record<string, number>>()
          .keys(ORDER)(data)
          .map((s) => ({ key: s.key as Status, d: area(s) ?? '' }))

        const marks: { p: Person; s: Status; date: string; note?: string; verify?: boolean; cx: number; cy: number }[] = []
        const slots = new Map<number, number>()
        for (const p of ln.members)
          for (const [i, fe] of p.fate.entries()) {
            const prev = i ? p.fate[i - 1].s : 'normal'
            const tt = toT(fe.date)
            if (!FALL.has(fe.s) || prev === fe.s || tt < T0 || tt > T1) continue
            const cx = x(tt)
            const slot = Math.round(cx / 6)
            const n = slots.get(slot) ?? 0
            slots.set(slot, n + 1)
            marks.push({ p, s: fe.s, date: fe.date, note: fe.note, verify: fe.verify, cx, cy: ln.top + ln.h + 4 + Math.min(n, 2) * 4.5 })
          }
        return { ln, paths, marks }
      }),
    [lanes, months, x, T0, T1],
  )

  const height = lanes.bottom + 10
  const tip_ = (e: React.MouseEvent, content: React.ReactNode) => {
    const rect = wrap.current!.getBoundingClientRect()
    setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top + wrap.current!.scrollTop, content })
  }
  const tAt = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect()
    return Math.max(T0, Math.min(T1, x.invert(e.clientX - rect.left)))
  }

  const selPerson = sel?.type === 'person' ? sel.id : undefined
  const selFaction = sel?.type === 'faction' ? sel.id : undefined

  const membersTip = (ln: Lane, tt: number) => {
    const groups = d3.group(ln.members, (p) => sAt(p, tt))
    return (
      <>
        <b>
          {ln.f.name} · {fmtT(tt, 'month')}
        </b>
        {ORDER.filter((s) => groups.has(s)).map((s) => (
          <div key={s} style={{ marginTop: 3 }}>
            <i className="status-dot" style={{ background: statusColor(s) }} /> {STATUSES[s]}：
            {groups
              .get(s)!
              .map((p) => p.name)
              .join('、')}
          </div>
        ))}
      </>
    )
  }

  return (
    <div className="view">
      <div className="viewhead">
        <div>
          <h1>派系河流</h1>
          <p>上方河流的宽度是每个派系仍“在位”（未受批判、靠边、打倒、关押或死亡）的人数，按每人的第一归属计。下方每条带子是一个派系全体成员的状态构成；带子下方的点是成员遭难的时刻。</p>
        </div>
        <div className="spacer" />
        <div className="legend">
          {(Object.keys(RANGES) as Range[]).map((k) => (
            <button
              key={k}
              className="chip"
              aria-pressed={range === k}
              style={range === k ? { background: 'var(--ink)', color: 'var(--paper)' } : undefined}
              onClick={() => setRange(k)}
            >
              {RANGES[k][2]}
            </button>
          ))}
        </div>
      </div>
      <div className="canvas" ref={wrap} style={{ overflowY: 'auto' }} onMouseLeave={() => setTip(null)}>
        <svg width="100%" height={height} style={{ display: 'block' }}>
          <rect x={LABEL_W} width={plotW} height={height} fill="transparent" onClick={(e) => setT(tAt(e))} />
          <text x={16} y={46} fontSize={12.5} fontWeight={500} fill="var(--ink-2)">
            在位人数
          </text>
          <text x={16} y={62} fontSize={10.5} fill="var(--muted)">
            {ix.people.length} 人 · 按第一归属
          </text>

          <g transform={`translate(0, ${RIVER_H})`} pointerEvents="none">
            {d3.range(T0, T1 + 1).map((yr) => (
              <g key={yr}>
                <line x1={x(yr)} x2={x(yr)} y1={-RIVER_H + 24} y2={height} stroke="var(--rule)" />
                <text x={x(yr) + 3} y={15} fontSize={10.5} fill="var(--ink-2)">
                  {plotW / (T1 - T0) > 44 ? yr : yr % 2 ? '' : yr}
                </text>
              </g>
            ))}
            {range === 'early' &&
              d3.range(T0 * 12, T1 * 12).map((m) =>
                m % 12 ? <line key={m} x1={x(m / 12)} x2={x(m / 12)} y1={0} y2={5} stroke="var(--muted)" strokeOpacity={0.5} /> : null,
              )}
          </g>

          {river.map((r) => {
            const dim = (selFaction && selFaction !== r.f.id) || (selPerson && !ix.person.get(selPerson)?.factions.includes(r.f.id))
            return (
              <path
                key={r.f.id}
                d={r.d}
                fill={r.f.color}
                fillOpacity={dim ? 0.25 : 0.85}
                stroke="var(--paper)"
                strokeWidth={0.6}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  setT(tAt(e))
                  select({ type: 'faction', id: r.f.id })
                }}
                onMouseMove={(e) => {
                  const tt = tAt(e)
                  const d = r.at(tt)
                  const total = ix.people.filter((p) => factionAt(p, tt) === r.f.id).length
                  tip_(
                    e,
                    <>
                      <b>{r.f.name}</b>
                      <small>
                        {fmtT(tt, 'month')} · 在位 {Math.round(d[1] - d[0])}/{total} 人
                      </small>
                    </>,
                  )
                }}
              />
            )
          })}
          <g pointerEvents="none">
            {river.map((r) => {
              if (!r.label) return null
              const half = r.f.name.length * 5.6 + 6
              return (
                  <text
                    key={r.f.id}
                    x={Math.min(Math.max(r.label.x, LABEL_W + half), LABEL_W + plotW - half)}
                    y={r.label.y + 4}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={600}
                    fill="#fff"
                    style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.25)', strokeWidth: 2 }}
                  >
                    {r.f.name}
                  </text>
              )
            })}
          </g>

          {laneShapes.map(({ ln, paths, marks }) => {
            const active = selFaction === ln.f.id || (selPerson && ln.members.some((p) => p.id === selPerson))
            const from = ln.f.from ? toT(ln.f.from) : undefined
            const to = ln.f.to ? toT(ln.f.to, true) : undefined
            return (
              <g key={ln.f.id}>
                {active && <rect x={0} y={ln.top - 4} width={LABEL_W + plotW + 8} height={ln.h + MARK_H + 4} fill="var(--accent-soft)" />}
                <g style={{ cursor: 'pointer' }} onClick={() => select({ type: 'faction', id: ln.f.id })}>
                  <rect x={8} y={ln.top + 1} width={4} height={Math.min(ln.h - 2, 14)} fill={ln.f.color} rx={1} />
                  <text x={18} y={ln.top + 12} fontSize={12} fontWeight={600} fill="var(--ink)">
                    {ln.f.name}
                  </text>
                  <text x={18} y={ln.top + 25} fontSize={10.5} fill="var(--muted)">
                    {ln.members.length} 人{span(ln.f)}
                  </text>
                </g>
                <g
                  onClick={(e) => setT(tAt(e))}
                  onMouseMove={(e) => tip_(e, membersTip(ln, tAt(e)))}
                  style={{ cursor: 'crosshair' }}
                >
                  {paths.map((s) => (
                    <path key={s.key} d={s.d} fill={statusColor(s.key)} opacity={s.key === 'normal' ? 0.55 : 1} />
                  ))}
                </g>
                {(from !== undefined || to !== undefined) && (
                  <line
                    x1={x(Math.max(T0, from ?? T0))}
                    x2={x(Math.min(T1, to ?? T1))}
                    y1={ln.top - 2}
                    y2={ln.top - 2}
                    stroke={ln.f.color}
                    strokeWidth={2}
                    pointerEvents="none"
                  />
                )}
                {marks.map((m, i) => (
                  <circle
                    key={i}
                    cx={m.cx}
                    cy={m.cy}
                    r={m.p.id === selPerson ? 3.6 : 2.4}
                    fill={statusColor(m.s)}
                    stroke={m.verify ? 'var(--warn)' : 'var(--paper)'}
                    strokeWidth={m.verify ? 1 : 0.6}
                    style={{ cursor: 'pointer' }}
                    onClick={() => select({ type: 'person', id: m.p.id })}
                    onMouseMove={(e) =>
                      tip_(
                        e,
                        <>
                          <b>{m.p.name}</b>
                          <small>
                            {STATUSES[m.s]} · {fmtDate(m.date)}
                            {m.verify ? ' · 待核' : ''}
                          </small>
                          {m.note && <div style={{ marginTop: 4 }}>{m.note}</div>}
                        </>,
                      )
                    }
                  />
                ))}
              </g>
            )
          })}

          {ix.events
            .filter((ev) => ev.weight === 3 && toT(ev.date) >= T0 && toT(ev.date) <= T1)
            .map((ev) => (
              <path
                key={ev.id}
                d={`M${x(toT(ev.date))},${RIVER_H + 18}l4,4l-4,4l-4,-4z`}
                fill="var(--ink-2)"
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setT(toT(ev.date))
                  select({ type: 'event', id: ev.id })
                }}
                onMouseMove={(e) =>
                  tip_(
                    e,
                    <>
                      <b>{ev.title}</b>
                      <small>{fmtDate(ev.date)}</small>
                    </>,
                  )
                }
              />
            ))}

          {t >= T0 && t <= T1 && (
            <g pointerEvents="none">
              <line x1={x(t)} x2={x(t)} y1={24} y2={height} stroke="var(--accent)" strokeWidth={1.4} />
              <rect x={x(t) - 50} y={RIVER_H + 2} width={100} height={16} rx={3} fill="var(--accent)" />
              <text x={x(t)} y={RIVER_H + 14} textAnchor="middle" fontSize={11} fill="var(--on-accent)">
                {fmtT(t)}
              </text>
            </g>
          )}
        </svg>
        {tip}
      </div>
      <div style={{ padding: '6px 20px 8px', borderTop: '1px solid var(--rule)' }}>
        <StatusLegend />
      </div>
    </div>
  )
}
