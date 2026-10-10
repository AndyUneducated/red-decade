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
  official1981: '1981 决议',
  judicial1980: '1980 起诉书',
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

export const FateSchema = z.object({
  date: PartialDate,
  s: z.enum(Object.keys(STATUSES) as [Status, ...Status[]]),
  note: z.string().optional(),
  cite: Cite.optional(),
  verify: z.boolean().optional(),
})

export const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  aka: z.array(z.string()).optional(),
  born: PartialDate.optional(),
  died: PartialDate.optional(),
  death: z.string().optional(),
  tier: z.number().int().min(1).max(3),
  role1966: z.string(),
  bio: z.string(),
  factions: z.array(z.string()),
  fate: z.array(FateSchema).default([]),
  cites: z.array(Cite).default([]),
  verify: z.boolean().optional(),
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

export type Fate = z.infer<typeof FateSchema>
export type Person = z.infer<typeof PersonSchema>
export type Faction = z.infer<typeof FactionSchema>
export type Event = z.infer<typeof EventSchema>
export type Relation = z.infer<typeof RelationSchema>
export type Concept = z.infer<typeof ConceptSchema>
export type DocumentMeta = z.infer<typeof DocumentSchema>
export type Source = z.infer<typeof SourceSchema>
export type Claim = z.infer<typeof ClaimSchema>

export type ConceptHit = { source: string; date: string; count: number; context: string }

export type Atlas = {
  builtAt: string
  people: Person[]
  factions: Faction[]
  events: Event[]
  relations: Relation[]
  concepts: (Concept & { hits: ConceptHit[] })[]
  documents: (DocumentMeta & { source: Source })[]
  sources: Source[]
  claims: Claim[]
}
