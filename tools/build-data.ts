// Compiles content/*.yaml + research/*.yaml + sources/text into public/data.
// Fails on schema errors, dangling ids, or quotes that do not occur verbatim in their source.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { z } from 'zod'
import {
  ClaimSchema,
  ConceptSchema,
  DocumentSchema,
  EventSchema,
  FactionSchema,
  FigureSchema,
  CountySchema,
  IsmSchema,
  LeaderSchema,
  LinePointSchema,
  OrgSchema,
  PersonSchema,
  PlaceSchema,
  RelationSchema,
  SourceSchema,
  type Atlas,
  type ConceptHit,
  type Source,
} from '../src/data/schema.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (...p: string[]) => parse(readFileSync(join(ROOT, ...p), 'utf8'))
const yamlFiles = (...p: string[]) =>
  readdirSync(join(ROOT, ...p))
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .map((f) => [...p, f])

const errors: string[] = []
function load<T extends z.ZodType>(schema: T, data: unknown, label: string): z.infer<T>[] {
  const result = z.array(schema).safeParse(data ?? [])
  if (!result.success) {
    for (const issue of result.error.issues) errors.push(`${label}: ${issue.path.join('.')} ${issue.message}`)
    return []
  }
  return result.data
}

// ── sources ──────────────────────────────────────────────
const textDir = join(ROOT, 'sources', 'text')
const fetchLog = new Map<string, { revid?: number; url?: string }>()
if (existsSync(join(ROOT, 'research', 'fetch-log.jsonl')))
  for (const line of readFileSync(join(ROOT, 'research', 'fetch-log.jsonl'), 'utf8').split('\n').filter(Boolean)) {
    const rec = JSON.parse(line)
    if (rec.status === 'ok') fetchLog.set(rec.id, rec)
  }

const manifestSources = yamlFiles('research', 'manifests').flatMap((p) =>
  ((read(...p) as { wikisource?: Record<string, unknown>[] }).wikisource ?? []).map((m) => ({
    ...m,
    tier: 1,
    url: fetchLog.get(m.id as string)?.url ?? `https://zh.wikisource.org/wiki/${encodeURIComponent(m.title as string)}`,
    revid: fetchLog.get(m.id as string)?.revid,
    hasText: existsSync(join(textDir, `${m.id}.txt`)),
  })),
)
const webSources = yamlFiles('research', 'manifests').flatMap((p) =>
  ((read(...p) as { web?: Record<string, unknown>[] }).web ?? []).map(({ article, start, end, keep, ...m }) => ({
    ...m,
    tier: 1,
    hasText: existsSync(join(textDir, `${m.id}.txt`)),
  })),
)
manifestSources.push(...webSources)
const extraSources = existsSync(join(ROOT, 'content', 'sources.yaml')) ? read('content', 'sources.yaml') : []
const sources: Source[] = load(SourceSchema, [...manifestSources, ...extraSources], 'sources')
const sourceById = new Map(sources.map((s) => [s.id, s]))
const texts = new Map<string, string>()
for (const s of sources) if (s.hasText) texts.set(s.id, readFileSync(join(textDir, `${s.id}.txt`), 'utf8'))

// ── content ──────────────────────────────────────────────
// people.yaml holds the 1966 cast; later batches live in content/people/*.yaml
const people = [
  ...load(PersonSchema, read('content', 'people.yaml'), 'people'),
  ...(existsSync(join(ROOT, 'content', 'people'))
    ? yamlFiles('content', 'people').flatMap((p) => load(PersonSchema, read(...p), p.join('/')))
    : []),
]
type PhotoRec = { file?: string; url?: string; author?: string; license?: string; date?: string; focus?: string; zoom?: number; skip?: boolean }
const photoReg: Record<string, PhotoRec> = existsSync(join(ROOT, 'content', 'photos.yaml')) ? (read('content', 'photos.yaml') ?? {}) : {}
for (const p of people) {
  const r = photoReg[p.id]
  if (!r?.file || r.skip || !existsSync(join(ROOT, 'public', 'photos', `${p.id}.jpg`))) continue
  p.photo = { src: `photos/${p.id}.jpg`, url: r.url, author: r.author, license: r.license, date: r.date, focus: r.focus, zoom: r.zoom }
}
const factions = load(FactionSchema, read('content', 'factions.yaml'), 'factions')
const events = yamlFiles('content', 'events').flatMap((p) => load(EventSchema, read(...p), p.join('/')))
const relations = load(RelationSchema, read('content', 'relations.yaml'), 'relations')
const concepts = load(ConceptSchema, read('content', 'concepts.yaml'), 'concepts')
const documents = load(DocumentSchema, read('content', 'documents.yaml'), 'documents')
const claims = load(ClaimSchema, read('research', 'claims.yaml'), 'claims')
const figures = load(FigureSchema, read('content', 'figures.yaml'), 'figures')
const counties = load(CountySchema, read('content', 'counties.yaml'), 'counties')
const orgs = yamlFiles('content', 'orgs').flatMap((p) => load(OrgSchema, read(...p), p.join('/')))
for (const p of yamlFiles('content', 'leaders'))
  for (const [id, list] of Object.entries((read(...p) ?? {}) as Record<string, unknown>)) {
    const o = orgs.find((o) => o.id === id)
    if (!o) errors.push(`${p.join('/')}: unknown org "${id}"`)
    else o.leaders.push(...load(LeaderSchema, list, `${p.join('/')} ${id}`))
  }
