import { orgMentioner } from '../derive/match'
import { toT } from '../lib/dates'
import type { Atlas, Essay, Event, Faction, Org, Person, Place, Relation, Status, Topic } from './schema'

export type Position = Person['positions'][number]
export type Tenure = { person: Person; pos: Position }
export type Ism = Atlas['isms'][number]
export type OrgEdge = { org: Org; from?: string; to?: string }
export type OrgLinkIn = { org: Org; link: Org['links'][number] }

// Drawer vs. full page (see research/progress.md, “抽屉与全屏的界限”): person, org and doc also have a
// full page; the drawer card for them is a preview that links to it.
export type EntityType = 'person' | 'event' | 'concept' | 'doc' | 'faction' | 'claim' | 'org' | 'ism'
// sub narrows a selection, e.g. a concept within one source document
export type Ref = { type: EntityType; id: string; sub?: string }
export type Claim = Atlas['claims'][number]
export type ClaimTarget = 'person' | 'event' | 'concept' | 'ism' | 'faction' | 'org' | 'topic'

export type Index = Atlas & {
  person: Map<string, Person>
  event: Map<string, Event>
  faction: Map<string, Faction>
  concept: Map<string, Atlas['concepts'][number]>
  doc: Map<string, Atlas['documents'][number]>
  source: Map<string, Atlas['sources'][number]>
  claim: Map<string, Atlas['claims'][number]>
  org: Map<string, Org>
  ism: Map<string, Ism>
  // isms listing this one as a parent, and those formulated against it
  ismChildren: Map<string, Ism[]>
  ismOpposed: Map<string, Ism[]>
  place: Map<string, Place>
  topic: Map<string, Topic>
  essay: Map<string, Essay>
  eventsByTopic: Map<string, Event[]>
  eventsByPerson: Map<string, Event[]>
  relationsByPerson: Map<string, Relation[]>
  tenuresByOrg: Map<string, Tenure[]>
  eventsByOrg: Map<string, Event[]>
  childrenOf: Map<string, OrgEdge[]>
  linksInto: Map<string, OrgLinkIn[]>
  orgsByFaction: Map<string, Org[]>
  claimsBy: Record<ClaimTarget, Map<string, Claim[]>>
  primaryFaction: (p: Person) => Faction | undefined
}

const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => m.set(k, [...(m.get(k) ?? []), v])

export async function loadAtlas(): Promise<Index> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/atlas.json`)
  return indexAtlas((await res.json()) as Atlas)
}

export function indexAtlas(atlas: Atlas): Index {
  const by = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]))
  const faction = by(atlas.factions)
  const eventsByPerson = new Map<string, Event[]>()
  for (const e of atlas.events)
    for (const p of e.people) eventsByPerson.set(p, [...(eventsByPerson.get(p) ?? []), e])
  const eventsByTopic = new Map<string, Event[]>()
  for (const e of atlas.events) for (const id of e.topics) push(eventsByTopic, id, e)
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
  // events mention an org when its name, short name or an alias occurs in the title or summary
  const mentions = orgMentioner(atlas.orgs)
  const eventsByOrg = new Map<string, Event[]>()
  for (const e of atlas.events) for (const id of mentions(e.title + '\n' + e.summary)) push(eventsByOrg, id, e)
  const ismChildren = new Map<string, Ism[]>()
  const ismOpposed = new Map<string, Ism[]>()
  for (const m of atlas.isms) {
    for (const p of m.parents) push(ismChildren, p, m)
    for (const a of m.against) push(ismOpposed, a, m)
  }
  // claims are tagged explicitly, except orgs: a claim concerns an org when its statement names it
  const claimsBy: Index['claimsBy'] = { person: new Map(), event: new Map(), concept: new Map(), ism: new Map(), faction: new Map(), org: new Map(), topic: new Map() }
  for (const c of atlas.claims) {
    c.topics.forEach((id) => push(claimsBy.topic, id, c))
    c.people.forEach((id) => push(claimsBy.person, id, c))
    c.events.forEach((id) => push(claimsBy.event, id, c))
    c.concepts.forEach((id) => push(claimsBy.concept, id, c))
    c.isms.forEach((id) => push(claimsBy.ism, id, c))
    c.factions.forEach((id) => push(claimsBy.faction, id, c))
    for (const id of mentions(c.statement)) push(claimsBy.org, id, c)
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
    ism: by(atlas.isms),
    ismChildren,
    ismOpposed,
    place: by(atlas.places),
    topic: by(atlas.topics),
    essay: by(atlas.essays),
    eventsByTopic,
    eventsByPerson,
    relationsByPerson,
    tenuresByOrg,
    eventsByOrg,
    childrenOf,
    linksInto,
    orgsByFaction,
    claimsBy,
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
    case 'org':
      return ix.org.get(ref.id)?.short ?? ix.org.get(ref.id)?.name ?? ref.id
    case 'ism':
      return ix.ism.get(ref.id)?.short ?? ix.ism.get(ref.id)?.name ?? ref.id
  }
}
