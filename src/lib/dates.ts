// Partial dates ("1966", "1966-05", "1966-05-16") ↔ fractional years.
// Also imported by the data build under plain Node, so this file must not import anything.

// Partial dates compare on their common prefix: "1966" is neither before nor after "1966-05".
export function after(a: string, b: string) {
  const n = Math.min(a.length, b.length)
  return a.slice(0, n) > b.slice(0, n)
}

export function toT(date: string | undefined, end = false): number {
  if (!date) return NaN
  const [y, m, d] = date.split('-').map(Number)
  if (m === undefined) return end ? y + 1 : y
  const monthStart = y + (m - 1) / 12
  if (d === undefined) return end ? monthStart + 1 / 12 : monthStart
  const days = new Date(y, m, 0).getDate()
  return monthStart + ((d - 1 + (end ? 1 : 0)) / days) / 12
}

export function fromT(t: number): { y: number; m: number; d: number } {
  const y = Math.floor(t)
  const mf = (t - y) * 12
  const m = Math.floor(mf) + 1
  const days = new Date(y, m, 0).getDate()
  const d = Math.min(days, Math.floor((mf - (m - 1)) * days) + 1)
  return { y, m, d }
}

export function fmtDate(date: string | undefined): string {
  if (!date) return ''
  const [y, m, d] = date.split('-')
  if (!m) return `${y}年`
  if (!d) return `${y}年${Number(m)}月`
  return `${y}年${Number(m)}月${Number(d)}日`
}

export function fmtRange(date: string, end?: string): string {
  if (!end) return fmtDate(date)
  const [y1, m1] = date.split('-')
  const [y2, m2, d2] = end.split('-')
  if (y1 === y2 && m1 === m2 && d2) return `${fmtDate(date)}–${Number(d2)}日`
  if (y1 === y2) return `${fmtDate(date)}–${fmtDate(end).slice(5)}`
  return `${fmtDate(date)}–${fmtDate(end)}`
}

export function fmtT(t: number, precision: 'day' | 'month' = 'day'): string {
  const { y, m, d } = fromT(t)
  return precision === 'month' ? `${y}年${m}月` : `${y}年${m}月${d}日`
}

export function tToDate(t: number): string {
  const { y, m, d } = fromT(t)
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function lifespan(born?: string, died?: string): string {
  const b = born?.slice(0, 4) ?? '?'
  return died ? `${b}–${died.slice(0, 4)}` : born ? `${b}–` : ''
}