const places = load(PlaceSchema, read('content', 'places.yaml'), 'places')
const isms = load(IsmSchema, read('content', 'isms.yaml'), 'isms')
const line = load(LinePointSchema, read('content', 'line.yaml'), 'line')

// ── derived links: positions → orgs, birth/death strings → places ──
// A position without org takes the org whose name or alias equals its orgName; failing that, the org
// with the longest alias that begins its title. Written to .probe/org-links.txt for review, with a
// mark where the position falls outside the org's lifespan.
const aliasList = orgs.flatMap((o) => [o.name, ...o.aliases].map((a) => ({ a, o })))
const orgReport: string[] = []
for (const p of people)
  for (const x of p.positions) {
    if (!x.org) {
      const byName = aliasList.find(({ a }) => a === x.orgName)
      const byTitle = aliasList.filter(({ a }) => x.title.startsWith(a)).sort((m, n) => n.a.length - m.a.length)[0]
      // 中共中央政治局常委 under orgName 中共中央政治局 belongs to the sub-body the title names
      const child = byName && byTitle && byTitle.o.under.some((u) => u.org === byName.o.id)
      x.org = (child ? byTitle : (byName ?? byTitle))?.o.id
    }
    const o = orgs.find((o) => o.id === x.org)
    const outside = o && ((o.from && x.to && o.from.slice(0, 4) > x.to.slice(0, 4)) || (o.to && x.from && x.from.slice(0, 4) > o.to.slice(0, 4)))
    orgReport.push(`${(x.org ?? '-').padEnd(22)} ${outside ? '!' : ' '} ${p.id.padEnd(16)} ${x.from ?? '?'}–${x.to ?? ''} ${x.title} | ${x.orgName ?? ''}`)
  }
// Names in parentheses are notes (今属…), not the place itself; the longest name wins, ties go to the
// later (more specific) one, so 湖南湘潭韶山 resolves to 韶山.
function placeOf(text: string | undefined) {
  if (!text) return undefined
  const s = text.replace(/（[^）]*）/g, '')
  let best: { id: string; len: number; at: number } | undefined
  for (const pl of places)
    for (const n of [pl.name, ...pl.names]) {
      const at = s.lastIndexOf(n)
      if (at < 0) continue
      if (!best || n.length > best.len || (n.length === best.len && at > best.at)) best = { id: pl.id, len: n.length, at }
    }
  return best?.id
}
for (const p of people) {
  p.birthAt ??= placeOf(p.birthplace)
  p.deathAt ??= placeOf(p.deathPlace)
  orgReport.push(`@birth ${(p.birthAt ?? '-').padEnd(14)} ${p.id.padEnd(16)} ${p.birthplace ?? ''}`)
  if (p.died) orgReport.push(`@death ${(p.deathAt ?? '-').padEnd(14)} ${p.id.padEnd(16)} ${p.deathPlace ?? ''}`)
}
if (existsSync(join(ROOT, '.probe'))) writeFileSync(join(ROOT, '.probe', 'org-links.txt'), orgReport.join('\n'))

// leaders lists name people by their usual name; those in the atlas get linked
const personByName = new Map(people.map((p) => [p.name, p.id]))

