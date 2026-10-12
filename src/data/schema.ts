// Shared data model. Authored content (content/*.yaml) is validated against these
// schemas by tools/build-data.ts; the app consumes the compiled public/data/atlas.json.
import { z } from 'zod'

// "1966", "1966-05", "1966-05-16"
const PartialDate = z.union([z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/), z.number().int()]).transform(String)

// "sourceId" or "sourceId@locator"
const Cite = z.string().regex(/^[a-z0-9-]+(@.+)?$/)

export const LANES = {
  center: '中央高层',
  ideology: '思想舆论',
  mass: '群众运动',
  army: '军队',
  culture: '文教',
  local: '地方',
  intl: '国际',
  econ: '经济社会',
} as const
export type Lane = keyof typeof LANES

export const STATUSES = {
  normal: '常态',
  rise: '崛起',
  power: '掌权',
  attacked: '受批判',
  sidelined: '靠边',
  purged: '被打倒',
  detained: '关押',
  dead: '死亡',
  restored: '复出/平反',
} as const
export type Status = keyof typeof STATUSES

export const RELATION_TYPES = {
  spouse: '配偶',
  patron: '提携/支持',
  ally: '同盟/同僚',
  subordinate: '下属/秘书',
  attack: '批判/攻击',
  persecute: '诬陷/迫害',
  protect: '保护/庇护',
  link: '被关联',
} as const
export type RelationType = keyof typeof RELATION_TYPES

export const VOICES = {
  doc: '原始文件',
  official1966: '当时官方',
  // contemporary foreign government records: FRUS memoranda of conversation, intelligence estimates
  foreign: '外国档案',
  official1981: '1981 决议',
  // later official verdicts other than the 1981 resolution: 1977 plenum, rehabilitation notices, obituaries
  officialLater: '后来官方',
  judicial1980: '1980 年代审判',
  witness: '亲历者',
  scholar: '学术研究',
  editor: '本站研究',
} as const
export type Voice = keyof typeof VOICES

// quote: text is verbatim from cite (checked at build time); otherwise it is a paraphrase.
const Voiced = z.object({
  voice: z.enum(Object.keys(VOICES) as [Voice, ...Voice[]]),
  text: z.string(),
  cite: Cite.optional(),
  quote: z.boolean().optional(),
})

// place: id in content/places.yaml, for detention and exile on the footprint map
export const FateSchema = z.object({
  date: PartialDate,
  s: z.enum(Object.keys(STATUSES) as [Status, ...Status[]]),
  note: z.string().optional(),
  place: z.string().optional(),
  cite: Cite.optional(),
  verify: z.boolean().optional(),
})

// Coordinates are approximate county-seat or city-centre values (about 0.1°).
// names are matched against birthplace/deathPlace strings; far places are listed but not drawn.
export const PlaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  names: z.array(z.string()).default([]),
  lat: z.number(),
  lon: z.number(),
  far: z.boolean().optional(),
})

export const ORG_KINDS = {
  party: '党',
  state: '政',
  army: '军',
  mass: '群团',
  popular: '群众组织',
  unit: '单位',
} as const
export type OrgKind = keyof typeof ORG_KINDS

export const ORG_LEVELS = { central: '中央', regional: '大区', provincial: '省市', local: '地县', basic: '基层' } as const

// a link points from this org to another: this org 领导/设立/… that org
export const ORG_LINKS = {
  lead: '领导',
  found: '设立',
  oppose: '对立',
  merge: '并入',
  takeover: '夺权 / 接管',
  replace: '取代',
} as const
export type OrgLink = keyof typeof ORG_LINKS

const Span = { from: PartialDate.optional(), to: PartialDate.optional() }

// A head of an org, including people not in people.yaml (shown without a link); person is filled at
// build time when name matches someone in the atlas. title is the exact title (第一书记、主任、司令员…).
// Entries without cite come from general reference and count as 待核.
export const LeaderSchema = z.object({
  name: z.string(),
  person: z.string().optional(),
  title: z.string(),
  ...Span,
  // faction during this tenure, for heads not in people.yaml (those in it use their memberships)
  faction: z.string().optional(),
  note: z.string().optional(),
  cite: Cite.optional(),
})

