// Which faction held an org at t, read off its sitting head. Among concurrent leaders the one who took
// office last wins, so a vice-chairman 主持日常工作 (林彪 in the CMC) outranks the standing chairman.
// A head in the atlas counts by his faction at t, but not before the faction formed (陈伯达 at 红旗 before
// May 1966 is not 中央文革); a head outside the atlas only by an explicit `faction`. An org with no known
// head at all falls back to its own `factions`. A faction's end date applies except to a `group`: 江青's
// people still ran the culture group after the CCRG itself lapsed in 1969, while 旧北京市委 or 老红卫兵
// mean nothing as labels once dissolved.
import { factionAt, type Index } from '../data/atlas'
import type { Faction, Org } from '../data/schema'
import { toT } from './dates'
import { existsAt, isHead, within } from './orgs'

// factions.yaml describes the groupings of 1965–1966; before the Lushan conference and after the 1981
// resolution its labels say little about who ran an org
export const CONTROL_FROM = 1959.5
export const CONTROL_TO = 1981.5

export type Control = { f: string; by?: string; title?: string }
export type Run = Control & { a: number; b: number }

export function controlAt(ix: Index, o: Org, t: number): Control | undefined {
  if (t < CONTROL_FROM || t >= CONTROL_TO || !existsAt(o, t)) return undefined
  const heads = o.leaders.length
    ? o.leaders.filter((l) => within(l, t)).map((l) => ({ name: l.name, title: l.title, from: l.from, p: l.person ? ix.person.get(l.person) : undefined, f: l.faction }))
    : (ix.tenuresByOrg.get(o.id) ?? [])
        .filter((x) => within(x.pos, t) && isHead(x.pos.title, o))
        .map((x) => ({ name: x.person.name, title: x.pos.title, from: x.pos.from, p: x.person, f: undefined }))
  heads.sort((u, v) => (v.from ? toT(v.from) : 0) - (u.from ? toT(u.from) : 0))
  for (const h of heads) {
    if (h.p?.died && toT(h.p.died) <= t) continue
    const f = ix.faction.get((h.p ? factionAt(h.p, t) : h.f) ?? '')
    if (f && live(f, t)) return { f: f.id, by: h.name, title: h.title }
  }
  if (heads.length) return undefined
  const f = o.factions.map((id) => ix.faction.get(id)).find((f) => f && live(f, t, true))
  return f ? { f: f.id } : undefined
}

const live = (f: Faction, t: number, strict = false) =>
  (!f.from || toT(f.from) <= t) && ((!strict && f.kind === 'group') || !f.to || t < toT(f.to, true))

const STEP = 1 / 12
const cache = new WeakMap<Index, Map<string, Run[]>>()

// Monthly samples merged into runs of one faction held by one person.
export function controlRuns(ix: Index, o: Org): Run[] {
  let m = cache.get(ix)
  if (!m) cache.set(ix, (m = new Map()))
  const hit = m.get(o.id)
  if (hit) return hit
  const runs: Run[] = []
  for (let t = CONTROL_FROM; t < CONTROL_TO; t += STEP) {
    const c = controlAt(ix, o, t)
    const last = runs[runs.length - 1]
    if (c && last && last.f === c.f && last.by === c.by && Math.abs(last.b - t) < STEP / 2) last.b = t + STEP
    else if (c) runs.push({ ...c, a: t, b: t + STEP })
  }
  m.set(o.id, runs)
  return runs
}