// ── referential integrity ────────────────────────────────
const ids = {
  person: new Set(people.map((p) => p.id)),
  faction: new Set(factions.map((f) => f.id)),
  concept: new Set(concepts.map((c) => c.id)),
  event: new Set(events.map((e) => e.id)),
  org: new Set(orgs.map((o) => o.id)),
  place: new Set(places.map((p) => p.id)),
}
for (const [kind, list] of [
  ['person', people],
  ['faction', factions],
  ['event', events],
  ['concept', concepts],
  ['org', orgs],
  ['place', places],
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
  if (cite && !sourceById.has(cite.split('@')[0])) errors.push(`${where}: unknown source "${cite}"`)
}
for (const p of people) {
  for (const m of p.memberships ?? []) {
    needCite(m.cite, `person ${p.id} membership`)
    if (!p.factions.includes(m.f)) p.factions.push(m.f)
  }
  p.factions.forEach((f) => need(ids.faction, f, `person ${p.id}`))
  p.cites.forEach((c) => needCite(c, `person ${p.id}`))
  p.fate.forEach((f) => (needCite(f.cite, `person ${p.id} fate`), f.place && need(ids.place, f.place, `person ${p.id} fate`)))
  if (p.birthAt) need(ids.place, p.birthAt, `person ${p.id} birthAt`)
  if (p.deathAt) need(ids.place, p.deathAt, `person ${p.id} deathAt`)
  for (let i = 1; i < p.fate.length; i++)
    if (p.fate[i].date < p.fate[i - 1].date) errors.push(`person ${p.id}: fate out of order at ${p.fate[i].date}`)
  checkPersonFacts(p)
}

// Partial dates compare on their common prefix: "1966" is neither before nor after "1966-05".
function after(a: string, b: string) {
  const n = Math.min(a.length, b.length)
  return a.slice(0, n) > b.slice(0, n)
}
function checkPersonFacts(p: (typeof people)[number]) {
  const where = `person ${p.id}`
  const inLife = (d: string | undefined, what: string) => {
    if (!d) return
    if (p.born && after(p.born, d)) errors.push(`${where}: ${what} ${d} is before birth ${p.born}`)
    if (p.died && after(d, p.died)) errors.push(`${where}: ${what} ${d} is after death ${p.died}`)
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
}
for (const f of factions) f.cites.forEach((c) => needCite(c, `faction ${f.id}`))
for (const o of orgs) {
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
    l.person ??= personByName.get(l.name)
    if (l.person) need(ids.person, l.person, `${where} leader ${l.name}`)
    if (l.faction) need(ids.faction, l.faction, `${where} leader ${l.name}`)
    needCite(l.cite, `${where} leader ${l.name}`)
    span(l, `leader ${l.name}`)
    if (o.from && l.from && after(o.from, l.from)) errors.push(`${where} leader ${l.name}: starts ${l.from} before the org (${o.from})`)
    if (o.to && l.to && after(l.to, o.to)) errors.push(`${where} leader ${l.name}: ends ${l.to} after the org (${o.to})`)
  }
  o.leaders.sort((a, b) => (a.from ?? o.from ?? '').localeCompare(b.from ?? o.from ?? ''))
}
for (const e of events) {
  e.people.forEach((id) => need(ids.person, id, `event ${e.id}`))
  e.concepts.forEach((id) => need(ids.concept, id, `event ${e.id}`))
  e.docs.forEach((id) => needCite(id, `event ${e.id} docs`))
  e.cites.forEach((c) => needCite(c, `event ${e.id}`))
  e.voices.forEach((v) => needCite(v.cite, `event ${e.id} voice`))
  if (!e.cites.length && !e.verify) errors.push(`event ${e.id}: no cites and not marked verify`)
}
for (const r of relations) {
  need(ids.person, r.a, `relation ${r.a}→${r.b}`)
  need(ids.person, r.b, `relation ${r.a}→${r.b}`)
  needCite(r.cite, `relation ${r.a}→${r.b}`)
}
for (const c of concepts) {
  c.related.forEach((id) => need(ids.concept, id, `concept ${c.id}`))
  c.notes.forEach((n) => needCite(n.cite, `concept ${c.id}`))
}
const ismIds = new Set(isms.map((m) => m.id))
if (ismIds.size !== isms.length) errors.push('isms: duplicate id')
for (const m of isms) {
  const where = `ism ${m.id}`
  ;[...m.parents, ...m.against].forEach((id) => (need(ismIds, id, where), id === m.id && errors.push(`${where}: refers to itself`)))
  for (const id of m.parents) {
    const p = isms.find((x) => x.id === id)
    if (p && after(p.from, m.from)) errors.push(`${where}: starts (${m.from}) before its parent ${id} (${p.from})`)
  }
  m.concepts.forEach((id) => need(ids.concept, id, where))
  m.cites.forEach((c) => needCite(c, where))
  m.notes.forEach((n) => needCite(n.cite, where))
  if (m.to && after(m.from, m.to)) errors.push(`${where}: ends (${m.to}) before it starts (${m.from})`)
  for (const p of m.pos) if (after(m.from, p.at) || (m.to && after(p.at, m.to))) errors.push(`${where}: pos ${p.at} outside ${m.from}–${m.to ?? ''}`)
  for (let i = 1; i < m.pos.length; i++) if (after(m.pos[i - 1].at, m.pos[i].at)) errors.push(`${where}: pos out of order at ${m.pos[i].at}`)
}
for (let i = 1; i < line.length; i++) if (after(line[i - 1].at, line[i].at)) errors.push(`line: out of order at ${line[i].at}`)
for (const d of documents) {
  if (!sourceById.has(d.id)) errors.push(`document ${d.id}: no source record`)
  d.people.forEach((id) => need(ids.person, id, `document ${d.id}`))
  d.concepts.forEach((id) => need(ids.concept, id, `document ${d.id}`))
}
for (const c of claims) {
  c.people.forEach((id) => need(ids.person, id, `claim ${c.id}`))
  c.concepts.forEach((id) => need(ids.concept, id, `claim ${c.id}`))
  c.events.forEach((id) => need(ids.event, id, `claim ${c.id}`))
  c.evidence.forEach((e) => needCite(e.cite, `claim ${c.id}`))
}
for (const f of figures) {
  f.people.forEach((id) => need(ids.person, id, `figure ${f.id}`))
  f.events.forEach((id) => need(ids.event, id, `figure ${f.id}`))
  f.counts.forEach((c) => needCite(c.cite, `figure ${f.id}`))
  if (!f.counts.length && !f.need) errors.push(`figure ${f.id}: no counts and no need`)
  for (const c of f.counts) if (c.measure === 'none' && c.value) errors.push(`figure ${f.id}: "${c.what}" is measure none but has a value`)
}
{
  const seen = new Set<string>()
  for (const u of counties) {
    if (seen.has(u.id)) errors.push(`duplicate county id ${u.id}`)
    seen.add(u.id)
    u.counts.forEach((c) => needCite(c.cite, `county ${u.id}`))
    if (u.revcom) needCite(u.revcom.cite, `county ${u.id} revcom`)
    if (!u.counts.length && !u.revcom) errors.push(`county ${u.id}: no counts and no revcom`)
  }
}

// ── verbatim quote checks ────────────────────────────────
// Tolerated: nested ‘’ rendered as “”, and a sentence-final mark where the source continues.
const norm = (s: string) => s.replace(/[‘’]/g, (q) => (q === '‘' ? '“' : '”'))
function checkQuote(sourceId: string, quote: string, where: string) {
  const body = texts.get(sourceId)
  if (!body) return errors.push(`${where}: source ${sourceId} has no text to check quote against`)
  const hay = norm(body)
  for (const part of quote.split('……').map((s) => norm(s.trim()).replace(/[。！？，；]$/, '')).filter(Boolean))
    if (!hay.includes(part)) errors.push(`${where}: quote not found in ${sourceId}: "${part.slice(0, 40)}…"`)
}
for (const c of claims) for (const e of c.evidence) if (e.quote) checkQuote(e.cite.split('@')[0], e.quote, `claim ${c.id}`)
for (const f of figures) for (const c of f.counts) checkQuote(c.cite.split('@')[0], c.quote, `figure ${f.id} "${c.what}"`)
for (const u of counties) for (const c of u.counts) checkQuote(c.cite.split('@')[0], c.quote, `county ${u.id}`)
for (const u of counties) if (u.revcom) checkQuote(u.revcom.cite.split('@')[0], u.revcom.quote, `county ${u.id} revcom`)
for (const p of people)
  for (const v of p.assess)
    if (v.quote) {
      if (!v.cite) errors.push(`person ${p.id}: quoted ${v.voice} assessment has no cite`)
      else checkQuote(v.cite.split('@')[0], v.text.replace(/（[^）]*）$/, ''), `person ${p.id} assess ${v.voice}`)
    }
// Voice quotes may end with an attribution in full-width parentheses: “……”（刘少奇检讨）
for (const e of events)
  for (const v of e.voices)
    if (v.quote) {
      if (!v.cite) errors.push(`event ${e.id}: quoted ${v.voice} voice has no cite`)
      else checkQuote(v.cite.split('@')[0], v.text.replace(/（[^）]*）$/, ''), `event ${e.id} voice ${v.voice}`)
    }
for (const d of documents)
  for (const p of d.pairs ?? []) {
    checkQuote(p.against, p.original, `document ${d.id} pair ${p.point}`)
    checkQuote(d.id, p.rebuttal, `document ${d.id} pair ${p.point}`)
  }

// ── concordance ──────────────────────────────────────────
const datedTexts = [...texts.entries()]
  .map(([id, body]) => ({ id, body, source: sourceById.get(id)! }))
  .filter((t) => t.source.kind !== 'index' && !t.source.excerpt)
  .sort((a, b) => a.source.date.localeCompare(b.source.date))

function groupBy<T, K>(xs: T[], key: (x: T) => K) {
  const m = new Map<K, T[]>()
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x])
  return m
}

