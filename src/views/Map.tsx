import * as d3 from 'd3'
import type { FeatureCollection, Geometry } from 'geojson'
import { useEffect, useRef, useState } from 'react'
import { Cite } from '../components/bits'
import { LANES, REVCOM_DATES, type Revcom } from '../data/schema'
import { fmtDate, fmtT, toT } from '../lib/dates'
import { useSize } from '../lib/useSize'
import { useApp } from '../state'

type Basemap = FeatureCollection<Geometry, { n: string; k: 'p' | 'c' }>
let basemap: Promise<Basemap> | undefined
const loadBasemap = () => (basemap ??= fetch(`${import.meta.env.BASE_URL}geo/basemap.json`).then((r) => r.json()))

const T0 = 1966 + 8 / 12
const T1 = 1969 + 6 / 12
// an event stays on the map this long after its date, fading out
const FADE = 0.5
// a committee counts as new, and is outlined, for this long after its date
const FRESH = 1.5 / 12

const short = (n: string) => n.replace(/(壮族|回族|维吾尔)?自治区$|省$|市$/, '')
// labels that would sit on top of a neighbour, nudged in screen pixels
const NUDGE: Record<string, [number, number]> = { 北京市: [-14, -8], 天津市: [16, 4], 上海市: [20, 2], 河北省: [-14, 18], 香港: [0, 0], 澳门: [0, 0] }

function Played({ t, setT }: { t: number; setT: (t: number) => void }) {
  const [playing, setPlaying] = useState(false)
  const tRef = useRef(t)
  tRef.current = t
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      const next = tRef.current + 1 / 52
      if (next >= 1968 + 9 / 12) setPlaying(false)
      setT(Math.min(next, 1968 + 9 / 12))
    }, 110)
    return () => clearInterval(id)
  }, [playing, setT])
  return (
    <div className="map-play">
      <button
        className="chip"
        onClick={() => {
          if (!playing && (t < 1967 || t >= 1968 + 9 / 12)) setT(1967)
          setPlaying(!playing)
        }}
      >
        {playing ? '暂停' : '播放 1967–1968'}
      </button>
      <input type="range" min={T0} max={T1} step={1 / 365} value={Math.min(T1, Math.max(T0, t))} onChange={(e) => (setPlaying(false), setT(Number(e.target.value)))} aria-label="时间" />
      <b>{fmtT(t)}</b>
    </div>
  )
}

function Cumulative({ revcoms, t, setT }: { revcoms: Revcom[]; t: number; setT: (t: number) => void }) {
  const { ix } = useApp()
  const wrap = useRef<HTMLDivElement>(null)
  const { width } = useSize(wrap)
  const W = Math.max(320, width)
  const H = 150
  const m = { l: 34, r: 12, t: 12, b: 24 }
  const x = d3.scaleLinear([1967, T1], [m.l, W - m.r])
  const y = d3.scaleLinear([0, 1], [H - m.b, m.t])
  const sd = ix.counties.filter((u) => u.province === '山东' && u.revcom).map((u) => toT(u.revcom!.date))
  const series = [
    { name: `省级（${revcoms.length} 个）`, ts: revcoms.map((r) => toT(r.date)), color: 'var(--accent)' },
    { name: `山东各县市区（据县志，${sd.length} 个有日期）`, ts: sd, color: 'var(--ink-2)' },
  ]
  const step = (ts: number[]) => {
    const s = [...ts].sort((a, b) => a - b)
    let d = `M${x(1967)},${y(0)}`
    s.forEach((v, i) => (d += `H${x(Math.max(1967, v))}V${y((i + 1) / s.length)}`))
    return d + `H${x(T1)}`
  }
  return (
    <div className="map-cum" ref={wrap}>
      <svg
        width={W}
        height={H}
        onClick={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          setT(Math.min(T1, Math.max(1967, x.invert(e.clientX - r.left))))
        }}
        style={{ cursor: 'pointer' }}
        role="img"
        aria-label="革命委员会累计成立比例"
      >
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke="var(--rule)" />
            <text x={m.l - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill="var(--muted)">
              {v * 100}%
            </text>
          </g>
        ))}
        {[1967, 1967.5, 1968, 1968.5, 1969].map((v) => (
          <text key={v} x={x(v)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--muted)">
            {Number.isInteger(v) ? `${v}年` : '7月'}
          </text>
        ))}
        {series.map((s) => (
          <path key={s.name} d={step(s.ts)} fill="none" stroke={s.color} strokeWidth={1.8} />
        ))}
        {t >= 1967 && t <= T1 && <line x1={x(t)} x2={x(t)} y1={m.t - 4} y2={H - m.b} stroke="var(--accent)" strokeDasharray="3 3" />}
      </svg>
      <div className="legend">
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  )
}

function Row({ r, on, onPick }: { r: Revcom; on: boolean; onPick: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="map-row" data-on={on || undefined}>
      <button className="linklike" onClick={onPick}>
        <time>{fmtDate(r.date).replace(/^\d+年/, '')}</time>
        <b>{short(r.province)}</b>
      </button>
      <span className="map-kind" data-kind={r.kind}>
        {REVCOM_DATES[r.kind]}
      </span>
      <button className="linklike map-q" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? '收起' : '原文'}
      </button>
      {open && (
        <div className="map-quote">
          <q className="fig-quote">{r.quote}</q> <Cite cite={r.cite} />
          {r.note && <p className="muted-note">{r.note}</p>}
        </div>
      )}
    </li>
  )
}

