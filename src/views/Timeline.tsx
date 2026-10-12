import * as d3 from 'd3'
import { useEffect, useMemo, useRef, useState } from 'react'
import { StatusLegend, statusColor, useTip } from '../components/bits'
import { statusAt } from '../data/atlas'
import { LANES, type Event, type Lane, type Status } from '../data/schema'
import { fmtRange, fmtT, toT } from '../lib/dates'
import { useSize } from '../lib/useSize'
import { useApp, useHistoryState } from '../state'

const ERAS: [number, number, string][] = [
  [1949.75, 1953, '建国初期'],
  [1953, 1957.45, '社会主义改造'],
  [1957.45, 1958.4, '反右'],
  [1958.4, 1962, '大跃进与大饥荒'],
  [1962, 1966.37, '调整与四清'],
  [1966.37, 1976.8, '文化大革命'],
  [1976.8, 1978.96, '徘徊'],
  [1978.96, 1989.6, '改革开放'],
]
// 1981 年决议（21）："文化大革命"的过程分为三段
const CR_STAGES: [number, number, string][] = [
  [1966.37, 1969.3, '一 · 至九大'],
  [1969.3, 1973.65, '二 · 至十大'],
  [1973.65, 1976.8, '三 · 至粉碎四人帮'],
]

const LANE_KEYS = Object.keys(LANES) as Lane[]
const GUTTER = 92
const TOP = 46
const PULSE_H = 64
const MINI_H = 34
const DOMAIN: [number, number] = [1949.5, 1990]
const INITIAL: [number, number] = [1965.85, 1970.05]
const DOT_Y = 14
const LABEL_ROW = 15

// Phones get a dated list by default: eight lanes of dots and labels do not fit 390px.
export function Timeline() {
  const [list, setList] = useHistoryState('timeline.list', () => window.matchMedia('(max-width: 560px)').matches)
  return list ? <TimelineList onChart={() => setList(false)} /> : <TimelineChart onList={() => setList(true)} />
}

