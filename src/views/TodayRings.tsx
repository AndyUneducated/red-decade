// 年轮表盘: one ring per year, 1949 at the centre and 1989 outside. Every dated item in the library is a faint
// dot at its day of the year on its year's ring; the dial turns so the chosen day sits under the hand at the top,
// where that day's items light up.
import { useMemo, useRef, useState, type MouseEvent } from 'react'
import { DAYS, FIRST_YEAR, KIND_COLOR, LAST_YEAR, type DayItem } from '../derive/today'
import { useSize } from '../lib/useSize'

const YEARS = LAST_YEAR - FIRST_YEAR + 1
const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
const MONTH_START = MONTHS.map((_, m) => DAYS.indexOf(`${String(m + 1).padStart(2, '0')}-01`))
const LABEL_YEARS = [1949, 1959, 1966, 1976, 1989]
// the focus decade of the site, drawn as a faint band
const BAND: [number, number] = [1966, 1976]
const PHONE = 520
// the fading wedge behind the hand, in 2° slices
const SWEEP = 14

const deg = (day: string) => (DAYS.indexOf(day) / DAYS.length) * 360

type Props = {
  day: string
  // every item of the year by day, already filtered to the personal view if there is one
  index: Map<string, DayItem[]>
  items: DayItem[]
  focus?: number
  onFocus: (year: number | undefined) => void
  onDay: (day: string) => void
  title: string
  sub: string
}

