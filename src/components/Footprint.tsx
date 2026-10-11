import * as d3 from 'd3'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { useEffect, useRef, useState } from 'react'
import type { Index } from '../data/atlas'
import { STATUSES, type Person } from '../data/schema'
import { fmtDate, toT } from '../lib/dates'
import { segments } from '../lib/orgs'
import { useSize } from '../lib/useSize'
import { useApp } from '../state'
import { statusColor } from './bits'

type Basemap = FeatureCollection<Geometry, { n: string; k: 'p' | 'c' }>
let basemap: Promise<Basemap> | undefined
const loadBasemap = () => (basemap ??= fetch(`${import.meta.env.BASE_URL}geo/basemap.json`).then((r) => r.json()))

type Kind = 'birth' | 'post' | 'fate' | 'death'
type Stop = { at: string; t: number; date?: string; kind: Kind; what: string; color?: string }
// consecutive stops at one place, from the first stop until the next visit begins
type Visit = { at: string; t: number; until: number; stops: Stop[] }

// Birth, the seat of each post's org when the post began (and when the seat moved during it), fate
// nodes with a place, and death, in time order.
export function footprint(ix: Index, p: Person): Visit[] {
  const stops: Stop[] = []
  if (p.birthAt) stops.push({ at: p.birthAt, t: p.born ? toT(p.born) : -Infinity, date: p.born, kind: 'birth', what: '出生' })
  for (const pos of p.positions) {
    const o = pos.org ? ix.org.get(pos.org) : undefined
    if (!o || !pos.from || !o.places.length) continue
    const a = toT(pos.from)
    const b = pos.to ? toT(pos.to, true) : p.died ? toT(p.died, true) : Infinity
    for (const seg of segments(o.places, o.from ? toT(o.from) : -Infinity, o.to ? toT(o.to, true) : Infinity))
      if (seg.a < b && seg.b > a) {
        const t = Math.max(a, seg.a)
        stops.push({ at: seg.s.at, t, date: t === a ? pos.from : (seg.s.from ?? o.from), kind: 'post', what: pos.title.split('、')[0] })
      }
  }
  for (const f of p.fate)
    if (f.place) stops.push({ at: f.place, t: toT(f.date), date: f.date, kind: 'fate', what: f.note ?? STATUSES[f.s], color: statusColor(f.s) })
  if (p.deathAt) stops.push({ at: p.deathAt, t: p.died ? toT(p.died) : Infinity, date: p.died, kind: 'death', what: '去世' })
  stops.sort((u, v) => u.t - v.t)
  const visits: Visit[] = []
  for (const s of stops) {
    const last = visits[visits.length - 1]
    if (last && last.at === s.at) last.stops.push(s)
    else visits.push({ at: s.at, t: s.t, until: Infinity, stops: [s] })
  }
  visits.forEach((v, i) => (v.until = visits[i + 1]?.t ?? (p.died ? toT(p.died, true) : Infinity)))
  return visits
}

const KIND_LABEL: Record<Kind, string> = { birth: '出生', post: '任职', fate: '命运', death: '去世' }

