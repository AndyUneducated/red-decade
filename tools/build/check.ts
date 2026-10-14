// Stage 3: referential integrity and plausibility — unknown or duplicate ids, unknown sources, dates out
// of order or outside a life, records with neither a source nor a verify mark.
import { after } from '../../src/lib/dates.ts'
import { errors } from './io.ts'
import type { Data } from './load.ts'

export function check(d: Data) {
  const ids = {
    person: new Set(d.people.map((p) => p.id)),
    faction: new Set(d.factions.map((f) => f.id)),
    concept: new Set(d.concepts.map((c) => c.id)),
    event: new Set(d.events.map((e) => e.id)),
    org: new Set(d.orgs.map((o) => o.id)),
    place: new Set(d.places.map((p) => p.id)),
    ism: new Set(d.isms.map((m) => m.id)),
    topic: new Set(d.topics.map((t) => t.id)),
  }
  for (const [kind, list] of [
    ['topic', d.topics],
    ['person', d.people],
    ['faction', d.factions],
    ['event', d.events],
    ['concept', d.concepts],
    ['org', d.orgs],
    ['place', d.places],
    ['ism', d.isms],
    ['county', d.counties],
    ['press term', d.pressTerms],
  ] as const) {
    const seen = new Set<string>()
    for (const { id } of list) {
      if (seen.has(id)) errors.push(`duplicate ${kind} id ${id}`)
      seen.add(id)
    }
  }
  const need = (set: Set<string>, id: string, where: string) => {
    if (!set.has(id)) errors.push(`${where}: unknown id "${id}"`)
  }
  const needCite = (cite: string | undefined, where: string) => {
    if (cite && !d.sourceById.has(cite.split('@')[0])) errors.push(`${where}: unknown source "${cite}"`)
  }

  for (const p of d.people) {
    const where = `person ${p.id}`
    p.memberships?.forEach((m) => needCite(m.cite, `${where} membership`))
    p.factions.forEach((f) => need(ids.faction, f, where))
    // the network and fates views group people by their first faction
    if (!p.factions.length) errors.push(`${where}: no faction`)
    p.cites.forEach((c) => needCite(c, where))
    p.fate.forEach((f) => (needCite(f.cite, `${where} fate`), f.place && need(ids.place, f.place, `${where} fate`)))
    if (p.birthAt) need(ids.place, p.birthAt, `${where} birthAt`)
    if (p.deathAt) need(ids.place, p.deathAt, `${where} deathAt`)
    for (let i = 1; i < p.fate.length; i++) if (p.fate[i].date < p.fate[i - 1].date) errors.push(`${where}: fate out of order at ${p.fate[i].date}`)

    const inLife = (date: string | undefined, what: string) => {
      if (!date) return
      if (p.born && after(p.born, date)) errors.push(`${where}: ${what} ${date} is before birth ${p.born}`)
      if (p.died && after(date, p.died)) errors.push(`${where}: ${what} ${date} is after death ${p.died}`)
    }
    const span = (s: { from?: string; to?: string }, what: string) => {
      if (s.from && s.to && after(s.from, s.to)) errors.push(`${where}: ${what} ends (${s.to}) before it starts (${s.from})`)
      inLife(s.from, what)
      inLife(s.to, what)
    }
    p.education.forEach((e) => (span(e, `education ${e.school}`), needCite(e.cite, `${where} education`)))
    p.positions.forEach((x) => {
      span(x, `position ${x.title}`)
      needCite(x.cite, `${where} position`)
      if (x.org) need(ids.org, x.org, `${where} position ${x.title}`)
    })
    inLife(p.joinedParty, 'joinedParty')
    inLife(p.joinedRevolution, 'joinedRevolution')
    inLife(p.rank?.date, 'rank')
    needCite(p.rank?.cite, `${where} rank`)
    p.fate.forEach((f) => p.born && after(p.born, f.date) && errors.push(`${where}: fate ${f.date} is before birth`))
    if ((p.deathKind || p.deathPlace || p.deathContested) && !p.died) errors.push(`${where}: death details without a death date`)
    for (const r of [...p.rehab, ...p.afterlife]) {
      needCite(r.cite, `${where} rehab/afterlife`)
      if (p.born && after(p.born, r.date)) errors.push(`${where}: rehab/afterlife ${r.date} is before birth`)
    }
    for (const s of p.life) {
      s.cites.forEach((c) => needCite(c, `${where} life "${s.h}"`))
      if (!s.cites.length && !s.verify) errors.push(`${where} life "${s.h}": no cites and not marked verify`)
      // sections may run past death (身后、平反), so only the start is bound to the life span
      if (s.from && s.to && after(s.from, s.to)) errors.push(`${where}: life "${s.h}" ends (${s.to}) before it starts (${s.from})`)
      if (s.from && p.born && after(p.born, s.from)) errors.push(`${where}: life "${s.h}" starts before birth`)
    }
    p.assess.forEach((v) => needCite(v.cite, `${where} assess`))
    p.works.forEach((w) => needCite(w.cite, `${where} works`))
    for (const q of p.quotes) {
      needCite(q.cite, `${where} quote`)
      // a lowercase slug is a person id; anything else (中共中央, 特别法庭) is a body named as written
      if (q.by && /^[a-z0-9-]+$/.test(q.by)) need(ids.person, q.by, `${where} quote by`)
      if (q.by === p.id) errors.push(`${where}: quote by the person themselves should omit by`)
      if (!q.by && q.date && p.born && after(p.born, q.date)) errors.push(`${where}: own quote ${q.date} is before birth`)
      if (!q.by && q.date && p.died && after(q.date, p.died)) errors.push(`${where}: own quote ${q.date} is after death`)
    }
    const dup = p.quotes.find((q, i) => p.quotes.findIndex((r) => r.text === q.text) !== i)
    if (dup) errors.push(`${where}: quote listed twice: "${dup.text.slice(0, 20)}…"`)
  }

  for (const f of d.factions) f.cites.forEach((c) => needCite(c, `faction ${f.id}`))

  for (const o of d.orgs) {
    const where = `org ${o.id}`
    const span = (s: { from?: string; to?: string }, what: string) => {
      if (s.from && s.to && after(s.from, s.to)) errors.push(`${where}: ${what} ends (${s.to}) before it starts (${s.from})`)
    }
    span(o, 'lifespan')
    o.suspended.forEach((s) => span(s, 'suspended'))
    o.under.forEach((u) => (need(ids.org, u.org, `${where} under`), span(u, `under ${u.org}`), u.org === o.id && errors.push(`${where}: under itself`)))
    o.places.forEach((pl) => (need(ids.place, pl.at, `${where} places`), span(pl, `place ${pl.at}`)))
    o.links.forEach((l) => (need(ids.org, l.org, `${where} links`), needCite(l.cite, `${where} links`)))
    o.factions.forEach((f) => need(ids.faction, f, where))
    o.cites.forEach((c) => needCite(c, where))
    if (!o.cites.length && !o.verify) errors.push(`${where}: no cites and not marked verify`)
    for (const l of o.leaders) {
      if (l.person) need(ids.person, l.person, `${where} leader ${l.name}`)
      if (l.faction) need(ids.faction, l.faction, `${where} leader ${l.name}`)
      needCite(l.cite, `${where} leader ${l.name}`)
      span(l, `leader ${l.name}`)
      if (o.from && l.from && after(o.from, l.from)) errors.push(`${where} leader ${l.name}: starts ${l.from} before the org (${o.from})`)
      if (o.to && l.to && after(l.to, o.to)) errors.push(`${where} leader ${l.name}: ends ${l.to} after the org (${o.to})`)
    }
  }

  for (const e of d.events) {
    e.people.forEach((id) => need(ids.person, id, `event ${e.id}`))
    if (e.at) need(ids.place, e.at, `event ${e.id} at`)
    e.concepts.forEach((id) => need(ids.concept, id, `event ${e.id}`))
    e.docs.forEach((id) => needCite(id, `event ${e.id} docs`))
    e.cites.forEach((c) => needCite(c, `event ${e.id}`))
    e.voices.forEach((v) => needCite(v.cite, `event ${e.id} voice`))
    if (!e.cites.length && !e.verify) errors.push(`event ${e.id}: no cites and not marked verify`)
    e.topics.forEach((id) => need(ids.topic, id, `event ${e.id}`))
  }
  for (const t of d.topics) {
    t.cites.forEach((c) => needCite(c, `topic ${t.id}`))
    t.sections.forEach((s) => s.cites.forEach((c) => needCite(c, `topic ${t.id} ${s.h}`)))
    t.events.forEach((id) => need(ids.event, id, `topic ${t.id} events`))
    t.claims.forEach((id) => need(new Set(d.claims.map((c) => c.id)), id, `topic ${t.id} claims`))
    if (!d.events.some((e) => e.topics.includes(t.id))) errors.push(`topic ${t.id}: no events`)
  }
  const archiveIds = new Set<string>()
  for (const a of d.archive) {
    if (archiveIds.has(a.id)) errors.push(`archive ${a.id}: duplicate id`)
    archiveIds.add(a.id)
    if (!a.url && !a.cite) errors.push(`archive ${a.id}: neither a source page nor a cite`)
    needCite(a.cite, `archive ${a.id}`)
    if (a.quote && !a.cite) errors.push(`archive ${a.id}: quote without a cite`)
  }
  for (const r of d.relations) {
    need(ids.person, r.a, `relation ${r.a}→${r.b}`)
    need(ids.person, r.b, `relation ${r.a}→${r.b}`)
    needCite(r.cite, `relation ${r.a}→${r.b}`)
  }
  for (const c of d.concepts) {
    c.related.forEach((id) => need(ids.concept, id, `concept ${c.id}`))
    c.notes.forEach((n) => needCite(n.cite, `concept ${c.id}`))
  }
  for (const m of d.isms) {
    const where = `ism ${m.id}`
    ;[...m.parents, ...m.against].forEach((id) => (need(ids.ism, id, where), id === m.id && errors.push(`${where}: refers to itself`)))
    for (const id of m.parents) {
      const p = d.isms.find((x) => x.id === id)
      if (p && after(p.from, m.from)) errors.push(`${where}: starts (${m.from}) before its parent ${id} (${p.from})`)
    }
    m.concepts.forEach((id) => need(ids.concept, id, where))
    m.cites.forEach((c) => needCite(c, where))
    m.notes.forEach((n) => needCite(n.cite, where))
    if (m.to && after(m.from, m.to)) errors.push(`${where}: ends (${m.to}) before it starts (${m.from})`)
    for (const p of m.pos) if (after(m.from, p.at) || (m.to && after(p.at, m.to))) errors.push(`${where}: pos ${p.at} outside ${m.from}–${m.to ?? ''}`)
    for (let i = 1; i < m.pos.length; i++) if (after(m.pos[i - 1].at, m.pos[i].at)) errors.push(`${where}: pos out of order at ${m.pos[i].at}`)
  }
  for (let i = 1; i < d.line.length; i++) if (after(d.line[i - 1].at, d.line[i].at)) errors.push(`line: out of order at ${d.line[i].at}`)
  for (const doc of d.documents) {
    if (!d.sourceById.has(doc.id)) errors.push(`document ${doc.id}: no source record`)
    doc.people.forEach((id) => need(ids.person, id, `document ${doc.id}`))
    doc.concepts.forEach((id) => need(ids.concept, id, `document ${doc.id}`))
  }
  for (const c of d.claims) {
    c.people.forEach((id) => need(ids.person, id, `claim ${c.id}`))
    c.concepts.forEach((id) => need(ids.concept, id, `claim ${c.id}`))
    c.events.forEach((id) => need(ids.event, id, `claim ${c.id}`))
    c.isms.forEach((id) => need(ids.ism, id, `claim ${c.id}`))
    c.factions.forEach((id) => need(ids.faction, id, `claim ${c.id}`))
    c.topics.forEach((id) => need(ids.topic, id, `claim ${c.id}`))
    c.evidence.forEach((e) => needCite(e.cite, `claim ${c.id}`))
  }
  const claimIds = new Set(d.claims.map((c) => c.id))
  for (const e of d.essays)
    for (const s of e.sections) {
      s.claims.forEach((id) => need(claimIds, id, `essay ${e.id} ${s.h}`))
      s.cites.forEach((c) => needCite(c, `essay ${e.id} ${s.h}`))
      if (!s.claims.length && !s.cites.length) errors.push(`essay ${e.id} ${s.h}: a section needs claims or cites`)
    }
  if (new Set(d.essays.map((e) => e.id)).size !== d.essays.length) errors.push('essays: duplicate id')
  for (const id of d.selfcrit.texts) if (!d.texts.has(id)) errors.push(`insight-terms selfcrit: ${id} has no text`)
  for (const f of d.figures) {
    f.people.forEach((id) => need(ids.person, id, `figure ${f.id}`))
    f.events.forEach((id) => need(ids.event, id, `figure ${f.id}`))
    f.counts.forEach((c) => needCite(c.cite, `figure ${f.id}`))
    if (!f.counts.length && !f.need) errors.push(`figure ${f.id}: no counts and no need`)
    for (const c of f.counts) if (c.measure === 'none' && c.value) errors.push(`figure ${f.id}: "${c.what}" is measure none but has a value`)
  }
  for (const u of d.counties) {
    u.counts.forEach((c) => needCite(c.cite, `county ${u.id}`))
    if (u.revcom) needCite(u.revcom.cite, `county ${u.id} revcom`)
    if (!u.counts.length && !u.revcom) errors.push(`county ${u.id}: no counts and no revcom`)
  }
  for (const r of d.revcoms) {
    need(ids.org, r.org, `revcom ${r.province}`)
    needCite(r.cite, `revcom ${r.province}`)
    if (!d.provinces.has(r.province)) errors.push(`revcom ${r.province}: not a basemap province`)
  }
  if (new Set(d.revcoms.map((r) => r.province)).size !== d.revcoms.length) errors.push('revcoms: a province appears twice')
  for (const s of d.series) {
    s.events.forEach((id) => need(ids.event, id, `series ${s.id}`))
    s.points.forEach((p) => needCite(p.cite, `series ${s.id} ${p.year}`))
    // two first-published numbers for one year that disagree are a revision and must be marked as one
    const first = new Map<number, number>()
    for (const p of s.points) {
      if (p.kind !== 'reported') continue
      if (first.has(p.year) && first.get(p.year) !== p.value) errors.push(`series ${s.id}: two reported values for ${p.year}`)
      first.set(p.year, p.value)
    }
  }
  for (const p of d.pressTerms) {
    if (p.concept && !ids.concept.has(p.concept)) errors.push(`press-terms ${p.id}: unknown concept ${p.concept}`)
    if (p.ism && !ids.ism.has(p.ism)) errors.push(`press-terms ${p.id}: unknown ism ${p.ism}`)
  }
}