export function TodayRings({ day, index, items, focus, onFocus, onDay, title, sub }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const { width } = useSize(wrap)
  const S = Math.max(280, Math.min(width || 560, 620))
  const phone = (width || 560) < PHONE
  const c = S / 2
  const R0 = S * 0.18
  const R1 = S * (phone ? 0.43 : 0.435)
  const step = (R1 - R0) / YEARS
  const r = (year: number) => R0 + (year - FIRST_YEAR + 0.5) * step

  // the dial turns the short way round, so Dec 31 → Jan 1 is one step and not a full turn back
  const [rot, setRot] = useState({ day, deg: -deg(day) })
  if (rot.day !== day) {
    let t = -deg(day)
    while (t - rot.deg > 180) t -= 360
    while (t - rot.deg < -180) t += 360
    setRot({ day, deg: t })
  }

  // faint dots: how many items each ring has on each day (phones bin a few days together)
  const bin = phone ? 4 : 1
  const texture = useMemo(() => {
    const n = new Map<string, number>()
    DAYS.forEach((d, i) => {
      for (const it of index.get(d) ?? []) {
        const k = `${it.date.slice(0, 4)}:${Math.floor(i / bin)}`
        n.set(k, (n.get(k) ?? 0) + 1)
      }
    })
    return [...n].map(([k, v]) => {
      const [y, b] = k.split(':').map(Number)
      return { y, a: (((b + 0.5) * bin) / DAYS.length) * 2 * Math.PI, v }
    })
  }, [index, bin])

  // today's items on their rings, spread a little along the ring when a year has several
  const byYear = useMemo(() => {
    const m = new Map<number, DayItem[]>()
    for (const it of items) m.set(+it.date.slice(0, 4), [...(m.get(+it.date.slice(0, 4)) ?? []), it])
    return m
  }, [items])
  const lit = [...byYear].flatMap(([y, xs]) =>
    xs.slice(0, 9).map((it, j) => {
      const a = ((j - (Math.min(xs.length, 9) - 1) / 2) * step * 1.6) / r(y)
      return { it, y, x: c + r(y) * Math.sin(a), yy: c - r(y) * Math.cos(a) }
    }),
  )

  const at = (e: MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const k = S / box.width
    const dx = (e.clientX - box.left) * k - c
    const dy = (e.clientY - box.top) * k - c
    const dist = Math.hypot(dx, dy)
    const year = dist >= R0 && dist <= R1 ? FIRST_YEAR + Math.floor((dist - R0) / step) : undefined
    const screen = (Math.atan2(dx, -dy) * 180) / Math.PI
    const onDial = (((screen - rot.deg) % 360) + 360) % 360
    return { year, day: DAYS[Math.round((onDial / 360) * DAYS.length) % DAYS.length], inside: dist <= R1 + step * 4 }
  }

  const pt = (rad: number, a: number) => [c + rad * Math.sin(a), c - rad * Math.cos(a)] as const

  return (
    <div ref={wrap} className="rings">
      <svg
        className="rings-svg"
        viewBox={`0 0 ${S} ${S}`}
        width={S}
        height={S}
        role="img"
        aria-label={`${title}：${FIRST_YEAR}–${LAST_YEAR} 年同一天的年轮表盘`}
        onPointerMove={phone ? undefined : (e) => onFocus(at(e).year)}
        onPointerLeave={phone ? undefined : () => onFocus(undefined)}
        onClick={(e) => {
          const p = at(e)
          if (p.inside && p.day && p.day !== day) onDay(p.day)
        }}
      >
        <defs>
          <filter id="rings-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation={phone ? 2 : 3} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="rings-face">
            <stop offset="35%" stopColor="var(--card)" />
            <stop offset="100%" stopColor="var(--paper-2)" />
          </radialGradient>
          <radialGradient id="rings-core">
            <stop offset="0%" stopColor="var(--card)" />
            <stop offset="100%" stopColor="var(--paper)" />
          </radialGradient>
        </defs>
        <circle cx={c} cy={c} r={R1 + step * 3} className="rings-face" />
        <circle cx={c} cy={c} r={(r(BAND[0]) + r(BAND[1])) / 2} strokeWidth={r(BAND[1]) - r(BAND[0]) + step} className="rings-band" />
        {Array.from({ length: YEARS }, (_, i) => FIRST_YEAR + i).map((y) => (
          <circle
            key={y}
            cx={c}
            cy={c}
            r={r(y)}
            className="rings-ring"
            data-decade={y % 10 === 0 || undefined}
            data-lit={byYear.has(y) || undefined}
            data-on={y === focus || undefined}
          />
        ))}
        <g className="rings-dial" style={{ transform: `rotate(${rot.deg}deg)`, transformOrigin: `${c}px ${c}px` }}>
          {texture.map(({ y, a, v }) => {
            const [x, yy] = pt(r(y), a)
            return <circle key={`${y}:${a}`} cx={x} cy={yy} r={Math.min(step * 0.42, 0.7 + v * 0.35)} className="rings-dot" style={{ opacity: Math.min(0.85, 0.22 + v * 0.12) }} />
          })}
          {DAYS.map((_, i) => {
            const a = (i / DAYS.length) * 2 * Math.PI
            const [x1, y1] = pt(R1 + step * 1.1, a)
            const [x2, y2] = pt(R1 + step * (i % 7 ? 1.6 : 2), a)
            return phone && i % 7 ? null : <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="rings-bezel" />
          })}
          {MONTH_START.map((d, m) => {
            const a = (d / DAYS.length) * 2 * Math.PI
            const [x1, y1] = pt(R1 + step * 0.6, a)
            const [x2, y2] = pt(R1 + step * 2.6, a)
            const [lx, ly] = pt(R1 + step * 3.2 + (phone ? 6 : 10), a + (15 / DAYS.length) * 2 * Math.PI)
            return (
              <g key={m}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} className="rings-tick" />
                <text x={lx} y={ly} className="rings-month" textAnchor="middle" dominantBaseline="middle" style={{ transform: `rotate(${-rot.deg}deg)`, transformOrigin: `${lx}px ${ly}px` }}>
                  {phone ? m + 1 : MONTHS[m]}
                </text>
              </g>
            )
          })}
        </g>
        {Array.from({ length: SWEEP }, (_, i) => {
          const a0 = (-(i + 1) * 2 * Math.PI) / 180
          const a1 = (-i * 2 * Math.PI) / 180
          const [x0, y0] = pt(R1, a0)
          const [x1, y1] = pt(R1, a1)
          const [u0, v0] = pt(R0, a0)
          const [u1, v1] = pt(R0, a1)
          return (
            <path
              key={i}
              className="rings-sweep"
              d={`M${u0},${v0}L${x0},${y0}A${R1},${R1} 0 0,1 ${x1},${y1}L${u1},${v1}A${R0},${R0} 0 0,0 ${u0},${v0}Z`}
              style={{ opacity: 0.16 * (1 - i / SWEEP) }}
            />
          )
        })}
        <line x1={c} y1={c - R0 + step} x2={c} y2={c - R1 - step * 3} className="rings-hand" />
        <g key={day} className="rings-lit">
          {lit.map(({ it, y, x, yy }, i) => (
            <g
              key={`${it.kind}:${it.id}:${i}`}
              style={{ color: KIND_COLOR[it.kind], animationDelay: `${(y - FIRST_YEAR) * 14}ms` }}
              data-on={y === focus || undefined}
              onClick={(e) => {
                e.stopPropagation()
                onFocus(y === focus && phone ? undefined : y)
              }}
            >
              <circle cx={x} cy={yy} r={Math.max(3.5, step * (y === focus ? 1.4 : 1.05))} className="rings-halo" style={{ animationDelay: `${((y * 7) % 13) * 120}ms` }} />
              <circle cx={x} cy={yy} r={Math.max(3, step * (y === focus ? 1.15 : 0.85))} className="rings-glow" filter="url(#rings-glow)" />
            </g>
          ))}
        </g>
        {LABEL_YEARS.map((y) => (
          <text key={y} x={c - 9} y={c - r(y)} className="rings-year" textAnchor="end" dominantBaseline="middle" data-on={y === focus || undefined}>
            {y}
          </text>
        ))}
        {focus && !LABEL_YEARS.includes(focus) && (
          <text x={c - 9} y={c - r(focus)} className="rings-year" textAnchor="end" dominantBaseline="middle" data-on>
            {focus}
          </text>
        )}
        <circle cx={c} cy={c} r={R0 - step * 0.6} fill="url(#rings-core)" className="rings-core" />
        <text x={c} y={c - S * 0.012} className="rings-date" textAnchor="middle" style={{ fontSize: S * 0.072 }}>
          {title}
        </text>
        <text x={c} y={c + S * 0.05} className="rings-sub" textAnchor="middle" style={{ fontSize: Math.max(10, S * 0.022) }}>
          {sub}
        </text>
      </svg>
    </div>
  )
}
