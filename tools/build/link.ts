// Stage 2: fill in links the YAML leaves implicit — positions → orgs, birth/death/event place strings →
// places, leaders → people, memberships → factions, revcom reports → org cites. The org and place links
// are written to .probe/org-links.txt for review, with a mark where a position falls outside the org's
// lifespan.
import { writeFileSync } from 'node:fs'
import { placeMatcher, positionMatcher } from '../../src/derive/match.ts'
import { exists, path } from './io.ts'
import type { Data } from './load.ts'

export function link(d: Data) {
  const report: string[] = []
  const orgOf = positionMatcher(d.orgs)
  const orgById = new Map(d.orgs.map((o) => [o.id, o]))
  for (const p of d.people)
    for (const x of p.positions) {
      x.org ??= orgOf(x)
      const o = x.org ? orgById.get(x.org) : undefined
      const outside = o && ((o.from && x.to && o.from.slice(0, 4) > x.to.slice(0, 4)) || (o.to && x.from && x.from.slice(0, 4) > o.to.slice(0, 4)))
      report.push(`${(x.org ?? '-').padEnd(22)} ${outside ? '!' : ' '} ${p.id.padEnd(16)} ${x.from ?? '?'}–${x.to ?? ''} ${x.title} | ${x.orgName ?? ''}`)
    }

  const placeOf = placeMatcher(d.places)
  for (const p of d.people) {
    p.birthAt ??= placeOf(p.birthplace)
    p.deathAt ??= placeOf(p.deathPlace)
    report.push(`@birth ${(p.birthAt ?? '-').padEnd(14)} ${p.id.padEnd(16)} ${p.birthplace ?? ''}`)
    if (p.died) report.push(`@death ${(p.deathAt ?? '-').padEnd(14)} ${p.id.padEnd(16)} ${p.deathPlace ?? ''}`)
  }
  for (const e of d.events) {
    e.at ??= placeOf(e.place)
    if (e.place) report.push(`@event ${(e.at ?? '-').padEnd(14)} ${e.id.padEnd(16)} ${e.place}`)
  }
  if (exists('.probe')) writeFileSync(path('.probe', 'org-links.txt'), report.join('\n'))

  // leaders lists name people by their usual name; those in the atlas get linked
  const personByName = new Map(d.people.map((p) => [p.name, p.id]))
  for (const o of d.orgs) {
    for (const l of o.leaders) l.person ??= personByName.get(l.name)
    o.leaders.sort((a, b) => (a.from ?? o.from ?? '').localeCompare(b.from ?? o.from ?? ''))
  }
  for (const p of d.people) for (const m of p.memberships ?? []) if (!p.factions.includes(m.f)) p.factions.push(m.f)
  for (const r of d.revcoms) {
    const o = orgById.get(r.org)
    if (o && !o.cites.includes(r.cite)) o.cites.push(r.cite)
  }
}