// aliases are matched against positions.orgName (and the start of positions.title) at build time,
// so positions need not name the org id explicitly
export const OrgSchema = z.object({
  id: z.string(),
  name: z.string(),
  short: z.string().optional(),
  aliases: z.array(z.string()).default([]),
  kind: z.enum(Object.keys(ORG_KINDS) as [OrgKind, ...OrgKind[]]),
  level: z.enum(Object.keys(ORG_LEVELS) as [keyof typeof ORG_LEVELS, ...(keyof typeof ORG_LEVELS)[]]),
  ...Span,
  // periods when the body existed on paper but did not function (e.g. party committees after the 1967 power seizures)
  suspended: z.array(z.object({ from: PartialDate, to: PartialDate.optional(), note: z.string().optional() })).default([]),
  places: z.array(z.object({ at: z.string(), ...Span })).default([]),
  under: z.array(z.object({ org: z.string(), ...Span })).default([]),
  links: z
    .array(
      z.object({
        org: z.string(),
        kind: z.enum(Object.keys(ORG_LINKS) as [OrgLink, ...OrgLink[]]),
        date: PartialDate.optional(),
        to: PartialDate.optional(),
        note: z.string().optional(),
        cite: Cite.optional(),
        verify: z.boolean().optional(),
      }),
    )
    .default([]),
  factions: z.array(z.string()).default([]),
  // Succession of heads; usually kept in content/leaders/*.yaml (org id → list) and merged at build.
  leaders: z.array(LeaderSchema).default([]),
  summary: z.string(),
  cites: z.array(Cite).default([]),
  verify: z.boolean().optional(),
})

export const ALIAS_KINDS = {
  original: '原名',
  courtesy: '字',
  art: '号',
  pen: '笔名',
  cover: '化名',
  other: '又名',
} as const

export const DEATH_KINDS = {
  natural: '病故',
  suicide: '自杀',
  persecuted: '被迫害致死',
  executed: '处决',
  killed: '被杀',
  accident: '事故',
  war: '战死',
  unknown: '不明',
} as const
export type DeathKind = keyof typeof DEATH_KINDS

// a fact with its own date span and source, used for education, positions, rehabilitation, afterlife
const Dated = {
  from: PartialDate.optional(),
  to: PartialDate.optional(),
  note: z.string().optional(),
  cite: Cite.optional(),
  verify: z.boolean().optional(),
}

// one section of a full biography (MP-2); h is the section heading, e.g. 家世与早年
const LifeSection = z.object({
  h: z.string(),
  from: PartialDate.optional(),
  to: PartialDate.optional(),
  text: z.string(),
  cites: z.array(Cite).default([]),
  verify: z.boolean().optional(),
})

// a line said or written by the person (by omitted) or about them (by: person id, or a body such as 中共中央);
// always verbatim from cite. Dated quotes sit in the life section that covers the date; note is the occasion.
export const PersonQuoteSchema = z.object({
  text: z.string(),
  cite: Cite,
  by: z.string().optional(),
  date: PartialDate.optional(),
  note: z.string().optional(),
  voice: z.enum(Object.keys(VOICES) as [Voice, ...Voice[]]).optional(),
})
export type PersonQuote = z.infer<typeof PersonQuoteSchema>

