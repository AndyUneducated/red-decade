// The personal view (M9): one person's share of the atlas. Pages that support it (`lens` in pages.ts) show this
// slice instead of everything while a person is chosen (#/<page>?as=<person id>).
import type { Index } from '../data/atlas.ts'
import type { ArchiveItem, Person, Relation } from '../data/schema.ts'

export type Lens = {
  person: Person
  events: Set<string>
  relations: Relation[]
  // linked by a relation or named in the same event
  people: Set<string>
  // texts whose author line names the person, or listed among their works
  wrote: Set<string>
  // wrote, plus the texts annotated with the person, cited by their biography, or by their events
  sources: Set<string>
  archive: Set<string>
}

const sourceOf = (cite: string) => cite.split('@')[0]
const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function namesOf(p: Person): string[] {
  return [p.name, ...(p.aka ?? []).map((a) => a.name)].filter((n) => n.length >= 2)
}

function archiveNames(item: ArchiveItem, names: string[], pinyin?: string) {
  const t = `${item.title} ${item.description ?? ''}`
  return names.some((n) => t.includes(n)) || (!!pinyin && plain(t).includes(pinyin))
}

const cache = new WeakMap<Index, Map<string, Lens | undefined>>()

export function lensOf(ix: Index, id: string): Lens | undefined {
  let byId = cache.get(ix)
  if (!byId) cache.set(ix, (byId = new Map()))
  if (byId.has(id)) return byId.get(id)
  const lens = build(ix, id)
  byId.set(id, lens)
  return lens
}

function build(ix: Index, id: string): Lens | undefined {
  const person = ix.person.get(id)
  if (!person) return
  const events = ix.eventsByPerson.get(id) ?? []
  const relations = ix.relationsByPerson.get(id) ?? []
  const people = new Set<string>()
  for (const r of relations) people.add(r.a === id ? r.b : r.a)
  for (const e of events) for (const p of e.people) if (p !== id) people.add(p)

  const names = namesOf(person)
  const wrote = new Set<string>()
  for (const s of ix.sources) if (s.author && names.some((n) => s.author!.includes(n))) wrote.add(s.id)
  for (const w of person.works) if (w.cite) wrote.add(sourceOf(w.cite))

  const sources = new Set(wrote)
  for (const d of ix.documents) if (d.people.includes(id)) sources.add(d.id)
  for (const e of events) {
    for (const d of e.docs) sources.add(d)
    for (const c of e.cites) sources.add(sourceOf(c))
  }
  const cites = [
    ...person.cites,
    ...person.life.flatMap((l) => l.cites),
    ...person.quotes.map((q) => q.cite),
    ...person.fate.flatMap((f) => (f.cite ? [f.cite] : [])),
    ...person.rehab.flatMap((r) => (r.cite ? [r.cite] : [])),
    ...person.afterlife.flatMap((r) => (r.cite ? [r.cite] : [])),
  ]
  for (const c of cites) sources.add(sourceOf(c))
  for (const s of [...sources]) if (!ix.source.has(s)) sources.delete(s)
  for (const s of [...wrote]) if (!ix.source.has(s)) wrote.delete(s)

  const pinyin = person.pinyin && plain(person.pinyin)
  const archive = new Set(ix.archive.filter((a) => archiveNames(a, names, pinyin)).map((a) => a.id))
  return { person, events: new Set(events.map((e) => e.id)), relations, people, wrote, sources, archive }
}

// a lens worth offering: the person appears in at least one event or relation
export const lensUsable = (l: Lens | undefined) => !!l && (l.events.size > 0 || l.relations.length > 0)
