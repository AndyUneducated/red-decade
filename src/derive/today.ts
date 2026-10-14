// 历史上的今天 (M9): everything dated to one day of the year between 1949 and 1989. Only full dates count; an
// event dated "1966-08" belongs to no single day.
import type { Index } from '../data/atlas.ts'
import type { Status } from '../data/schema.ts'

export const FIRST_YEAR = 1949
export const LAST_YEAR = 1989

export type DayItem =
  | { kind: 'event'; date: string; id: string }
  | { kind: 'doc'; date: string; id: string }
  | { kind: 'born' | 'died'; date: string; id: string }
  | { kind: 'fate'; date: string; id: string; s: Status; note?: string }
  | { kind: 'archive'; date: string; id: string }

export const KIND_COLOR: Record<DayItem['kind'], string> = {
  event: 'var(--accent)',
  doc: 'var(--sys-gov)',
  archive: 'var(--org-popular)',
  fate: 'var(--org-mass)',
  died: 'var(--ink-2)',
  born: 'var(--sys-army)',
}

// "MM-DD" for every day of a leap year, January 1 first
export const DAYS: string[] = Array.from({ length: 366 }, (_, i) => {
  const d = new Date(2000, 0, 1 + i)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

export const isDay = (s: string | undefined): s is string => !!s && DAYS.includes(s)

export function dayOf(date: string | undefined): string | undefined {
  if (!date || date.length !== 10) return
  const y = +date.slice(0, 4)
  return y >= FIRST_YEAR && y <= LAST_YEAR ? date.slice(5) : undefined
}

const cache = new WeakMap<Index, Map<string, DayItem[]>>()

// items by "MM-DD", each list ordered by date
export function dayIndex(ix: Index): Map<string, DayItem[]> {
  const hit = cache.get(ix)
  if (hit) return hit
  const m = new Map<string, DayItem[]>()
  const add = (it: DayItem) => {
    const d = dayOf(it.date)
    if (d) m.set(d, [...(m.get(d) ?? []), it])
  }
  for (const e of ix.events) add({ kind: 'event', date: e.date, id: e.id })
  for (const s of ix.sources) if (s.hasText) add({ kind: 'doc', date: s.date, id: s.id })
  for (const p of ix.people) {
    if (p.born) add({ kind: 'born', date: p.born, id: p.id })
    if (p.died) add({ kind: 'died', date: p.died, id: p.id })
    // a death is already listed as 'died'
    for (const f of p.fate) if (f.s !== 'dead') add({ kind: 'fate', date: f.date, id: p.id, s: f.s, note: f.note })
  }
  // a People's Daily page is already there as its articles
  for (const a of ix.archive) if (!a.id.startsWith('rmrb-page-')) add({ kind: 'archive', date: a.date, id: a.id })
  for (const xs of m.values()) xs.sort((a, b) => a.date.localeCompare(b.date))
  cache.set(ix, m)
  return m
}

export function todayKey(now = new Date()): string {
  return `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function shiftDay(day: string, by: number): string {
  const i = DAYS.indexOf(day)
  return DAYS[(((i + by) % DAYS.length) + DAYS.length) % DAYS.length]
}