export const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  pinyin: z.string().optional(),
  // plain strings are accepted as kind 'other'
  aka: z
    .array(z.union([z.string(), z.object({ kind: z.enum(Object.keys(ALIAS_KINDS) as [keyof typeof ALIAS_KINDS]), name: z.string() })]))
    .transform((xs) => xs.map((x) => (typeof x === 'string' ? { kind: 'other' as const, name: x } : x)))
    .optional(),
  gender: z.enum(['m', 'f']).optional(),
  ethnicity: z.string().optional(),
  // 出生地 and 籍贯 are kept apart, as Chinese biographies do
  birthplace: z.string().optional(),
  origin: z.string().optional(),
  // 家庭出身 as recorded (地主、富农、职员、工人……); classNote explains disputes or later reclassification
  classOrigin: z.string().optional(),
  classNote: z.string().optional(),
  born: PartialDate.optional(),
  died: PartialDate.optional(),
  death: z.string().optional(),
  deathKind: z.enum(Object.keys(DEATH_KINDS) as [DeathKind, ...DeathKind[]]).optional(),
  deathPlace: z.string().optional(),
  // place ids for the footprint map; derived from birthplace/deathPlace by build-data when omitted
  birthAt: z.string().optional(),
  deathAt: z.string().optional(),
  // the cause itself is disputed (e.g. suicide vs. killed); the dispute belongs in life/assess voices
  deathContested: z.boolean().optional(),
  education: z.array(z.object({ school: z.string(), ...Dated })).default([]),
  // party: 中国共产党 unless stated; joinedRevolution: 参加革命 / 参加工作
  party: z.string().optional(),
  joinedParty: PartialDate.optional(),
  joinedRevolution: PartialDate.optional(),
  // org: id in content/orgs.yaml (MP-3); orgName when the body is not modelled
  // sys overrides the lane (党/政/军/其他) guessed by systemOf in src/lib/positions.ts
  positions: z
    .array(
      z.object({
        title: z.string(),
        org: z.string().optional(),
        orgName: z.string().optional(),
        sys: z.enum(['party', 'gov', 'army', 'other']).optional(),
        ...Dated,
      }),
    )
    .default([]),
  rank: z.object({ rank: z.string(), date: PartialDate, cite: Cite.optional() }).optional(),
  rehab: z.array(z.object({ date: PartialDate, text: z.string(), cite: Cite.optional(), verify: z.boolean().optional() })).default([]),
  afterlife: z.array(z.object({ date: PartialDate, text: z.string(), cite: Cite.optional(), verify: z.boolean().optional() })).default([]),
  ids: z.object({ wikidata: z.string().regex(/^Q\d+$/).optional(), cbdb: z.string().optional() }).optional(),
  tier: z.number().int().min(1).max(3),
  role1966: z.string(),
  // bio is the lead (概述); life holds the full biography by section
  bio: z.string(),
  life: z.array(LifeSection).default([]),
  assess: z.array(Voiced).default([]),
  quotes: z.array(PersonQuoteSchema).default([]),
  works: z.array(z.object({ title: z.string(), date: PartialDate.optional(), cite: Cite.optional() })).default([]),
  // every faction the person ever belonged to; factions[0] is the default primary
  factions: z.array(z.string()),
  // time-scoped primary faction, for people who changed sides (overrides factions[0] inside each span)
  memberships: z
    .array(z.object({ f: z.string(), from: PartialDate.optional(), to: PartialDate.optional(), note: z.string().optional(), cite: Cite.optional() }))
    .optional(),
  fate: z.array(FateSchema).default([]),
  cites: z.array(Cite).default([]),
  verify: z.boolean().optional(),
  // attached by build-data from content/photos.yaml when public/photos/<id>.jpg exists
  photo: z
    .object({
      src: z.string(),
      url: z.string().optional(),
      author: z.string().optional(),
      license: z.string().optional(),
      date: z.string().optional(),
      focus: z.string().optional(),
      zoom: z.number().min(1).max(4).optional(),
    })
    .optional(),
})

export const FactionSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['core', 'group', 'institution', 'mass', 'target', 'dissent']),
  color: z.string(),
  from: PartialDate.optional(),
  to: PartialDate.optional(),
  summary: z.string(),
  cites: z.array(Cite).default([]),
})

export const EventSchema = z.object({
  id: z.string(),
  date: PartialDate,
  end: PartialDate.optional(),
  title: z.string(),
  lane: z.enum(Object.keys(LANES) as [Lane, ...Lane[]]),
  weight: z.number().int().min(1).max(3).default(1),
  place: z.string().optional(),
  // place id; usually resolved from `place` at build
  at: z.string().optional(),
  summary: z.string(),
  people: z.array(z.string()).default([]),
  concepts: z.array(z.string()).default([]),
  docs: z.array(z.string()).default([]),
  voices: z.array(Voiced).default([]),
  cites: z.array(Cite).default([]),
  verify: z.boolean().optional(),
})

export const RelationSchema = z.object({
  a: z.string(),
  b: z.string(),
  type: z.enum(Object.keys(RELATION_TYPES) as [RelationType, ...RelationType[]]),
  from: PartialDate.optional(),
  to: PartialDate.optional(),
  note: z.string().optional(),
  cite: Cite.optional(),
  verify: z.boolean().optional(),
})

export const ConceptSchema = z.object({
  id: z.string(),
  name: z.string(),
  terms: z.array(z.string()).min(1),
  summary: z.string(),
  related: z.array(z.string()).default([]),
  notes: z.array(Voiced).default([]),
})

