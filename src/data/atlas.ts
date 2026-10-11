import { toT } from '../lib/dates'
import type { Atlas, Event, Faction, Org, Person, Place, Relation, Status } from './schema'

export type Position = Person['positions'][number]
export type Tenure = { person: Person; pos: Position }
export type OrgEdge = { org: Org; from?: string; to?: string }
export type OrgLinkIn = { org: Org; link: Org['links'][number] }

export type EntityType = 'person' | 'event' | 'concept' | 'doc' | 'faction' | 'claim'
// sub narrows a selection, e.g. a concept within one source document
export type Ref = { type: EntityType; id: string; sub?: string }

export type Index = Atlas & {
  person: Map<string, Person>
  event: Map<string, Event>
  faction: Map<string, Faction>
  concept: Map<string, Atlas['concepts'][number]>
  doc: Map<string, Atlas['documents'][number]>
  source: Map<string, Atlas['sources'][number]>
  claim: Map<string, Atlas['claims'][number]>
  org: Map<string, Org>
  place: Map<string, Place>
  eventsByPerson: Map<string, Event[]>
  relationsByPerson: Map<string, Relation[]>
  tenuresByOrg: Map<string, Tenure[]>
  eventsByOrg: Map<string, Event[]>
  childrenOf: Map<string, OrgEdge[]>
  linksInto: Map<string, OrgLinkIn[]>
  orgsByFaction: Map<string, Org[]>
  primaryFaction: (p: Person) => Faction | undefined
}

const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => m.set(k, [...(m.get(k) ?? []), v])

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
  const org = by(atlas.orgs)
  const tenuresByOrg = new Map<string, Tenure[]>()
  for (const person of atlas.people) for (const pos of person.positions) if (pos.org) push(tenuresByOrg, pos.org, { person, pos })
  const childrenOf = new Map<string, OrgEdge[]>()
  const linksInto = new Map<string, OrgLinkIn[]>()
  const orgsByFaction = new Map<string, Org[]>()
  for (const o of atlas.orgs) {
    for (const u of o.under) push(childrenOf, u.org, { org: o, from: u.from, to: u.to })
    for (const link of o.links) push(linksInto, link.org, { org: o, link })
    for (const f of o.factions) push(orgsByFaction, f, o)
  }
  // Events mention an org when its name, short name or an alias occurs in the title or summary. Each
  // position in the text credits only the longest name starting there, so 中共中央文革小组 does not also
  // count for 中共中央. Two-character names are accepted only for mass organisations (西纠、联动).
  const names = new Map<string, { name: string; org: string }[]>()
  for (const o of atlas.orgs)
    for (const name of new Set([o.name, o.short, ...o.aliases]))
      if (name && (name.length >= 3 || (o.kind === 'popular' && name.length === 2))) push(names, name[0], { name, org: o.id })
  for (const list of names.values()) list.sort((a, b) => b.name.length - a.name.length)
  const eventsByOrg = new Map<string, Event[]>()
  for (const e of atlas.events) {
    const text = e.title + '\n' + e.summary
    const hit = new Set<string>()
    for (let i = 0; i < text.length; ) {
      const m = names.get(text[i])?.find((n) => text.startsWith(n.name, i))
      if (m) hit.add(m.org)
      i += m ? m.name.length : 1
    }
    for (const id of hit) push(eventsByOrg, id, e)
  }
  return {
    ...atlas,
    person: by(atlas.people),
    event: by(atlas.events),
    faction,
    concept: by(atlas.concepts),
    doc: by(atlas.documents),
    source: by(atlas.sources),
    claim: by(atlas.claims),
    org,
    place: by(atlas.places),
    eventsByPerson,
    relationsByPerson,
    tenuresByOrg,
    eventsByOrg,
    childrenOf,
    linksInto,
    orgsByFaction,
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

export function factionAt(p: Person, t: number): string {
  let f = p.factions[0]
  for (const m of p.memberships ?? []) {
    const from = m.from ? toT(m.from) : -Infinity
    const to = m.to ? toT(m.to, true) : Infinity
    if (from <= t && t <= to) f = m.f
  }
  return f
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