function hitsFor(terms: string[]): ConceptHit[] {
  const hits: ConceptHit[] = []
  for (const t of datedTexts) {
    let count = 0
    let first = -1
    let firstTerm = ''
    for (const term of terms) {
      const n = t.body.split(term).length - 1
      if (!n) continue
      count += n
      const i = t.body.indexOf(term)
      if (first < 0 || i < first) {
        first = i
        firstTerm = term
      }
    }
    if (!count) continue
    const context = t.body.slice(Math.max(0, first - 36), first + firstTerm.length + 36).replace(/\s+/g, ' ')
    hits.push({ source: t.id, date: t.source.date, count, context })
  }
  return hits
}

if (errors.length) {
  console.error(`\n${errors.length} error(s):\n` + errors.map((e) => `  ✗ ${e}`).join('\n'))
  process.exit(1)
}

const atlas: Atlas = {
  builtAt: new Date().toISOString(),
  people,
  factions,
  orgs,
  places,
  events: events.sort((a, b) => a.date.localeCompare(b.date)),
  relations,
  concepts: concepts.map((c) => ({ ...c, hits: hitsFor(c.terms) })),
  isms: isms.map((m) => ({ ...m, carriers: m.carriers.map((name) => ({ name, person: personByName.get(name) })), hits: hitsFor(m.terms) })),
  line,
  corpus: [...groupBy(datedTexts, (t) => Number(t.source.date.slice(0, 4)))].map(([year, ts]) => ({ year, docs: ts.length, chars: ts.reduce((n, t) => n + t.body.length, 0) })),
  documents: documents.map((d) => ({ ...d, source: sourceById.get(d.id)! })),
  sources,
  claims,
  figures,
  counties,
}