// A doctrine, line or label (主义). `pos` places it on the two-axis spectrum at given moments; the
// positions are editorial judgments of relative stance, not measurements.
export const ISM_KINDS = {
  core: '正统',
  line: '党内路线',
  heterodox: '民间异端',
  foreign: '外来 · 对立面',
  label: '罪名 · 标签',
} as const
export const IsmSchema = z.object({
  id: z.string(),
  name: z.string(),
  short: z.string().optional(),
  kind: z.enum(Object.keys(ISM_KINDS) as [IsmKind, ...IsmKind[]]),
  from: PartialDate,
  to: PartialDate.optional(),
  parents: z.array(z.string()).default([]),
  against: z.array(z.string()).default([]),
  terms: z.array(z.string()).default([]),
  carriers: z.array(z.string()).default([]),
  concepts: z.array(z.string()).default([]),
  summary: z.string(),
  pos: z.array(z.object({ at: PartialDate, x: z.number().min(-1).max(1), y: z.number().min(-1).max(1), note: z.string().optional() })).default([]),
  notes: z.array(Voiced).default([]),
  cites: z.array(Cite).default([]),
})

// A slogan or keyword tracked year by year through the press (editorials and news reports).
// `concept` / `ism` link the row to the concept grid and the lineage tree.
export const PressTermSchema = z.object({
  id: z.string(),
  name: z.string(),
  terms: z.array(z.string()).min(1),
  // occurrences inside these longer strings are not counted (革命委员会 inside 文化革命委员会)
  except: z.array(z.string()).default([]),
  concept: z.string().optional(),
  ism: z.string().optional(),
})

export const LinePointSchema = z.object({ at: PartialDate, x: z.number().min(-1).max(1), y: z.number().min(-1).max(1), label: z.string(), note: z.string().optional() })

export const DocumentSchema = z.object({
  id: z.string(),
  summary: z.string(),
  significance: z.string().optional(),
  people: z.array(z.string()).default([]),
  concepts: z.array(z.string()).default([]),
  pairs: z
    .array(z.object({ against: z.string(), point: z.string(), original: z.string(), rebuttal: z.string() }))
    .optional(),
})

export const SourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: PartialDate,
  author: z.string().optional(),
  kind: z.string(),
  alias: z.string().optional(),
  url: z.string().optional(),
  revid: z.number().optional(),
  tier: z.number().int().min(1).max(4),
  hasText: z.boolean().default(false),
  note: z.string().optional(),
  // web transcriptions (manifest `web:`): where the text was taken from, and whether only excerpts are kept
  via: z.string().optional(),
  excerpt: z.boolean().optional(),
  // bibliographic sources (content/sources.yaml)
  publisher: z.string().optional(),
  locator: z.string().optional(),
  access: z.enum(['unread', 'partial', 'read']).optional(),
  want: z.array(z.string()).default([]),
})

export const SOURCE_KINDS: Record<string, string> = {
  'party-doc': '中央文件',
  editorial: '社论 · 评论',
  speech: '讲话 · 检讨',
  news: '新闻报道',
  redguard: '红卫兵 · 群众组织文献',
  essay: '民间思想',
  chronology: '资料汇编',
  judicial: '司法文书',
  index: '目录 · 索引',
  collected: '文集 · 文稿',
  annals: '年谱 · 组织史',
  memoir: '回忆录 · 口述',
  monograph: '学术专著',
  database: '资料库',
  archive: '外国档案',
  gazetteer: '地方志',
  'local-record': '地方处遗材料',
}

export const ClaimSchema = z.object({
  id: z.string(),
  statement: z.string(),
  status: z.enum(['supported', 'partial', 'contested', 'open']),
  method: z.string(),
  evidence: z.array(z.object({ cite: Cite, quote: z.string().optional(), note: z.string().optional() })),
  caveats: z.string().optional(),
  people: z.array(z.string()).default([]),
  concepts: z.array(z.string()).default([]),
  events: z.array(z.string()).default([]),
  logged: PartialDate,
  history: z.array(z.object({ date: PartialDate, note: z.string() })).default([]),
})

export const MEASURES = {
  deaths: '致死',
  persecuted: '受迫害 / 立案',
  injured: '伤残',
  detained: '关押',
  cases: '案件',
  reported: '上报数',
  none: '不给数字',
} as const
export type Measure = keyof typeof MEASURES

// value is set only when the source gives a number; approx keeps the source's hedge (余 / 多 / 近 / 数十)
export const CountSchema = z.object({
  measure: z.enum(Object.keys(MEASURES) as [Measure, ...Measure[]]),
  what: z.string(),
  scope: z.string().optional(),
  value: z.number().positive().optional(),
  approx: z.string().optional(),
  unit: z.string().default('人'),
  voice: z.enum(Object.keys(VOICES) as [Voice, ...Voice[]]),
  cite: Cite,
  quote: z.string(),
  note: z.string().optional(),
})

