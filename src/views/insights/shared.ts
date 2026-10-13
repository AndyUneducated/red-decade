// Definitions shared by an insight page and its summary in the cards (components/drawer/InsightNotes.tsx), so
// the two always agree. No React here: the cards load with the app, the pages on demand.
import { factionAt, type Index } from '../../data/atlas'
import type { ConceptHit, Faction, Relation, Status } from '../../data/schema'
import { firstKey } from '../../derive/corpus'
import { yearCodes, type Code } from '../../derive/fates'
import { orgMentioner, personMentioner } from '../../derive/match'
import { toT } from '../../lib/dates'

// computed once per atlas
function perAtlas<T>(f: (ix: Index) => T): (ix: Index) => T {
  const cache = new WeakMap<Index, T>()
  return (ix) => {
    if (!cache.has(ix)) cache.set(ix, f(ix))
    return cache.get(ix)!
  }
}

export const MAO = 'mao-zedong'
export const HOSTILE: ReadonlySet<Relation['type']> = new Set(['attack', 'persecute'])

// G survival
export const SURVIVAL_T0 = toT('1965-11')
export const SURVIVAL_T1 = toT('1978-12', true)
export const FALLS: Record<'strict' | 'wide', ReadonlySet<Status>> = {
  strict: new Set(['purged', 'detained']),
  wide: new Set(['attacked', 'sidelined', 'purged', 'detained']),
}

// H overlap: falls counted from the founding of the PRC, so a pre-1949 arrest is not a fall
export const OVERLAP_T0 = toT('1949-10')

// N paralysis: the months drawn
export const PARALYSIS_T0 = 1965
export const PARALYSIS_T1 = 1982

// J parallel lives
export const LIFE_YEARS = Array.from({ length: 26 }, (_, i) => 1960 + i)
// everyone with at least two fate nodes
export const lifeCodes = perAtlas((ix) => new Map<string, Code[]>(ix.people.filter((p) => p.fate.length >= 2).map((p) => [p.id, yearCodes(p, LIFE_YEARS)])))

// C attribution
export const ATTRIBUTION_MIN_KINDS = 3

// B authorities: years with less official text than this are left blank, one or two documents would decide them
export const AUTHORITY_MIN_CHARS = 20000

// D spread: contemporary kinds of text, top to bottom of the hierarchy; press reports count with news
export const SPREAD_KINDS: { id: string; color: string; also?: string[] }[] = [
  { id: 'party-doc', color: 'var(--sys-party)' },
  { id: 'speech', color: 'var(--org-mass)' },
  { id: 'editorial', color: 'var(--sys-gov)' },
  { id: 'news', color: 'var(--ink-2)', also: ['press'] },
  { id: 'redguard', color: 'var(--org-popular)' },
  { id: 'essay', color: 'var(--sys-army)', also: ['letter'] },
]
export const spreadKind = (k: string) => SPREAD_KINDS.find((x) => x.id === k || x.also?.includes(k))
// the earliest hit in each kind of text, earliest first
export function firstsByKind(ix: Index, hits: ConceptHit[]): { kind: string; hit: ConceptHit }[] {
  const by = new Map<string, ConceptHit>()
  for (const h of [...hits].sort((a, b) => firstKey(a.date).localeCompare(firstKey(b.date)))) {
    const k = spreadKind(ix.source.get(h.source)?.kind ?? '')
    if (k && !by.has(k.id)) by.set(k.id, h)
  }
  return [...by].map(([kind, hit]) => ({ kind, hit }))
}

// L rhetoric
export const RHETORIC_MIN_TEXTS = 3
export type Profile = { f: Faction; texts: Set<string>; counts: Map<string, number>; total: number }
export const rhetoric = perAtlas((ix) => {
  const who = personMentioner(ix.people)
  const orgs = orgMentioner(ix.orgs)
  // a text speaks for the faction of a profiled author at its date, or for the factions its author org is labelled with
  const factionsOf = new Map<string, Set<string>>()
  for (const s of ix.sources) {
    if (!s.hasText || !s.author) continue
    const t = toT(s.date)
    const fs = new Set([...who(s.author).map((id) => factionAt(ix.person.get(id)!, t)), ...[...orgs(s.author)].flatMap((o) => ix.org.get(o)!.factions)].filter((f) => ix.faction.has(f)))
    if (fs.size) factionsOf.set(s.id, fs)
  }
  const vocab = new Map<string, { name: string; hits: ConceptHit[] }>([
    ...ix.concepts.map((c) => [`concept:${c.id}`, { name: c.name, hits: c.hits }] as const),
    ...ix.isms.map((m) => [`ism:${m.id}`, { name: m.short ?? m.name, hits: m.hits }] as const),
  ])
  const byFaction = new Map<string, Profile>()
  for (const [k, { hits }] of vocab)
    for (const h of hits)
      for (const f of factionsOf.get(h.source) ?? []) {
        let p = byFaction.get(f)
        if (!p) byFaction.set(f, (p = { f: ix.faction.get(f)!, texts: new Set(), counts: new Map(), total: 0 }))
        p.texts.add(h.source)
        p.counts.set(k, (p.counts.get(k) ?? 0) + h.count)
        p.total += h.count
      }
  const profiles = [...byFaction.values()].filter((p) => p.texts.size >= RHETORIC_MIN_TEXTS).sort((a, b) => b.texts.size - a.texts.size)
  return { vocab, profiles, attributed: factionsOf.size }
})
export function cosine(a: Profile, b: Profile) {
  let dot = 0
  let na = 0
  let nb = 0
  for (const [k, n] of a.counts) {
    dot += n * (b.counts.get(k) ?? 0)
    na += n * n
  }
  for (const n of b.counts.values()) nb += n * n
  return dot / Math.sqrt(na * nb)
}
