// Stage 1: read every YAML file and source text and validate each record against its schema.
import { readdirSync, readFileSync } from 'node:fs'
import { z } from 'zod'
import {
  ArchiveItemSchema,
  ClaimSchema,
  ConceptSchema,
  CountySchema,
  DocumentSchema,
  EssaySchema,
  EventSchema,
  FactionSchema,
  FigureSchema,
  IsmSchema,
  LeaderSchema,
  LinePointSchema,
  OrgSchema,
  PersonQuoteSchema,
  PersonSchema,
  PlaceSchema,
  PressTermSchema,
  RelationSchema,
  RevcomSchema,
  SeriesSchema,
  SourceSchema,
  TopicSchema,
  type Source,
} from '../../src/data/schema.ts'
import { errors, exists, load, path, read, yamlFiles } from './io.ts'

export type Data = ReturnType<typeof loadAll>

function loadSources() {
  const hasText = (id: unknown) => exists('sources', 'text', `${id}.txt`)
  const fetchLog = new Map<string, { revid?: number; url?: string }>()
  if (exists('research', 'fetch-log.jsonl'))
    for (const line of readFileSync(path('research', 'fetch-log.jsonl'), 'utf8').split('\n').filter(Boolean)) {
      const rec = JSON.parse(line)
      if (rec.status === 'ok') fetchLog.set(rec.id, rec)
    }
  const manifests = yamlFiles('research', 'manifests').map((p) => read(...p) as { wikisource?: Record<string, unknown>[]; web?: Record<string, unknown>[] })
  const wikisource = manifests.flatMap((m) =>
    (m.wikisource ?? []).map((s) => ({
      ...s,
      tier: 1,
      url: fetchLog.get(s.id as string)?.url ?? `https://zh.wikisource.org/wiki/${encodeURIComponent(s.title as string)}`,
      revid: fetchLog.get(s.id as string)?.revid,
      hasText: hasText(s.id),
    })),
  )
  // article/start/end/keep only steer the fetcher
  const web = manifests.flatMap((m) => (m.web ?? []).map(({ article, start, end, keep, ...s }) => ({ ...s, tier: 1, hasText: hasText(s.id) })))
  const extra = exists('content', 'sources.yaml') ? read('content', 'sources.yaml') : []
  const sources: Source[] = load(SourceSchema, [...wikisource, ...web, ...extra], 'sources')
  const texts = new Map<string, string>()
  for (const s of sources) if (s.hasText) texts.set(s.id, readFileSync(path('sources', 'text', `${s.id}.txt`), 'utf8'))
  return { sources, sourceById: new Map(sources.map((s) => [s.id, s])), texts }
}

function loadPeople() {
  // people.yaml holds the 1966 cast; later batches live in content/people/*.yaml
  const people = [
    ...load(PersonSchema, read('content', 'people.yaml'), 'people'),
    ...(exists('content', 'people') ? yamlFiles('content', 'people').flatMap((p) => load(PersonSchema, read(...p), p.join('/'))) : []),
  ]
  // quotes by and about people are kept apart from the biographies: content/quotes/*.yaml maps person id → quotes
  if (exists('content', 'quotes'))
    for (const f of yamlFiles('content', 'quotes'))
      for (const [id, list] of Object.entries((read(...f) ?? {}) as Record<string, unknown[]>)) {
        const p = people.find((x) => x.id === id)
        if (p) p.quotes.push(...load(PersonQuoteSchema, list, `${f.join('/')} ${id}`))
        else errors.push(`${f.join('/')}: no person ${id}`)
      }
  type PhotoRec = { file?: string; url?: string; author?: string; license?: string; date?: string; focus?: string; zoom?: number; skip?: boolean }
  const photos: Record<string, PhotoRec> = exists('content', 'photos.yaml') ? (read('content', 'photos.yaml') ?? {}) : {}
  for (const p of people) {
    const r = photos[p.id]
    if (!r?.file || r.skip || !exists('public', 'photos', `${p.id}.jpg`)) continue
    p.photo = { src: `photos/${p.id}.jpg`, url: r.url, author: r.author, license: r.license, date: r.date, focus: r.focus, zoom: r.zoom }
  }
  return people
}

function loadOrgs() {
  const orgs = yamlFiles('content', 'orgs').flatMap((p) => load(OrgSchema, read(...p), p.join('/')))
  // content/leaders/*.yaml maps org id → leaders
  for (const p of yamlFiles('content', 'leaders'))
    for (const [id, list] of Object.entries((read(...p) ?? {}) as Record<string, unknown>)) {
      const o = orgs.find((o) => o.id === id)
      if (o) o.leaders.push(...load(LeaderSchema, list, `${p.join('/')} ${id}`))
      else errors.push(`${p.join('/')}: unknown org "${id}"`)
    }
  return orgs
}