const out = join(ROOT, 'public', 'data')
mkdirSync(join(out, 'texts'), { recursive: true })
writeFileSync(join(out, 'atlas.json'), JSON.stringify(atlas))
for (const id of texts.keys()) copyFileSync(join(textDir, `${id}.txt`), join(out, 'texts', `${id}.txt`))

const verified = (xs: { verify?: boolean }[]) => xs.filter((x) => !x.verify).length
const positionsAll = people.reduce((s, p) => s + p.positions.length, 0)
const positionsLinked = people.reduce((s, p) => s + p.positions.filter((x) => x.org).length, 0)
console.log(
  [
    `people     ${people.length}  (${people.filter((p) => p.life.length >= 3).length} full bios, avg ${(people.reduce((s, p) => s + p.fate.length, 0) / people.length).toFixed(1)} fate nodes)`,
    `factions   ${factions.length}`,
    `orgs       ${orgs.length}  (${verified(orgs)} sourced; ${positionsLinked}/${positionsAll} positions linked)`,
    `leaders    ${orgs.reduce((n, o) => n + o.leaders.length, 0)} in ${orgs.filter((o) => o.leaders.length).length} orgs  (${orgs.reduce((n, o) => n + o.leaders.filter((l) => l.person).length, 0)} linked to people, ${orgs.reduce((n, o) => n + o.leaders.filter((l) => l.cite).length, 0)} sourced)`,
    `places     ${places.length}  (birth ${people.filter((p) => p.birthAt).length}/${people.filter((p) => p.birthplace).length}, death ${people.filter((p) => p.deathAt).length}/${people.filter((p) => p.deathPlace).length} resolved)`,
    `events     ${events.length}  (${verified(events)} sourced, ${events.length - verified(events)} 待核)`,
    `relations  ${relations.length}`,
    `concepts   ${concepts.length}`,
    `isms       ${isms.length}  (${isms.filter((m) => m.pos.length).length} placed on the spectrum, ${isms.reduce((n, m) => n + m.carriers.length, 0)} carriers; line ${line.length} points)`,
    `documents  ${documents.length}`,
    `sources    ${sources.length}  (${texts.size} with text)`,
    `claims     ${claims.length}`,
    `figures    ${figures.length}  (${figures.reduce((n, f) => n + f.counts.length, 0)} counts, ${figures.filter((f) => f.need).length} awaiting sources)`,
    `counties   ${counties.length}  (${counties.reduce((n, u) => n + u.counts.length, 0)} counts, ${new Set(counties.flatMap((u) => u.counts.map((c) => c.cite))).size} sources)`,
  ].join('\n'),
)
