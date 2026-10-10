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
  PersonSchema,
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
const people = load(PersonSchema, read('content', 'people.yaml'), 'people')
const factions = load(FactionSchema, read('content', 'factions.yaml'), 'factions')
const events = yamlFiles('content', 'events').flatMap((p) => load(EventSchema, read(...p), p.join('/')))
const relations = load(RelationSchema, read('content', 'relations.yaml'), 'relations')
const concepts = load(ConceptSchema, read('content', 'concepts.yaml'), 'concepts')
const documents = load(DocumentSchema, read('content', 'documents.yaml'), 'documents')
const claims = load(ClaimSchema, read('research', 'claims.yaml'), 'claims')

// ── referential integrity ────────────────────────────────
const ids = {
  person: new Set(people.map((p) => p.id)),
  faction: new Set(factions.map((f) => f.id)),
  concept: new Set(concepts.map((c) => c.id)),
  event: new Set(events.map((e) => e.id)),
  // institutions arrive in MP-3 (content/orgs.yaml); until then any position.org is an error
  org: new Set<string>(),
}
for (const [kind, list] of [['person', people], ['faction', factions], ['event', events], ['concept', concepts]] as const) {
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
  p.fate.forEach((f) => needCite(f.cite, `person ${p.id} fate`))
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
    span(s, `life "${s.h}"`)
  }
  p.assess.forEach((v) => needCite(v.cite, `${where} assess`))
  p.works.forEach((w) => needCite(w.cite, `${where} works`))
}
for (const f of factions) f.cites.forEach((c) => needCite(c, `faction ${f.id}`))
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
  events: events.sort((a, b) => a.date.localeCompare(b.date)),
  relations,
  concepts: concepts.map((c) => ({ ...c, hits: hitsFor(c.terms) })),
  documents: documents.map((d) => ({ ...d, source: sourceById.get(d.id)! })),
  sources,
  claims,
}

const out = join(ROOT, 'public', 'data')
mkdirSync(join(out, 'texts'), { recursive: true })
writeFileSync(join(out, 'atlas.json'), JSON.stringify(atlas))
for (const id of texts.keys()) copyFileSync(join(textDir, `${id}.txt`), join(out, 'texts', `${id}.txt`))

const verified = (xs: { verify?: boolean }[]) => xs.filter((x) => !x.verify).length
console.log(
  [
    `people     ${people.length}  (${people.filter((p) => p.life.length >= 3).length} full bios, avg ${(people.reduce((s, p) => s + p.fate.length, 0) / people.length).toFixed(1)} fate nodes)`,
    `factions   ${factions.length}`,
    `events     ${events.length}  (${verified(events)} sourced, ${events.length - verified(events)} 待核)`,
    `relations  ${relations.length}`,
    `concepts   ${concepts.length}`,
    `documents  ${documents.length}`,
    `sources    ${sources.length}  (${texts.size} with text)`,
    `claims     ${claims.length}`,
  ].join('\n'),
)