export function Footprint({ p }: { p: Person }) {
  const { ix, t, setT } = useApp()
  const wrap = useRef<HTMLDivElement>(null)
  const { width } = useSize(wrap)
  const [map, setMap] = useState<Basemap>()
  useEffect(() => {
    loadBasemap().then(setMap)
  }, [])

  const visits = footprint(ix, p)
  const near = visits.filter((v) => !ix.place.get(v.at)?.far)
  const far = visits.filter((v) => ix.place.get(v.at)?.far)
  const now = [...visits].reverse().find((v) => v.t <= t && t < v.until)
  if (near.length < 1) return <p className="muted-note">没有可定位的地点。</p>

  const W = Math.max(240, width)
  const H = Math.round(W * 0.78)
  const coords = near.map((v) => {
    const pl = ix.place.get(v.at)!
    return [pl.lon, pl.lat] as [number, number]
  })
  // fit the visited places, but never closer than about 14° × 9°, so a career spent in one city still shows the region
  const lons = coords.map((c) => c[0])
  const lats = coords.map((c) => c[1])
  const cx = (Math.min(...lons) + Math.max(...lons)) / 2
  const cy = (Math.min(...lats) + Math.max(...lats)) / 2
  const hw = Math.max(7, (Math.max(...lons) - Math.min(...lons)) / 2 + 1.5)
  const hh = Math.max(4.5, (Math.max(...lats) - Math.min(...lats)) / 2 + 1.5)
  const frame: Feature = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'MultiPoint', coordinates: [[cx - hw, cy - hh], [cx + hw, cy - hh], [cx - hw, cy + hh], [cx + hw, cy + hh], [cx, cy - hh], [cx, cy + hh]] },
  }
  const proj = d3.geoConicEqualArea().parallels([25, 47]).rotate([-105, 0]).fitExtent([[14, 14], [W - 14, H - 14]], frame)
  const path = d3.geoPath(proj)
  const xy = (id: string) => {
    const pl = ix.place.get(id)!
    return proj([pl.lon, pl.lat]) ?? [0, 0]
  }

  // route: one arc per move, bowed to the left so a return trip does not retrace the outward line
  const arcs: string[] = []
  for (let i = 1; i < near.length; i++) {
    const [x0, y0] = xy(near[i - 1].at)
    const [x1, y1] = xy(near[i].at)
    const mx = (x0 + x1) / 2 - (y1 - y0) * 0.18
    const my = (y0 + y1) / 2 + (x1 - x0) * 0.18
    arcs.push(`M${x0},${y0}Q${mx},${my} ${x1},${y1}`)
  }

  // label each place once, greedily skipping labels that would collide
  const placed: { x: number; y: number; w: number }[] = []
  const labels = [...new Set(near.map((v) => v.at))].flatMap((id) => {
    const [x, y] = xy(id)
    const name = ix.place.get(id)!.name.replace(/（.*）/, '')
    const w = name.length * 11 + 4
    const lx = x + 6 > W - w ? x - 6 - w : x + 6
    if (placed.some((q) => Math.abs(q.x - lx) < (q.w + w) / 2 + 2 && Math.abs(q.y - y) < 12)) return []
    placed.push({ x: lx + w / 2, y, w })
    return [{ id, x: lx, y, name }]
  })

  const kindOf = (v: Visit): Kind => (v.stops.some((s) => s.kind === 'death') ? 'death' : v.stops.some((s) => s.kind === 'birth') ? 'birth' : v.stops.some((s) => s.kind === 'fate') ? 'fate' : 'post')

  return (
    <div className="footprint" ref={wrap}>
      <svg width={W} height={H} className="fp-map" role="img" aria-label={`${p.name}的足迹地图`}>
        <rect width={W} height={H} fill="var(--card)" />
        {map?.features.map((f, i) => (
          <path key={i} d={path(f) ?? ''} fill={f.properties.k === 'p' ? 'var(--paper-2)' : 'var(--paper)'} stroke="var(--rule-2)" strokeWidth={f.properties.k === 'p' ? 0.6 : 0.4} />
        ))}
        {arcs.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--ink-2)" strokeOpacity={0.55} strokeWidth={1.1} markerEnd="url(#fp-arrow)" />
        ))}
        <defs>
          <marker id="fp-arrow" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={5} markerHeight={5} orient="auto">
            <path d="M0,0L6,3L0,6Z" fill="var(--ink-2)" fillOpacity={0.7} />
          </marker>
        </defs>
        {[...new Set(near.map((v) => v.at))].map((id) => {
          const [x, y] = xy(id)
          const vs = near.filter((v) => v.at === id)
          const k = vs.map(kindOf).includes('death') ? 'death' : vs.map(kindOf).includes('birth') ? 'birth' : vs.map(kindOf).includes('fate') ? 'fate' : 'post'
          const fateColor = vs.flatMap((v) => v.stops).find((s) => s.kind === 'fate')?.color
          return (
            <g key={id} transform={`translate(${x},${y})`}>
              <title>{`${ix.place.get(id)!.name}：${vs.flatMap((v) => v.stops).map((s) => `${s.date ? fmtDate(s.date) : ''} ${s.what}`).join('；')}`}</title>
              {k === 'birth' && <circle r={4} fill="var(--card)" stroke="var(--ink)" strokeWidth={1.5} />}
              {k === 'post' && <circle r={3} fill="var(--ink-2)" />}
              {k === 'fate' && <rect x={-3.5} y={-3.5} width={7} height={7} fill={fateColor} stroke="var(--card)" strokeWidth={0.8} />}
              {k === 'death' && <circle r={4} fill="var(--ink)" stroke="var(--card)" strokeWidth={1} />}
            </g>
          )
        })}
        {labels.map((l) => (
          <text key={l.id} x={l.x} y={l.y + 4} fontSize={10.5} fill="var(--ink-2)" stroke="var(--paper)" strokeWidth={3} paintOrder="stroke">
            {l.name}
          </text>
        ))}
        {now && !ix.place.get(now.at)?.far && (
          <g transform={`translate(${xy(now.at).join(',')})`} pointerEvents="none">
            <circle r={9} fill="none" stroke="var(--accent)" strokeWidth={1.6} />
            <circle r={13} fill="none" stroke="var(--accent)" strokeOpacity={0.35} strokeWidth={1} />
          </g>
        )}
      </svg>
      <ol className="minilist fp-list">
        {visits.map((v, i) => {
          const pl = ix.place.get(v.at)!
          return (
            <li key={i} data-now={v === now || undefined}>
              <button className="linklike" onClick={() => Number.isFinite(v.t) && setT(v.t)}>
                <time>{v.stops[0].date ? fmtDate(v.stops[0].date) : '?'}</time>
                <b>{pl.name}</b>
                {pl.far && <span className="far">（图外）</span>}
              </button>
              <div className="fp-what">
                {v.stops.slice(0, 3).map((s, j) => (
                  <span key={j}>
                    {j > 0 && '；'}
                    {s.kind !== 'post' && <em>{KIND_LABEL[s.kind]} </em>}
                    {s.kind === 'birth' || s.kind === 'death' ? '' : s.what}
                  </span>
                ))}
                {v.stops.length > 3 && `；等 ${v.stops.length} 项`}
              </div>
            </li>
          )
        })}
      </ol>
      <p className="muted-note">
        {far.length > 0 && `${far.map((v) => ix.place.get(v.at)!.name).join('、')}在图外，只列不画。`}
        驻地按所任职机构推定，坐标为近似值；底图是今日省界（Natural Earth），只作定位。红圈为此刻所在。
      </p>
    </div>
  )
}