export function MapView() {
  const { ix, t, setT, select } = useApp()
  const wrap = useRef<HTMLDivElement>(null)
  const { width } = useSize(wrap)
  const [map, setMap] = useState<Basemap>()
  useEffect(() => {
    loadBasemap().then(setMap)
  }, [])

  const revcoms = ix.revcoms
  const byProv = new Map(revcoms.map((r) => [r.province, r]))
  const done = revcoms.filter((r) => toT(r.date) <= t)
  const W = Math.max(300, width)
  const H = Math.round(W * 0.8)
  const proj = d3.geoConicEqualArea().parallels([25, 47]).rotate([-105, 0])
  if (map) proj.fitExtent([[8, 8], [W - 8, H - 8]], { type: 'FeatureCollection', features: map.features.filter((f) => f.properties.k === 'p') })
  const path = d3.geoPath(proj)

  const events = ix.events
    .filter((e) => e.at && !ix.place.get(e.at)?.far)
    .map((e) => ({ e, t0: toT(e.date) }))
    .filter(({ t0 }) => t0 <= t && t - t0 < FADE)

  return (
    <div className="view">
      <div className="research map-view">
        <div className="viewhead" style={{ padding: '0 0 14px', border: 0 }}>
          <div>
            <h1>革委会地图</h1>
            <p>
              1967 年 1 月黑龙江到 1968 年 9 月西藏、新疆，29 个省级革命委员会依次建立，“全国山河一片红”用了一年零八个月。日期一律照当时《人民日报》报道正文；多数报道只写庆祝大会之日，单独标出。圆点是此前半年内有地点的事件，逐渐淡出，点开看详情。
            </p>
          </div>
        </div>
        <Played t={t} setT={setT} />
        <div className="map-grid">
          <div className="map-canvas" ref={wrap}>
            <svg width={W} height={H} role="img" aria-label="省级革命委员会成立地图">
              <rect width={W} height={H} fill="var(--card)" />
              {map?.features.map((f, i) => {
                const r = byProv.get(f.properties.n)
                const t0 = r ? toT(r.date) : Infinity
                const on = t0 <= t
                const fresh = on && t - t0 < FRESH
                return (
                  <path
                    key={i}
                    d={path(f) ?? ''}
                    fill={f.properties.k === 'c' ? 'var(--paper)' : on ? 'var(--accent)' : 'var(--paper-2)'}
                    fillOpacity={on ? (fresh ? 0.85 : 0.42) : 1}
                    stroke={fresh ? 'var(--accent)' : 'var(--rule-2)'}
                    strokeWidth={fresh ? 1.6 : f.properties.k === 'p' ? 0.6 : 0.4}
                    strokeDasharray={on && r?.kind === 'seized' ? '3 2' : undefined}
                    style={r ? { cursor: 'pointer' } : undefined}
                    onClick={r ? () => setT(t0 + 1 / 365) : undefined}
                  >
                    {r && <title>{`${r.province}：${fmtDate(r.date)}${REVCOM_DATES[r.kind]}`}</title>}
                  </path>
                )
              })}
              {map?.features
                .filter((f) => f.properties.k === 'p' && byProv.has(f.properties.n))
                .map((f) => {
                  const [cx, cy] = path.centroid(f)
                  const [dx, dy] = NUDGE[f.properties.n] ?? [0, 0]
                  const r = byProv.get(f.properties.n)!
                  const on = toT(r.date) <= t
                  return (
                    <text
                      key={f.properties.n}
                      x={cx + dx}
                      y={cy + dy}
                      textAnchor="middle"
                      fontSize={W < 520 ? 9 : 10.5}
                      fill={on ? 'var(--ink)' : 'var(--muted)'}
                      stroke="var(--card)"
                      strokeWidth={2.5}
                      paintOrder="stroke"
                      pointerEvents="none"
                    >
                      {short(f.properties.n)}
                    </text>
                  )
                })}
              {events.map(({ e, t0 }) => {
                const pl = ix.place.get(e.at!)!
                const [x, y] = proj([pl.lon, pl.lat]) ?? [0, 0]
                const fade = 1 - (t - t0) / FADE
                return (
                  <g key={e.id} transform={`translate(${x},${y})`} style={{ cursor: 'pointer' }} onClick={() => select({ type: 'event', id: e.id }, true)}>
                    <title>{`${fmtDate(e.date)} ${e.title}（${LANES[e.lane]}）`}</title>
                    <circle r={2 + e.weight * 1.6} fill="var(--ink)" fillOpacity={0.25 + 0.6 * fade} stroke="var(--card)" strokeWidth={0.8} />
                  </g>
                )
              })}
              <text x={W - 10} y={H - 10} textAnchor="end" fontSize={10} fill="var(--muted)">
                底图为今日省界，只作定位
              </text>
            </svg>
          </div>
          <aside className="map-side">
            <div className="map-count">
              <b>{done.length}</b> / {revcoms.length} 个省级革委会
            </div>
            <ol className="map-list">
              {revcoms.flatMap((r, i) => [
                ...(r.date.slice(0, 4) !== revcoms[i - 1]?.date.slice(0, 4) ? [<li key={r.date.slice(0, 4)} className="map-year">{r.date.slice(0, 4)} 年</li>] : []),
                <Row key={r.province} r={r} on={toT(r.date) <= t} onPick={() => setT(toT(r.date) + 1 / 365)} />,
              ])}
            </ol>
          </aside>
        </div>
        <h2 className="sec" style={{ marginTop: 22 }}>
          累计成立比例
        </h2>
        <Cumulative revcoms={revcoms} t={t} setT={setT} />
        <p className="muted-note">
          山东各县的日期取自 1980–2000 年代编成的县志（见“数字争议”下方的按县登记），口径与省级不同：县志多写成立之月，少数写到日。贵州未见当时的成立报道，只按 1979 年中共中央批示记 1967 年 1 月 25 日夺权，虚线描边。
        </p>
      </div>
    </div>
  )
}
