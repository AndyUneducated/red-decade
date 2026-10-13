// Stage 5: corpus counts, the atlas, and the files under public/data.
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import type { Atlas } from '../../src/data/schema.ts'
import { namesNear, tally, termHits, titleMentions, yearTotals, type CorpusText } from '../../src/derive/corpus.ts'
import { errors, path } from './io.ts'
import type { Data } from './load.ts'

// Press: editorials and news reports 1966–1976, the years the press corpus covers with several texts a year.
const PRESS_KINDS = new Set(['editorial', 'news', 'press'])
// Official voice, for whom the texts invoke as authority (insight B).
const OFFICIAL_KINDS = new Set(['party-doc', 'editorial', 'speech', 'news', 'press'])
// Texts that argue with other texts, for the citation graph (insight F).
const CITING_KINDS = new Set(['party-doc', 'editorial', 'speech', 'news', 'press', 'redguard', 'essay', 'judicial', 'letter'])
// Periods for the names found near each concept (insight A); dates compare as strings.
const PERIODS = [
  { label: '1965 年以前', from: '', to: '1966' },
  { label: '1966–1969', from: '1966', to: '1970' },
  { label: '1970–1976', from: '1970', to: '1977' },
  { label: '1977–1989', from: '1977', to: '1990' },
]

export function compile(d: Data) {
  const corpus: CorpusText[] = [...d.texts.entries()]
    .map(([id, body]) => ({ id, body, source: d.sourceById.get(id)! }))
    .filter((t) => t.source.kind !== 'index' && !t.source.excerpt)
    .sort((a, b) => a.source.date.localeCompare(b.source.date))
    .map((t) => ({ id: t.id, date: t.source.date, body: t.body }))
  const kindOf = (t: CorpusText) => d.sourceById.get(t.id)!.kind
  const pressTexts = corpus.filter((t) => PRESS_KINDS.has(kindOf(t)) && t.date >= '1966' && t.date < '1977')
  const press = tally(pressTexts, d.pressTerms)
  for (const p of press.terms) if (!p.total) errors.push(`press-terms ${p.id}: no hits in the press corpus`)
  const authorities = tally(
    corpus.filter((t) => OFFICIAL_KINDS.has(kindOf(t)) && t.date < '1990'),
    d.authorities,
  )
  // listed by hand, so excerpts count too
  const selfcritTexts = d.selfcrit.texts.flatMap((id) => (d.texts.has(id) ? [{ id, date: d.sourceById.get(id)!.date, body: d.texts.get(id)! }] : []))
  const selfcrit = {
    texts: selfcritTexts.map((t) => ({ id: t.id, chars: t.body.length })),
    phrases: d.selfcrit.phrases.map(({ except, ...p }) => ({ id: p.id, name: p.name, hits: termHits(selfcritTexts, p.terms, except) })),
  }
  const citations = titleMentions(
    corpus.filter((t) => CITING_KINDS.has(kindOf(t))),
    d.sources.map((s) => ({ id: s.id, date: s.date, names: [s.alias, s.title.length >= 5 ? s.title : undefined].filter((n): n is string => !!n) })),
  )

  const personByName = new Map(d.people.map((p) => [p.name, p.id]))
  const names = d.people.map((p) => ({ id: p.id, names: [p.name] }))
  const near = (terms: string[]) =>
    PERIODS.map(({ label, from, to }) => {
      const texts = corpus.filter((t) => t.date >= from && t.date < to)
      const own = names.filter((n) => !terms.some((term) => term.includes(n.names[0]) || n.names[0].includes(term)))
      const people = [...namesNear(texts, terms, own)]
        .sort((a, b) => b[1] - a[1])
        // nine, so that eight remain when the page hides Mao, who is named near almost every term as the authority
        .slice(0, 9)
        .map(([id, n]) => ({ id, n }))
      return { period: label, people }
    }).filter((p) => p.people.length)
  const atlas: Atlas = {
    builtAt: new Date().toISOString(),
    people: d.people,
    factions: d.factions,
    orgs: d.orgs,
    places: d.places,
    events: d.events.sort((a, b) => a.date.localeCompare(b.date)),
    relations: d.relations,
    concepts: d.concepts.map((c) => ({ ...c, hits: termHits(corpus, c.terms), near: near(c.terms) })),
    isms: d.isms.map((m) => ({ ...m, carriers: m.carriers.map((name) => ({ name, person: personByName.get(name) })), hits: termHits(corpus, m.terms) })),
    line: d.line,
    corpus: yearTotals(corpus),
    press,
    authorities,
    selfcrit,
    citations,
    documents: d.documents.map((doc) => ({ ...doc, source: d.sourceById.get(doc.id)! })),
    sources: d.sources,
    claims: d.claims,
    topics: d.topics,
    archive: d.archive,
    figures: d.figures,
    counties: d.counties,
    revcoms: d.revcoms.sort((a, b) => a.date.localeCompare(b.date)),
    series: d.series.map((s) => ({ ...s, points: s.points.sort((a, b) => a.year - b.year) })),
  }
  return { atlas, pressTexts }
}

