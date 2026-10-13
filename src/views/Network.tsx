import { PageTitle } from '../components/PageTitle'
import * as d3 from 'd3'
import { useEffect, useMemo, useRef, useState } from 'react'
import { RELATION_STYLE, StatusLegend, statusColor, useTip } from '../components/bits'
import { Scrubber } from '../components/Scrubber'
import { relationActive, statusAt } from '../data/atlas'
import { RELATION_TYPES, STATUSES, type Person, type Relation, type RelationType } from '../data/schema'
import { fmtDate } from '../lib/dates'
import { useSize } from '../lib/useSize'
import { useApp, useHistoryState } from '../state'

type Node = d3.SimulationNodeDatum & { id: string; p: Person; r: number; group: string }
type Link = d3.SimulationLinkDatum<Node> & { rel: Relation }

const DIRECTED = new Set<RelationType>(['attack', 'persecute', 'patron', 'protect', 'subordinate'])
const W = 1000
const H = 760

export function Network() {
  const { ix, sel, select, t } = useApp()
  const wrap = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const { width, height } = useSize(wrap)
  const { tip, setTip } = useTip()
  const [hover, setHover] = useState<string | null>(null)
  const [types, setTypes] = useHistoryState<Set<RelationType>>('network.types', () => new Set(Object.keys(RELATION_TYPES) as RelationType[]))
  const [view, setView] = useState(d3.zoomIdentity)

  // Layout is computed once over all relations so the picture stays stable while time moves.
  const layout = useMemo(() => {
    const groups = [...new Set(ix.people.map((p) => p.factions[0]))]
    const centers = new Map(
      groups.map((g, i) => {
        const a = (i / groups.length) * Math.PI * 2 - Math.PI / 2
        return [g, { x: W / 2 + Math.cos(a) * 300, y: H / 2 + Math.sin(a) * 260 }]
      }),
    )
    const nodes: Node[] = ix.people.map((p) => {
      const c = centers.get(p.factions[0])!
      return { id: p.id, p, r: [0, 13, 9, 6.5][p.tier], group: p.factions[0], x: c.x, y: c.y }
    })
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const links: Link[] = ix.relations
      .filter((r) => byId.has(r.a) && byId.has(r.b))
      .map((rel) => ({ source: rel.a, target: rel.b, rel }))
    d3.forceSimulation(nodes)
      .force('link', d3.forceLink<Node, Link>(links).id((d) => d.id).distance(70).strength(0.12))
      .force('charge', d3.forceManyBody().strength(-260))
      .force('collide', d3.forceCollide<Node>((d) => d.r + 26))
      .force('x', d3.forceX<Node>((d) => centers.get(d.group)!.x).strength(0.22))
      .force('y', d3.forceY<Node>((d) => centers.get(d.group)!.y).strength(0.22))
      .stop()
      .tick(400)
    return { nodes, links, byId, groups }
  }, [ix])

  const fit = useMemo(() => {
    if (!width || !height) return d3.zoomIdentity
    const xs = d3.extent(layout.nodes, (n) => n.x!) as [number, number]
    const ys = d3.extent(layout.nodes, (n) => n.y!) as [number, number]
    const k = Math.min(width / (xs[1] - xs[0] + 140), height / (ys[1] - ys[0] + 100))
    return d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(k)
      .translate(-(xs[0] + xs[1]) / 2, -(ys[0] + ys[1]) / 2)
  }, [layout, width, height])

  useEffect(() => {
    if (!svgRef.current) return
    const z = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 5])
      .on('zoom', (e) => setView(e.transform))
    const svg = d3.select(svgRef.current).call(z)
    svg.call(z.transform, fit)
    return () => void svg.on('.zoom', null)
  }, [fit])

  const focusId = hover ?? (sel?.type === 'person' ? sel.id : null)
  const focusFaction = sel?.type === 'faction' ? sel.id : null
  const neighbors = useMemo(() => {
    if (!focusId) return null
    const s = new Set([focusId])
    for (const l of layout.links) {
      if (!relationActive(l.rel, t)) continue
      const a = (l.source as Node).id
      const b = (l.target as Node).id
      if (a === focusId) s.add(b)
      if (b === focusId) s.add(a)
    }
    return s
  }, [focusId, layout, t])

  const active = layout.links.filter((l) => types.has(l.rel.type) && relationActive(l.rel, t))
  const hulls = layout.groups.map((g) => {
    const pts = layout.nodes.filter((n) => n.group === g).map((n) => [n.x!, n.y!] as [number, number])
    const f = ix.faction.get(g)!
    const hull = pts.length >= 3 ? d3.polygonHull(pts) : pts
    const cx = d3.mean(pts, (p) => p[0])!
    const top = d3.min(pts, (p) => p[1])!
    return { f, hull: hull ?? pts, cx, top }
  })

  const counts = d3.rollup(
    ix.people,
    (v) => v.length,
    (p) => statusAt(p, t) ?? 'normal',
  )

  return (
    <div className="view">
      <div className="viewhead">
        <div>
          <PageTitle />
          <p>节点颜色＝此刻的政治命运，外圈＝所属派系；连线只显示在当前时刻有效的关系。拖动下方时间轴，看网络如何重组。</p>
        </div>
        <div className="spacer" />
        <div className="legend" style={{ maxWidth: 520 }}>
          {(Object.keys(RELATION_TYPES) as RelationType[]).map((k) => {
            const st = RELATION_STYLE[k]
            const on = types.has(k)
            return (
              <button
                key={k}
                className="chip"
                style={{ opacity: on ? 1 : 0.4 }}
                aria-pressed={on}
                onClick={() =>
                  setTypes((s) => {
                    const n = new Set(s)
                    if (on) n.delete(k)
                    else n.add(k)
                    return n
                  })
                }
              >
                <svg width="18" height="8">
                  <line x1="0" x2="18" y1="4" y2="4" stroke={st.color} strokeWidth={st.width + 0.5} strokeDasharray={st.dash} />
                </svg>
                {RELATION_TYPES[k]}
              </button>
            )
          })}
        </div>
      </div>
      <Scrubber />
      <div className="canvas" ref={wrap}>
        <svg ref={svgRef} onClick={() => select(undefined)}>
          <defs>
            {Object.entries(RELATION_STYLE).map(([k, st]) => (
              <marker key={k} id={`arr-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,1 L9,5 L0,9 z" fill={st.color} />
              </marker>
            ))}
          </defs>
          <g transform={view.toString()}>
            {hulls.map(({ f, hull, cx, top }) => (
              <g
                key={f.id}
                opacity={focusFaction && focusFaction !== f.id ? 0.25 : 1}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation()
                  select({ type: 'faction', id: f.id })
                }}
              >
                <path
                  d={hull.length > 1 ? `M${hull.join('L')}Z` : `M${hull[0]}Z`}
                  fill={f.color}
                  fillOpacity={0.07}
                  stroke={f.color}
                  strokeOpacity={0.1}
                  strokeWidth={56}
                  strokeLinejoin="round"
                />
                <text x={cx} y={top - 34} textAnchor="middle" fontSize={12} fontWeight={600} fill={f.color} style={{ letterSpacing: '0.08em' }}>
                  {f.name}
                </text>
              </g>
            ))}
            {active.map((l, i) => {
              const s = l.source as Node
              const tg = l.target as Node
              const st = RELATION_STYLE[l.rel.type]
              const on = !neighbors || (neighbors.has(s.id) && neighbors.has(tg.id) && (s.id === focusId || tg.id === focusId))
              const dx = tg.x! - s.x!
              const dy = tg.y! - s.y!
              const dist = Math.hypot(dx, dy) || 1
              const ex = tg.x! - (dx / dist) * (tg.r + 3)
              const ey = tg.y! - (dy / dist) * (tg.r + 3)
              const bend = dist * 0.12
              const mx = (s.x! + ex) / 2 - (dy / dist) * bend
              const my = (s.y! + ey) / 2 + (dx / dist) * bend
              return (
                <path
                  key={i}
                  d={`M${s.x},${s.y} Q${mx},${my} ${ex},${ey}`}
                  fill="none"
                  stroke={st.color}
                  strokeWidth={st.width * (on && focusId ? 1.6 : 1)}
                  strokeDasharray={st.dash}
                  opacity={on ? 0.9 : 0.06}
                  markerEnd={DIRECTED.has(l.rel.type) ? `url(#arr-${l.rel.type})` : undefined}
                  onMouseMove={(e) => {
                    const rect = wrap.current!.getBoundingClientRect()
                    setTip({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                      content: (
                        <>
                          <b>
                            {s.p.name} → {tg.p.name}
                          </b>
                          <small>
                            {RELATION_TYPES[l.rel.type]}
                            {l.rel.from ? ` · ${fmtDate(l.rel.from)}起` : ''}
                            {l.rel.verify ? ' · 待核' : ''}
                          </small>
                          {l.rel.note && <div style={{ marginTop: 4 }}>{l.rel.note}</div>}
                        </>
                      ),
                    })
                  }}
                  onMouseLeave={() => setTip(null)}
                />
              )
            })}
            {layout.nodes.map((n) => {
              const s = statusAt(n.p, t)
              const f = ix.faction.get(n.group)
              const on = !neighbors || neighbors.has(n.id)
              const selected = sel?.type === 'person' && sel.id === n.id
              const gone = s === 'dead'
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  opacity={on ? 1 : 0.18}
                  style={{ cursor: 'pointer', transition: 'opacity .2s' }}
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => {
                    setHover(null)
                    setTip(null)
                  }}
                  onMouseMove={(e) => {
                    const rect = wrap.current!.getBoundingClientRect()
                    setTip({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                      content: (
                        <>
                          <b>{n.p.name}</b>
                          <small>{n.p.role1966}</small>
                          <div style={{ marginTop: 4 }}>此刻：{s ? STATUSES[s] : '—'}</div>
                        </>
                      ),
                    })
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    select({ type: 'person', id: n.id })
                  }}
                >
                  {selected && <circle r={n.r + 7} fill="none" stroke="var(--accent)" strokeWidth={2} />}
                  <circle r={n.r} fill={statusColor(s ?? 'normal')} stroke={f?.color} strokeWidth={n.p.tier === 1 ? 3.5 : 2.5} style={{ transition: 'fill .3s' }} />
                  {gone && <path d={`M${-n.r * 0.5},${-n.r * 0.5}L${n.r * 0.5},${n.r * 0.5}M${n.r * 0.5},${-n.r * 0.5}L${-n.r * 0.5},${n.r * 0.5}`} stroke="var(--card)" strokeWidth={1.4} />}
                  <text
                    y={n.r + 13}
                    textAnchor="middle"
                    fontSize={n.p.tier === 1 ? 13 : 11.5}
                    fontWeight={n.p.tier === 1 ? 600 : 400}
                    fill={gone ? 'var(--muted)' : 'var(--ink)'}
                    style={{ paintOrder: 'stroke', stroke: 'var(--paper)', strokeWidth: 3, pointerEvents: 'none' }}
                  >
                    {n.p.name}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>
        {tip}
        <div style={{ position: 'absolute', left: 16, bottom: 12, background: 'var(--card)', border: '1px solid var(--rule)', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>
          <div style={{ marginBottom: 6, color: 'var(--muted)' }}>
            此刻 {active.length} 条关系有效 · {ix.people.length} 人中：
          </div>
          <div style={{ display: 'flex', height: 8, width: 300, borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
            {(Object.keys(STATUSES) as (keyof typeof STATUSES)[]).map((k) => (
              <div key={k} title={`${STATUSES[k]} ${counts.get(k) ?? 0}`} style={{ width: `${((counts.get(k) ?? 0) / ix.people.length) * 100}%`, background: statusColor(k) }} />
            ))}
          </div>
          <StatusLegend />
        </div>
      </div>
    </div>
  )
}