function TimelineList({ onChart }: { onChart: () => void }) {
  const { ix, sel, select, t, setT } = useApp()
  const [lane, setLane] = useHistoryState<Lane | ''>('timeline.lane', '')
  const years = useMemo(() => {
    const evs = ix.events.filter((e) => !lane || e.lane === lane).sort((a, b) => a.date.localeCompare(b.date))
    return d3.groups(evs, (e) => e.date.slice(0, 4))
  }, [ix.events, lane])
  const nowYear = String(Math.floor(t))
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    listRef.current?.querySelector(`[data-year="${nowYear}"]`)?.scrollIntoView({ block: 'start' })
  }, [lane]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="view">
      <div className="viewhead">
        <div>
          <h1>时间线</h1>
          <p>按日期排列的事件；点事件看详情并把时间游标移到当天。虚线圆点为待核。</p>
        </div>
        <div className="legend">
          <select className="field" value={lane} onChange={(e) => setLane(e.target.value as Lane | '')}>
            <option value="">全部领域</option>
            {LANE_KEYS.map((k) => (
              <option key={k} value={k}>
                {LANES[k]}
              </option>
            ))}
          </select>
          <button className="chip" onClick={onChart}>
            看图表
          </button>
        </div>
      </div>
      <div className="canvas tl-list" ref={listRef}>
        {years.map(([y, evs]) => (
          <section key={y} data-year={y}>
            <h2 className="people-group">
              {y} <span>{evs.length}</span>
            </h2>
            {evs.map((e) => (
              <button
                key={e.id}
                className="tl-item"
                aria-pressed={sel?.type === 'event' && sel.id === e.id}
                onClick={() => {
                  select({ type: 'event', id: e.id })
                  setT(toT(e.date))
                }}
              >
                <time>{fmtRange(e.date, e.end).replace(/^\d{4}年/, '') || `${y}年`}</time>
                <span>
                  <i className="tl-dot" data-verify={e.verify || undefined} data-w={e.weight} />
                  <b>{e.title}</b>
                  <small>{LANES[e.lane]}</small>
                </span>
              </button>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}

function TimelineChart({ onList }: { onList: () => void }) {
  const { ix, sel, select, t, setT } = useApp()
  const wrap = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const { width, height } = useSize(wrap)
  const { tip, setTip } = useTip()
  const [transform, setTransform] = useState<d3.ZoomTransform | null>(null)
  const prevBase = useRef<d3.ScaleLinear<number, number> | null>(null)

  const plotW = Math.max(200, width - GUTTER - 16)
  const base = useMemo(() => d3.scaleLinear().domain(DOMAIN).range([GUTTER, GUTTER + plotW]), [plotW])
  const x = useMemo(() => (transform ? transform.rescaleX(base) : base), [transform, base])
  const lanesH = Math.max(240, height - TOP - PULSE_H - MINI_H - 28)
  const laneH = lanesH / LANE_KEYS.length

  const zoom = useMemo(
    () =>
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([1, 600])
        .translateExtent([
          [GUTTER, 0],
          [GUTTER + plotW, 0],
        ])
        .extent([
          [GUTTER, 0],
          [GUTTER + plotW, 0],
        ])
        .filter((e) => !e.button && !(e.target as Element).closest?.('[data-noz]'))
        .on('zoom', (e) => setTransform(e.transform)),
    [plotW],
  )

  useEffect(() => {
    if (!svgRef.current || !width) return
    const svg = d3.select(svgRef.current)
    svg.call(zoom)
    const [a, b] = transform ? transform.rescaleX(prevBase.current ?? base).domain() : INITIAL
    const k = (DOMAIN[1] - DOMAIN[0]) / (b - a)
    svg.call(zoom.transform, d3.zoomIdentity.translate(GUTTER - k * base(a), 0).scale(k))
    prevBase.current = base
    return () => void svg.on('.zoom', null)
  }, [zoom, width]) // eslint-disable-line react-hooks/exhaustive-deps

  const focus = useMemo(() => {
    if (!sel) return null
    if (sel.type === 'person') return (e: Event) => e.people.includes(sel.id)
    if (sel.type === 'concept') return (e: Event) => e.concepts.includes(sel.id)
    if (sel.type === 'doc') return (e: Event) => e.docs.includes(sel.id) || e.cites.some((c) => c.startsWith(sel.id))
    if (sel.type === 'faction')
      return (e: Event) => e.people.some((p) => ix.person.get(p)?.factions.includes(sel.id))
    if (sel.type === 'event') return (e: Event) => e.id === sel.id
    if (sel.type === 'claim') return (e: Event) => ix.claim.get(sel.id)?.events.includes(e.id) ?? false
    return null
  }, [sel, ix])

  const [x0, x1] = x.domain()
  const pxPerYear = plotW / (x1 - x0)

  // greedy label placement per lane
  const placed = useMemo(() => {
    const out = new Map<string, { lx: number; row: number }>()
    const minWeight = pxPerYear > 900 ? 1 : pxPerYear > 300 ? 2 : 3
    const rowCount = Math.max(1, Math.floor((laneH - DOT_Y - 6) / LABEL_ROW))
    for (const lane of LANE_KEYS) {
      const rows: [number, number][][] = Array.from({ length: rowCount }, () => [])
      const evs = ix.events
        .filter((e) => e.lane === lane && e.weight >= minWeight)
        .sort((a, b) => b.weight - a.weight || a.date.localeCompare(b.date))
      for (const e of evs) {
        const lx = x(toT(e.date))
        if (lx < GUTTER - 60 || lx > GUTTER + plotW) continue
        const span: [number, number] = [lx - 3, lx + Math.min(e.title.length, 18) * 12 + 10]
        const row = rows.findIndex((r) => !r.some(([a, b]) => span[0] < b && a < span[1]))
        if (row < 0) continue
        rows[row].push(span)
        out.set(e.id, { lx, row })
      }
    }
    return out
  }, [ix.events, x, pxPerYear, plotW, laneH])

  // fate pulse: stacked counts of statuses over time
  const pulse = useMemo(() => {
    const order: Status[] = ['power', 'rise', 'restored', 'normal', 'sidelined', 'attacked', 'purged', 'detained', 'dead']
    const steps = 360
    const rows = d3.range(steps + 1).map((i) => {
      const tt = x0 + ((x1 - x0) * i) / steps
      const row: Record<string, number> = { t: tt }
      for (const s of order) row[s] = 0
      for (const p of ix.people) {
        const s = statusAt(p, tt)
        if (s) row[s]++
      }
      return row
    })
    const stack = d3.stack<Record<string, number>>().keys(order)(rows)
    const max = ix.people.length
    const y = d3.scaleLinear().domain([0, max]).range([PULSE_H - 4, 4])
    const area = d3
      .area<d3.SeriesPoint<Record<string, number>>>()
      .x((d) => x(d.data.t))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(d3.curveStepAfter)
    return stack.map((s) => ({ key: s.key as Status, d: area(s) ?? '' }))
  }, [ix.people, x, x0, x1])

  const ticks = x.ticks(Math.max(4, Math.floor(plotW / 110)))
  const monthMode = pxPerYear > 500
  const monthTicks = monthMode
    ? d3.range(Math.floor(x0 * 12), Math.ceil(x1 * 12)).map((m) => m / 12)
    : []

  const mini = d3.scaleLinear().domain(DOMAIN).range([GUTTER, GUTTER + plotW])
  const density = useMemo(() => {
    const bins = d3.bin<Event, number>().domain(DOMAIN).thresholds(d3.range(DOMAIN[0], DOMAIN[1], 1 / 4)).value((e) => toT(e.date))(ix.events)
    return bins
  }, [ix.events])
  const densMax = d3.max(density, (b) => b.length) ?? 1

  const lanesTop = TOP
  const pulseTop = lanesTop + lanesH + 8
  const miniTop = pulseTop + PULSE_H + 14

  const onBackgroundClick = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = svgRef.current!.getBoundingClientRect()
    setT(x.invert(e.clientX - rect.left))
  }

  const zoomTo = (a: number, b: number) => {
    const k = (DOMAIN[1] - DOMAIN[0]) / (b - a)
    const tx = GUTTER - k * base(a)
    d3.select(svgRef.current!).transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(tx, 0).scale(k))
  }

  const cursorX = x(t)

  return (
    <div className="view">
      <div className="viewhead">
        <div>
          <h1>时间线</h1>
          <p>滚轮缩放、拖动平移；点击空白处移动时间游标。选中人物或概念后，相关事件会高亮。</p>
        </div>
        <div className="spacer" />
        <div className="legend">
          <span>
            <svg width="14" height="14">
              <circle cx="7" cy="7" r="5" fill="var(--ink)" />
            </svg>
            有原文出处
          </span>
          <span>
            <svg width="14" height="14">
              <circle cx="7" cy="7" r="5" fill="var(--card)" stroke="var(--ink)" strokeDasharray="2 2" />
            </svg>
            待核
          </span>
          {(
            [
              ['1949–1989', DOMAIN[0], DOMAIN[1]],
              ['1966–1969', 1965.85, 1970.05],
              ['1966', 1965.62, 1967.12],
              ['1967', 1966.92, 1968.05],
              ['1968–1969', 1967.92, 1970.3],
              ['1970–1977', 1970.4, 1977.75],
              ['1978–1989', 1978.6, 1989.65],
            ] as const
          ).map(([l, a, b]) => (
            <button key={l} className="chip" onClick={() => zoomTo(a, b)}>
              {l}
            </button>
          ))}
          <button className="chip" onClick={onList}>
            看列表
          </button>
        </div>
      </div>
      <div className="canvas" ref={wrap}>
        <svg ref={svgRef} onMouseLeave={() => setTip(null)}>
          <defs>
            <clipPath id="plot">
              <rect x={GUTTER} y={0} width={plotW} height={height} />
            </clipPath>
          </defs>
          <rect x={GUTTER} y={0} width={plotW} height={miniTop - 6} fill="transparent" onClick={onBackgroundClick} />

          {/* eras */}
          <g clipPath="url(#plot)">
            {ERAS.map(([a, b, name], i) => {
              const lx = Math.max(x(a), GUTTER) + 6
              const fits = Math.min(x(b), GUTTER + plotW) - lx > name.length * 11 + 6
              return (
                <g key={name} pointerEvents="none">
                  <rect
                    x={x(a)}
                    y={0}
                    width={Math.max(0, x(b) - x(a))}
                    height={pulseTop + PULSE_H}
                    fill={name === '文化大革命' ? 'var(--accent)' : i % 2 ? 'var(--ink)' : 'transparent'}
                    opacity={name === '文化大革命' ? 0.035 : 0.018}
                  />
                  {fits && (
                    <text x={lx} y={14} fontSize={11} fill={name === '文化大革命' ? 'var(--accent)' : 'var(--muted)'}>
                      {name}
                    </text>
                  )}
                </g>
              )
            })}
            {pxPerYear > 60 &&
              CR_STAGES.map(([a, b, name]) => {
                const lx = Math.max(x(a), GUTTER) + 4
                const fits = Math.min(x(b), GUTTER + plotW) - lx > name.length * 10
                return (
                  <g key={name} pointerEvents="none">
                    <line x1={x(a)} x2={x(a)} y1={18} y2={lanesTop - 6} stroke="var(--accent)" strokeOpacity={0.4} />
                    {fits && (
                      <text x={lx} y={28} fontSize={10} fill="var(--accent)" opacity={0.8}>
                        {name}
                      </text>
                    )}
                  </g>
                )
              })}
          </g>

          {/* axis */}
          <g clipPath="url(#plot)" pointerEvents="none">
            {monthTicks.map((m) => (
              <line key={m} x1={x(m)} x2={x(m)} y1={lanesTop} y2={lanesTop + lanesH} stroke="var(--rule)" strokeWidth={0.5} />
            ))}
            {ticks.map((tk) => (
              <g key={tk}>
                <line x1={x(tk)} x2={x(tk)} y1={lanesTop - 6} y2={lanesTop + lanesH} stroke="var(--rule-2)" strokeWidth={Number.isInteger(tk) ? 1 : 0.6} />
                <text x={x(tk) + 3} y={lanesTop - 8} fontSize={10.5} fill="var(--ink-2)">
                  {Number.isInteger(tk) ? tk : fmtT(tk, 'month').replace(/^\d+年/, '')}
                </text>
              </g>
            ))}
          </g>

          {/* lanes */}
          {LANE_KEYS.map((lane, i) => {
            const y0 = lanesTop + i * laneH
            return (
              <g key={lane}>
                <line x1={0} x2={GUTTER + plotW} y1={y0} y2={y0} stroke="var(--rule)" />
                <text x={16} y={y0 + laneH / 2 + 4} fontSize={12.5} fill="var(--ink-2)" fontWeight={500}>
                  {LANES[lane]}
                </text>
              </g>
            )
          })}
          <line x1={0} x2={GUTTER + plotW} y1={lanesTop + lanesH} y2={lanesTop + lanesH} stroke="var(--rule)" />

          {/* events */}
          <g clipPath="url(#plot)">
            {ix.events.map((e) => {
              const li = LANE_KEYS.indexOf(e.lane)
              const cy = lanesTop + li * laneH + DOT_Y
              const xs = x(toT(e.date))
              const xe = e.end ? x(toT(e.end, true)) : xs
              if (xe < GUTTER - 200 || xs > GUTTER + plotW + 200) return null
              const r = [0, 3.5, 5, 7][e.weight]
              const on = !focus || focus(e)
              const selected = sel?.type === 'event' && sel.id === e.id
              const lbl = placed.get(e.id)
              const fill = e.verify ? 'var(--card)' : 'var(--ink)'
              return (
                <g
                  key={e.id}
                  data-noz
                  style={{ cursor: 'pointer' }}
                  opacity={on ? 1 : 0.16}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    select({ type: 'event', id: e.id })
                    setT(toT(e.date))
                  }}
                  onMouseMove={(ev) => {
                    const rect = wrap.current!.getBoundingClientRect()
                    setTip({
                      x: ev.clientX - rect.left,
                      y: ev.clientY - rect.top,
                      content: (
                        <>
                          <b>{e.title}</b>
                          <small>
                            {fmtRange(e.date, e.end)} · {LANES[e.lane]}
                            {e.verify ? ' · 待核' : ''}
                          </small>
                          <div style={{ marginTop: 4 }}>{e.summary.length > 110 ? e.summary.slice(0, 110) + '…' : e.summary}</div>
                        </>
                      ),
                    })
                  }}
                  onMouseLeave={() => setTip(null)}
                >
                  {xe - xs > 2 && (
                    <rect x={xs} y={cy - r * 0.55} width={xe - xs} height={r * 1.1} rx={r * 0.55} fill={e.verify ? 'none' : 'var(--ink)'} opacity={0.18} stroke="var(--ink)" strokeOpacity={e.verify ? 0.5 : 0} strokeDasharray={e.verify ? '2 2' : undefined} />
                  )}
                  <circle cx={xs} cy={cy} r={r} fill={fill} stroke={selected ? 'var(--accent)' : 'var(--ink)'} strokeWidth={selected ? 3 : 1.2} strokeDasharray={e.verify ? '2 1.5' : undefined} />
                  {e.weight === 3 && !e.verify && <circle cx={xs} cy={cy} r={2} fill="var(--accent)" />}
                  {lbl && <line x1={xs} x2={xs} y1={cy + r} y2={cy + (lbl.row + 1) * LABEL_ROW - 2} stroke="var(--rule-2)" />}
                  {lbl && (
                    <text
                      x={xs + 3}
                      y={cy + (lbl.row + 1) * LABEL_ROW + 3}
                      fontSize={e.weight === 3 ? 12 : 11}
                      fontWeight={e.weight === 3 ? 600 : 400}
                      fill={selected ? 'var(--accent)' : 'var(--ink)'}
                      style={{ paintOrder: 'stroke', stroke: 'var(--paper)', strokeWidth: 3 }}
                    >
                      {e.title.length > 18 ? e.title.slice(0, 17) + '…' : e.title}
                    </text>
                  )}
                </g>
              )
            })}
          </g>

          {/* fate pulse */}
          <g>
            <text x={16} y={pulseTop + 18} fontSize={12.5} fill="var(--ink-2)" fontWeight={500}>
              命运脉搏
            </text>
            <text x={16} y={pulseTop + 34} fontSize={10.5} fill="var(--muted)">
              {ix.people.length} 人状态
            </text>
            <g clipPath="url(#plot)" transform={`translate(0, ${pulseTop})`} pointerEvents="none">
              {pulse.map((p) => (
                <path key={p.key} d={p.d} fill={statusColor(p.key)} opacity={0.92} />
              ))}
            </g>
          </g>

          {/* cursor */}
          <g clipPath="url(#plot)" pointerEvents="none">
            <line x1={cursorX} x2={cursorX} y1={lanesTop - 4} y2={pulseTop + PULSE_H} stroke="var(--accent)" strokeWidth={1.4} />
            <rect x={cursorX - 52} y={pulseTop + PULSE_H + 1} width={104} height={16} rx={3} fill="var(--accent)" />
            <text x={cursorX} y={pulseTop + PULSE_H + 13} fontSize={11} fill="var(--on-accent)" textAnchor="middle">
              {fmtT(t)}
            </text>
          </g>

          {/* minimap */}
          <g transform={`translate(0, ${miniTop})`} data-noz>
            <text x={16} y={MINI_H / 2 + 4} fontSize={10.5} fill="var(--muted)">
              1949–1989
            </text>
            <rect
              x={GUTTER}
              y={0}
              width={plotW}
              height={MINI_H}
              fill="var(--paper-2)"
              rx={3}
              style={{ cursor: 'pointer' }}
              onClick={(ev) => {
                const rect = svgRef.current!.getBoundingClientRect()
                const c = mini.invert(ev.clientX - rect.left)
                const half = (x1 - x0) / 2
                zoomTo(Math.max(DOMAIN[0], c - half), Math.min(DOMAIN[1], c + half))
              }}
            />
            {ERAS.map(([a, , name]) => (
              <line key={name} x1={mini(a)} x2={mini(a)} y1={0} y2={MINI_H} stroke="var(--rule-2)" pointerEvents="none" />
            ))}
            {density.map((b, i) => (
              <rect
                key={i}
                x={mini(b.x0!)}
                width={Math.max(1, mini(b.x1!) - mini(b.x0!) - 0.5)}
                y={MINI_H - (b.length / densMax) * (MINI_H - 6) - 2}
                height={(b.length / densMax) * (MINI_H - 6)}
                fill="var(--ink-2)"
                pointerEvents="none"
              />
            ))}
            <rect x={mini(x0)} y={-2} width={Math.max(3, mini(x1) - mini(x0))} height={MINI_H + 4} fill="none" stroke="var(--accent)" strokeWidth={1.5} rx={3} pointerEvents="none" />
            {d3.range(1950, 1991, 5).map((yr) => (
              <text key={yr} x={mini(yr)} y={MINI_H + 13} fontSize={9.5} fill="var(--muted)" textAnchor="middle" pointerEvents="none">
                {yr}
              </text>
            ))}
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