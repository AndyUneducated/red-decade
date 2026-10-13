// Linking free text to places and orgs by name. Shared by the data build and the browser (see quotes.ts).
import type { Org, Person, Place } from '../data/schema.ts'

// Names in parentheses are notes (今属…), not the place itself; the longest name wins, ties go to the
// later (more specific) one, so 湖南湘潭韶山 resolves to 韶山.
export function placeMatcher(places: Place[]) {
  const names = places.flatMap((pl) => [pl.name, ...pl.names].map((n) => ({ n, id: pl.id })))
  return (text: string | undefined): string | undefined => {
    if (!text) return undefined
    const s = text.replace(/（[^）]*）/g, '')
    let best: { id: string; len: number; at: number } | undefined
    for (const { n, id } of names) {
      const at = s.lastIndexOf(n)
      if (at < 0) continue
      if (!best || n.length > best.len || (n.length === best.len && at > best.at)) best = { id, len: n.length, at }
    }
    return best?.id
  }
}

// A position without org takes the org whose name or alias equals its orgName; failing that, the org with
// the longest alias that begins its title. 中共中央政治局常委 under orgName 中共中央政治局 belongs to the
// sub-body the title names.
export function positionMatcher(orgs: Org[]) {
  const aliases = orgs.flatMap((o) => [o.name, ...o.aliases].map((a) => ({ a, o })))
  return (x: Person['positions'][number]): string | undefined => {
    const byName = aliases.find(({ a }) => a === x.orgName)
    const byTitle = aliases.filter(({ a }) => x.title.startsWith(a)).sort((m, n) => n.a.length - m.a.length)[0]
    const child = byName && byTitle && byTitle.o.under.some((u) => u.org === byName.o.id)
    return (child ? byTitle : (byName ?? byTitle))?.o.id
  }
}

// The people a text names, in order of first mention. Same longest-at-position rule as orgMentioner, so
// 林立果 does not also count for a shorter name it starts with.
export function personMentioner(people: Person[]) {
  const byFirst = new Map<string, { name: string; id: string }[]>()
  for (const p of people) if (p.name.length >= 2) byFirst.set(p.name[0], [...(byFirst.get(p.name[0]) ?? []), { name: p.name, id: p.id }])
  for (const list of byFirst.values()) list.sort((a, b) => b.name.length - a.name.length)
  return (text: string): string[] => {
    const hit = new Set<string>()
    for (let i = 0; i < text.length; ) {
      const m = byFirst.get(text[i])?.find((n) => text.startsWith(n.name, i))
      if (m) hit.add(m.id)
      i += m ? m.name.length : 1
    }
    return [...hit]
  }
}

// The orgs a text mentions by name, short name or alias. Each position in the text credits only the
// longest name starting there, so 中共中央文革小组 does not also count for 中共中央. Two-character names
// are accepted only for mass organisations (西纠、联动).
export function orgMentioner(orgs: Org[]) {
  const byFirst = new Map<string, { name: string; org: string }[]>()
  for (const o of orgs)
    for (const name of new Set([o.name, o.short, ...o.aliases]))
      if (name && (name.length >= 3 || (o.kind === 'popular' && name.length === 2))) {
        const list = byFirst.get(name[0]) ?? []
        list.push({ name, org: o.id })
        byFirst.set(name[0], list)
      }
  for (const list of byFirst.values()) list.sort((a, b) => b.name.length - a.name.length)
  return (text: string): Set<string> => {
    const hit = new Set<string>()
    for (let i = 0; i < text.length; ) {
      const m = byFirst.get(text[i])?.find((n) => text.startsWith(n.name, i))
      if (m) hit.add(m.org)
      i += m ? m.name.length : 1
    }
    return hit
  }
}