function loadCounties() {
  // counties.yaml holds the cleanup-record register; per-province gazetteer batches live in counties-*.yaml
  const files = ['counties.yaml', ...readdirSync(path('content')).filter((f) => /^counties-.+\.yaml$/.test(f)).sort()]
  const counties = files.flatMap((f) => load(CountySchema, read('content', f), f))
  for (const [id, g] of Object.entries((read('content', 'county-geo.yaml') ?? {}) as Record<string, unknown>)) {
    const u = counties.find((u) => u.id === id)
    const r = CountySchema.shape.geo.safeParse(g)
    if (!u) errors.push(`county-geo: unknown county ${id}`)
    else if (!r.success) errors.push(`county-geo ${id}: ${r.error.issues[0].message}`)
    else u.geo = r.data
  }
  return counties
}

// content/archive/commons.yaml maps id → record (generated); every other file there is a hand-written list.
// Each People's Daily page the library transcribes from is an item too, one per page however many articles.
function loadArchive(sources: Source[]) {
  const files = exists('content', 'archive') ? yamlFiles('content', 'archive') : []
  const items = files.flatMap((p) => {
    const raw = read(...p)
    const list = p.at(-1) === 'commons.yaml' ? Object.entries((raw ?? {}) as Record<string, { skip?: boolean }>).filter(([, r]) => !r.skip).map(([id, r]) => ({ ...r, id, skip: undefined })) : raw
    return load(ArchiveItemSchema, list, p.join('/'))
  })
  const pages = new Map<string, Source[]>()
  for (const s of sources) {
    const m = s.hasText && s.via?.match(/^《人民日报》(\d{4}-\d{2}-\d{2}) 第 (\d+) 版/)
    if (m) pages.set(`${m[1]}-${m[2]}`, [...(pages.get(`${m[1]}-${m[2]}`) ?? []), s])
  }
  for (const [key, list] of pages) {
    const [date, n] = [key.slice(0, 10), key.slice(11)]
    items.push(
      ...load(
        ArchiveItemSchema,
        [
          {
            id: `rmrb-page-${key}`,
            kind: 'publication',
            title: `《人民日报》${date} 第 ${n} 版`,
            date,
            cite: list[0].id,
            url: list[0].url,
            // legal-person works: 50 years from first publication (PRC Copyright Law)
            license: +date.slice(0, 4) <= 1976 ? '发表已满 50 年（法人作品著作权保护期 50 年）' : '版权状态未明',
            description: `库内收录本版 ${list.length} 篇：${list.map((s) => s.title).join('；')}`.slice(0, 300),
            via: list[0].via,
          },
        ],
        `archive ${key}`,
      ),
    )
  }
  for (const a of items) if (exists('public', 'archive', `${a.id}.jpg`)) a.image = `archive/${a.id}.jpg`
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}

function loadInsightTerms() {
  const f = (read('content', 'insight-terms.yaml') ?? {}) as { authorities?: unknown; selfcrit?: { texts?: unknown; phrases?: unknown } }
  return {
    authorities: load(PressTermSchema, f.authorities, 'insight-terms authorities'),
    selfcrit: {
      texts: load(z.string(), f.selfcrit?.texts, 'insight-terms selfcrit.texts'),
      phrases: load(PressTermSchema, f.selfcrit?.phrases, 'insight-terms selfcrit.phrases'),
    },
  }
}

export function loadAll() {
  const one = <T extends Parameters<typeof load>[0]>(schema: T, file: string, dir = 'content') => load(schema, read(dir, `${file}.yaml`), file)
  const src = loadSources()
  return {
    ...loadInsightTerms(),
    ...src,
    people: loadPeople(),
    factions: one(FactionSchema, 'factions'),
    events: yamlFiles('content', 'events').flatMap((p) => load(EventSchema, read(...p), p.join('/'))),
    relations: one(RelationSchema, 'relations'),
    concepts: one(ConceptSchema, 'concepts'),
    documents: one(DocumentSchema, 'documents'),
    claims: one(ClaimSchema, 'claims', 'research'),
    topics: one(TopicSchema, 'topics'),
    // one essay per file, in file-name order
    essays: exists('content', 'essays') ? yamlFiles('content', 'essays').flatMap((p) => load(EssaySchema, [read(...p)], p.join('/'))) : [],
    archive: loadArchive(src.sources),
    figures: one(FigureSchema, 'figures'),
    counties: loadCounties(),
    revcoms: one(RevcomSchema, 'revcoms'),
    series: one(SeriesSchema, 'series'),
    orgs: loadOrgs(),
    places: one(PlaceSchema, 'places'),
    isms: one(IsmSchema, 'isms'),
    line: one(LinePointSchema, 'line'),
    pressTerms: one(PressTermSchema, 'press-terms'),
    // revcom rows are drawn on the basemap by province name
    provinces: new Set(
      (JSON.parse(readFileSync(path('public', 'geo', 'basemap.json'), 'utf8')).features as { properties: { n: string; k: string } }[])
        .filter((f) => f.properties.k === 'p')
        .map((f) => f.properties.n),
    ),
  }
}