// One case, every figure for it side by side. A case with `need` has no source text yet.
export const FigureSchema = z.object({
  id: z.string(),
  title: z.string(),
  period: z.string(),
  region: z.string(),
  summary: z.string(),
  events: z.array(z.string()).default([]),
  people: z.array(z.string()).default([]),
  counts: z.array(CountSchema).default([]),
  caveats: z.string().optional(),
  need: z.string().optional(),
})

// The county register: one entry per county, city or prefecture, every count any source gives for it.
export const COUNTY_KINDS = { county: '县', city: '市', district: '区', prefecture: '地区' } as const
export const CountySchema = z.object({
  id: z.string(),
  name: z.string(),
  province: z.string(),
  prefecture: z.string().optional(),
  kind: z.enum(Object.keys(COUNTY_KINDS) as [keyof typeof COUNTY_KINDS, ...(keyof typeof COUNTY_KINDS)[]]).default('county'),
  counts: z.array(CountSchema).default([]),
  // founding of the county revolutionary committee, as the source dates it
  revcom: z.object({ date: PartialDate, cite: Cite, quote: z.string() }).optional(),
  note: z.string().optional(),
  // drawing position, merged at build from county-geo.yaml
  geo: z.object({ lon: z.number(), lat: z.number(), wd: z.string(), as: z.string().optional() }).optional(),
})

// Provincial revolutionary committees, one row per province, dated as the contemporary report dates them.
// Most reports date only the celebration rally, so the kind of date is kept apart from the founding itself.
export const REVCOM_DATES = { founded: '成立', rally: '庆祝大会', seized: '夺权' } as const
export const RevcomSchema = z.object({
  org: z.string(),
  // the basemap feature name, e.g. 黑龙江省
  province: z.string(),
  date: PartialDate,
  kind: z.enum(Object.keys(REVCOM_DATES) as [keyof typeof REVCOM_DATES, ...(keyof typeof REVCOM_DATES)[]]),
  cite: Cite,
  quote: z.string(),
  note: z.string().optional(),
})

export type Count = z.infer<typeof CountSchema>
export type Figure = z.infer<typeof FigureSchema>
export type County = z.infer<typeof CountySchema>
export type Revcom = z.infer<typeof RevcomSchema>
export type Fate = z.infer<typeof FateSchema>
export type Person = z.infer<typeof PersonSchema>
export type Faction = z.infer<typeof FactionSchema>
export type Event = z.infer<typeof EventSchema>
export type Relation = z.infer<typeof RelationSchema>
export type Concept = z.infer<typeof ConceptSchema>
export type DocumentMeta = z.infer<typeof DocumentSchema>
export type Source = z.infer<typeof SourceSchema>
export type Claim = z.infer<typeof ClaimSchema>
export type Place = z.infer<typeof PlaceSchema>
export type Org = z.infer<typeof OrgSchema>
export type Ism = z.infer<typeof IsmSchema>
export type IsmKind = keyof typeof ISM_KINDS
export type LinePoint = z.infer<typeof LinePointSchema>

export type ConceptHit = { source: string; date: string; count: number; context: string }
export type PressTerm = z.infer<typeof PressTermSchema>
export type Press = {
  years: { year: number; chars: number; docs: number }[]
  terms: (Omit<PressTerm, 'except'> & { counts: { year: number; n: number }[]; first?: ConceptHit; total: number })[]
}

export type Atlas = {
  builtAt: string
  people: Person[]
  factions: Faction[]
  orgs: Org[]
  places: Place[]
  events: Event[]
  relations: Relation[]
  concepts: (Concept & { hits: ConceptHit[] })[]
  // carriers resolved: `person` is set when the name is in people.yaml
  isms: (Omit<Ism, 'carriers'> & { carriers: { name: string; person?: string }[]; hits: ConceptHit[] })[]
  line: LinePoint[]
  // characters of dated text per year, the denominator for term frequencies
  corpus: { year: number; chars: number; docs: number }[]
  press: Press
  documents: (DocumentMeta & { source: Source })[]
  sources: Source[]
  claims: Claim[]
  figures: Figure[]
  counties: County[]
  revcoms: Revcom[]
}