export function write(d: Data, atlas: Atlas) {
  const out = path('public', 'data')
  mkdirSync(path('public', 'data', 'texts'), { recursive: true })
  writeFileSync(path('public', 'data', 'atlas.json'), JSON.stringify(atlas))
  for (const id of d.texts.keys()) copyFileSync(path('sources', 'text', `${id}.txt`), `${out}/texts/${id}.txt`)
}

export function stats(d: Data, pressTexts: number): string {
  const { people, orgs, events, places, isms, figures, counties, series, revcoms } = d
  const verified = (xs: { verify?: boolean }[]) => xs.filter((x) => !x.verify).length
  const positions = people.flatMap((p) => p.positions)
  const leaders = orgs.flatMap((o) => o.leaders)
  const unplaced = counties.filter((u) => !u.geo).map((u) => u.id)
  // a province revcom's org `from` is general reference and may differ from the dated report
  const drift = revcoms.flatMap((r) => {
    const o = orgs.find((o) => o.id === r.org)
    return o?.from && r.kind !== 'seized' && o.from !== r.date ? [`${r.org} ${o.from}→${r.date}`] : []
  })
  return [
    `people     ${people.length}  (${people.filter((p) => p.life.length >= 3).length} full bios, avg ${(people.reduce((s, p) => s + p.fate.length, 0) / people.length).toFixed(1)} fate nodes)`,
    `factions   ${d.factions.length}`,
    `orgs       ${orgs.length}  (${verified(orgs)} sourced; ${positions.filter((x) => x.org).length}/${positions.length} positions linked)`,
    `leaders    ${leaders.length} in ${orgs.filter((o) => o.leaders.length).length} orgs  (${leaders.filter((l) => l.person).length} linked to people, ${leaders.filter((l) => l.cite).length} sourced)`,
    `places     ${places.length}  (birth ${people.filter((p) => p.birthAt).length}/${people.filter((p) => p.birthplace).length}, death ${people.filter((p) => p.deathAt).length}/${people.filter((p) => p.deathPlace).length} resolved)`,
    `events     ${events.length}  (${verified(events)} sourced, ${events.length - verified(events)} 待核)`,
    `relations  ${d.relations.length}`,
    `concepts   ${d.concepts.length}`,
    `isms       ${isms.length}  (${isms.filter((m) => m.pos.length).length} placed on the spectrum, ${isms.reduce((n, m) => n + m.carriers.length, 0)} carriers; line ${d.line.length} points)`,
    `press      ${d.pressTerms.length} terms over ${pressTexts} press texts 1966–1976`,
    `documents  ${d.documents.length}`,
    `sources    ${d.sources.length}  (${d.texts.size} with text)`,
    `claims     ${d.claims.length}`,
    `archive    ${d.archive.length}  (${d.archive.filter((a) => a.image).length} with images, ${new Set(d.archive.map((a) => a.date.slice(0, 4))).size} years)`,
    `figures    ${figures.length}  (${figures.reduce((n, f) => n + f.counts.length, 0)} counts, ${figures.filter((f) => f.need).length} awaiting sources)`,
    `counties   ${counties.length}  (${counties.reduce((n, u) => n + u.counts.length, 0)} counts, ${new Set(counties.flatMap((u) => u.counts.map((c) => c.cite))).size} sources; ${counties.length - unplaced.length} placed${unplaced.length ? ', unplaced: ' + unplaced.join(' ') : ''})`,
    `series     ${series.length}  (${series.reduce((n, s) => n + s.points.length, 0)} points, ${new Set(series.flatMap((s) => s.points.map((p) => p.cite))).size} sources)`,
    `revcoms    ${revcoms.length}  (${drift.length} org dates differ: ${drift.join(', ') || '—'})`,
  ].join('\n')
}
