import type { Person, Status } from '../data/schema'
import { STATUSES } from '../data/schema'
import { fmtDate, toT } from '../lib/dates'
import { statusColor } from './bits'

export type Seg = { a: number; b: number; s: Status; date?: string; note?: string }

// Status over a whole life: 'normal' from birth until the first fate node, each node holds until the next, death ends it.
export function lifeSegments(p: Person, until: number): Seg[] {
  const start = p.born ? toT(p.born) : p.fate[0] ? toT(p.fate[0].date) : NaN
  if (!Number.isFinite(start)) return []
  const end = p.died ? toT(p.died) : until
  const segs: Seg[] = []
  let cur: Seg = { a: start, b: end, s: 'normal' }
  for (const f of p.fate) {
    const t = toT(f.date)
    if (f.s === 'dead') break
    if (t <= cur.a) {
      cur = { ...cur, s: f.s, date: f.date, note: f.note }
      continue
    }
    segs.push({ ...cur, b: t })
    cur = { a: t, b: end, s: f.s, date: f.date, note: f.note }
  }
  segs.push({ ...cur, b: end })
  return segs.filter((s) => s.b > s.a)
}

type Props = {
  p: Person
  x: (t: number) => number
  T1: number
  height: number
  width: number
  ticks?: number[]
}

export function LifeStrip({ p, x, T1, height, width, ticks }: Props) {
  const segs = lifeSegments(p, T1)
  const axis = ticks ? 14 : 0
  return (
    <svg width={width} height={height + axis} style={{ display: 'block', overflow: 'visible' }}>
      {ticks?.map((yr) => (
        <g key={yr}>
          <line x1={x(yr)} x2={x(yr)} y1={0} y2={height + 3} stroke="var(--rule)" />
          <text x={x(yr)} y={height + axis} textAnchor="middle" fontSize={10} fill="var(--muted)">
            {yr}
          </text>
        </g>
      ))}
      {segs.map((s, i) => (
        <rect key={i} x={x(s.a)} y={0} width={Math.max(1, x(s.b) - x(s.a))} height={height} fill={statusColor(s.s)} opacity={s.s === 'normal' ? 0.7 : 1}>
          <title>
            {STATUSES[s.s]}
            {s.date ? ` · ${fmtDate(s.date)}起` : ''}
            {s.note ? ` · ${s.note}` : ''}
          </title>
        </rect>
      ))}
      {p.died && <rect x={x(toT(p.died)) - 1} y={-2} width={2} height={height + 4} fill="var(--s-dead)" />}
    </svg>
  )
}
