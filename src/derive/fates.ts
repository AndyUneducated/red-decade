// Fate sequences read as data: when a person fell, survival curves over a group, and a yearly state code
// for comparing two lives. Pure; times are fractional years from lib/dates.
import type { DeathKind, Person, Status } from '../data/schema.ts'
import { toT } from '../lib/dates.ts'

export const UNNATURAL: ReadonlySet<DeathKind> = new Set(['persecuted', 'suicide', 'killed', 'executed'])
const DOWN: ReadonlySet<Status> = new Set(['purged', 'detained', 'dead'])

// fate nodes at or after t0 whose status is in `falls`, and a death that was not natural
export function fallsSince(p: Person, t0: number, falls: ReadonlySet<Status>): Person['fate'] {
  return p.fate.filter((f) => toT(f.date) >= t0 && (falls.has(f.s) || (f.s === 'dead' && !!p.deathKind && UNNATURAL.has(p.deathKind))))
}

export function firstFall(p: Person, t0: number, falls: ReadonlySet<Status>): number | undefined {
  const f = fallsSince(p, t0, falls)[0]
  return f && toT(f.date)
}

// t is the fall, or the end of observation (natural death or t1) when fell is false
export type Subject = { t: number; fell: boolean }

// undefined when the person cannot fall in [t0, t1]: no fate recorded, not yet born, or already down at t0
export function survivalSubject(p: Person, t0: number, t1: number, falls: ReadonlySet<Status>): Subject | undefined {
  if (!p.fate.length) return
  if (p.born && toT(p.born) > t0) return
  if (p.died && toT(p.died) < t0) return
  const before = p.fate.filter((f) => toT(f.date) < t0).at(-1)
  if (before && DOWN.has(before.s)) return
  const fall = firstFall(p, t0, falls)
  if (fall !== undefined && fall <= t1) return { t: fall, fell: true }
  return { t: p.died ? Math.min(toT(p.died), t1) : t1, fell: false }
}

// A coarse state for each year, to compare two lives: in power, ordinary, under attack, down, dead. null where
// nothing is known (not yet born, or before the first fate node when the birth date is missing).
export type Code = 'up' | 'normal' | 'hit' | 'down' | 'dead' | null
const CODE: Record<Status, Exclude<Code, null>> = {
  normal: 'normal',
  restored: 'normal',
  rise: 'up',
  power: 'up',
  attacked: 'hit',
  sidelined: 'hit',
  purged: 'down',
  detained: 'down',
  dead: 'dead',
}

export function yearCodes(p: Person, years: number[]): Code[] {
  return years.map((y) => {
    const t = y + 0.5
    if (p.died && toT(p.died) <= t) return 'dead'
    if (p.born ? toT(p.born) > t : !p.fate.length || toT(p.fate[0].date) > t) return null
    let s: Status | undefined
    for (const f of p.fate) {
      if (toT(f.date) > t) break
      s = f.s
    }
    return s ? CODE[s] : 'normal'
  })
}

// share of years in which the two differ, over the years at least one of them is alive and both are known;
// undefined when fewer than `min` such years
export function lifeDistance(a: Code[], b: Code[], min = 10): number | undefined {
  let n = 0
  let d = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] === null || b[i] === null || (a[i] === 'dead' && b[i] === 'dead')) continue
    n++
    if (a[i] !== b[i]) d++
  }
  return n >= min ? d / n : undefined
}

// Kaplan–Meier: the share still standing after each fall, counting only those still observed at that time
export function kaplanMeier(xs: Subject[], t0: number): { t: number; s: number; atRisk: number; fell: number }[] {
  const out = [{ t: t0, s: 1, atRisk: xs.length, fell: 0 }]
  let s = 1
  for (const t of [...new Set(xs.filter((x) => x.fell).map((x) => x.t))].sort((a, b) => a - b)) {
    const atRisk = xs.filter((x) => x.t >= t).length
    const fell = xs.filter((x) => x.fell && x.t === t).length
    s *= 1 - fell / atRisk
    out.push({ t, s, atRisk, fell })
  }
  return out
}
