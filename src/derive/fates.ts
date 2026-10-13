// Fate sequences read as data: when a person fell, survival curves over a group, and a yearly state code
// for comparing two lives. Pure; times are fractional years from lib/dates.
import type { DeathKind, Person, Status } from '../data/schema.ts'
import { toT } from '../lib/dates.ts'

export const UNNATURAL: ReadonlySet<DeathKind> = new Set(['persecuted', 'suicide', 'killed', 'executed'])
const DOWN: ReadonlySet<Status> = new Set(['purged', 'detained', 'dead'])

// the first fate node at or after t0 whose status is in `falls`, or a death that was not natural
export function firstFall(p: Person, t0: number, falls: ReadonlySet<Status>): number | undefined {
  for (const f of p.fate) {
    const t = toT(f.date)
    if (t < t0) continue
    if (falls.has(f.s) || (f.s === 'dead' && p.deathKind && UNNATURAL.has(p.deathKind))) return t
  }
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
