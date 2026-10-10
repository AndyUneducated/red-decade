import { toT } from '../lib/dates'
import type { Atlas, Event, Faction, Person, Relation, Status } from './schema'

export type EntityType = 'person' | 'event' | 'concept' | 'doc' | 'faction' | 'claim'
export type Ref = { type: EntityType; id: string }

export type Index = Atlas & {
  person: Map<string, Person>
  event: Map<string, Event>
  faction: Map<string, Faction>
  concept: Map<string, Atlas['concepts'][number]>
  doc: Map<string, Atlas['documents'][number]>
  source: Map<string, Atlas['sources'][number]>
  claim: Map<string, Atlas['claims'][number]>
  eventsByPerson: Map<string, Event[]>
  relationsByPerson: Map<string, Relation[]>
  primaryFaction: (p: Person) => Faction | undefined
}

export async function loadAtlas(): Promise<Index> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/atlas.json`)
  const atlas = (await res.json()) as Atlas
  const by = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]))
  const faction = by(atlas.factions)
  const eventsByPerson = new Map<string, Event[]>()
  for (const e of atlas.events)
    for (const p of e.people) eventsByPerson.set(p, [...(eventsByPerson.get(p) ?? []), e])
  const relationsByPerson = new Map<string, Relation[]>()
  for (const r of atlas.relations)
    for (const p of [r.a, r.b]) relationsByPerson.set(p, [...(relationsByPerson.get(p) ?? []), r])
  return {
    ...atlas,
    person: by(atlas.people),
    event: by(atlas.events),
    faction,
    concept: by(atlas.concepts),
    doc: by(atlas.documents),
    source: by(atlas.sources),
    claim: by(atlas.claims),
    eventsByPerson,
    relationsByPerson,
    primaryFaction: (p) => faction.get(p.factions[0]),
  }
}

export function statusAt(p: Person, t: number): Status | undefined {
  let s: Status | undefined
  for (const f of p.fate) {
    if (toT(f.date) > t) break
    s = f.s
  }
  if (!s && p.born && toT(p.born) <= t) s = 'normal'
  return s
}

export function relationActive(r: Relation, t: number): boolean {
  const from = r.from ? toT(r.from) : -Infinity
  const to = r.to ? toT(r.to, true) : Infinity
  return from <= t && t <= to
}

export function label(ix: Index, ref: Ref): string {
  switch (ref.type) {
    case 'person':
      return ix.person.get(ref.id)?.name ?? ref.id
    case 'event':
      return ix.event.get(ref.id)?.title ?? ref.id
    case 'concept':
      return ix.concept.get(ref.id)?.name ?? ref.id
    case 'doc':
      return ix.source.get(ref.id)?.alias ?? ix.source.get(ref.id)?.title ?? ref.id
    case 'faction':
      return ix.faction.get(ref.id)?.name ?? ref.id
    case 'claim':
      return ref.id
  }
}
