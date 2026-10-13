// The open-data tables (M10) under public/data/open/: <id>.json holds the records whole, nested fields
// included; <id>.csv holds the columns listed here, one row per record. The build, the 开放数据 page and
// docs/data.md all read this list, so the files and their documentation cannot drift apart.
// A table with `key` has stable ids, cited as <table>/<id> and kept in research/ids.txt; a table with
// `parent` flattens a nested list of another table and is cited through its parent's id.
import {
  ALIAS_KINDS,
  ARCHIVE_KINDS,
  COUNTY_KINDS,
  DEATH_KINDS,
  ISM_KINDS,
  LANES,
  MEASURES,
  ORG_KINDS,
  ORG_LEVELS,
  POINT_KINDS,
  RELATION_TYPES,
  REVCOM_DATES,
  SERIES_GROUPS,
  SOURCE_KINDS,
  STATUSES,
  VOICES,
  type Atlas,
  type Count,
  type Relation,
} from './schema.ts'

export type Cell = string | number | boolean | string[] | undefined
// a column with `get` is computed for the CSV; one without is a field of the JSON record under the same name
export type Col<T> = { key: string; about: string; get?: (r: T) => Cell }
type Def<T> = {
  id: string
  name: string
  about: string
  rows: (a: Atlas) => T[]
  cols: Col<T>[]
  // fields kept only in the JSON, as nested lists or objects
  nested?: Record<string, string>
  key?: (r: T) => string
  parent?: string
  // where the site shows one record, with {id} for its id
  link?: string
}
export type OpenTable = Def<Record<string, unknown>>

const table = <T>(d: Def<T>) => d as unknown as OpenTable
const values = (o: Record<string, string>) =>
  Object.entries(o)
    .map(([k, v]) => `${k} ${v}`)
    .join('、')
const byId = (r: { id: string }) => r.id

export const ID_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const CLAIM_ID = /^C\d{3}$/

const DATE = '日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度'
const CITE = '出处：sources 表的 id，可带 @ 后的页码或段落'
const CITES = '出处列表（sources 的 id）'
const VERIFY = 'true 表示尚未找到原文出处（待核）'
const VOICE = `声部：${values(VOICES)}`
const QUOTE = '原文引文，构建时与出处全文逐字核对'

// relations carry no id of their own; a~type~b is unique except when the same pair has the same tie twice
function relationRows(a: Atlas): (Relation & { id: string })[] {
  const seen = new Map<string, number>()
  return a.relations.map((r) => {
    const base = `${r.a}~${r.type}~${r.b}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return { id: n === 1 ? base : `${base}~${n}`, ...r }
  })
}

type CountRow = Count & { table: string; owner: string }
const countRows = (a: Atlas): CountRow[] => [
  ...a.figures.flatMap((f) => f.counts.map((c) => ({ table: 'figures', owner: f.id, ...c }))),
  ...a.counties.flatMap((u) => u.counts.map((c) => ({ table: 'counties', owner: u.id, ...c }))),
]

const countCols: Col<CountRow>[] = [
  { key: 'table', about: '所属表：figures 或 counties' },
  { key: 'owner', about: '所属记录的 id' },
  { key: 'measure', about: `计的是什么：${values(MEASURES)}` },
  { key: 'what', about: '原文所计对象' },
  { key: 'scope', about: '口径、范围' },
  { key: 'value', about: '数值；原文不给数字时为空' },
  { key: 'approx', about: '原文的约数用语（余、多、近、数十）' },
  { key: 'unit', about: '单位' },
  { key: 'voice', about: VOICE },
  { key: 'cite', about: CITE },
  { key: 'quote', about: QUOTE },
  { key: 'note', about: '说明' },
]

export const OPEN_TABLES: OpenTable[] = [
  table({
    id: 'people',
    name: '人物',
    about: '每人一条：生平、派系、传记分节、命运节点',
    link: '#/people/{id}',
    rows: (a) => a.people,
    key: byId,
    cols: [
      { key: 'id', about: '稳定 id（拼音）' },
      { key: 'name', about: '姓名' },
      { key: 'pinyin', about: '拼音' },
      { key: 'gender', about: 'm 男、f 女' },
      { key: 'ethnicity', about: '民族' },
      { key: 'born', about: `出生，${DATE}` },
      { key: 'died', about: `去世，${DATE}` },
      { key: 'birthplace', about: '出生地，按原文' },
      { key: 'origin', about: '籍贯' },
      { key: 'birthAt', about: '出生地在 places 表的 id' },
      { key: 'death', about: '死因的原文说法' },
      { key: 'deathKind', about: `死因分类：${values(DEATH_KINDS)}` },
      { key: 'deathContested', about: 'true 表示死因本身有争议' },
      { key: 'deathPlace', about: '去世地点' },
      { key: 'deathAt', about: '去世地点在 places 表的 id' },
      { key: 'classOrigin', about: '家庭出身，按档案记载' },
      { key: 'classNote', about: '出身的争议或后来改划' },
      { key: 'party', about: '党派，空为中国共产党' },
      { key: 'joinedParty', about: `入党，${DATE}` },
      { key: 'joinedRevolution', about: `参加革命或工作，${DATE}` },
      { key: 'tier', about: '重要程度：1 核心人物（派系页列为核心，图上加粗），2、3 依次次之' },
      { key: 'role1966', about: '1966 年前后的身份' },
      { key: 'factions', about: '曾属派系（factions 的 id），第一项为默认归属' },
      { key: 'bio', about: '概述' },
      { key: 'wikidata', about: 'Wikidata 编号', get: (p) => p.ids?.wikidata },
      { key: 'cites', about: CITES },
      { key: 'verify', about: VERIFY },
    ],
    nested: {
      aka: `别名：kind（${values(ALIAS_KINDS)}）与 name`,
      education: '学历：school、from、to、note、cite',
      positions: '职务，CSV 见 positions 表',
      rank: '军衔：rank、date、cite',
      rehab: '平反：date、text、cite',
      afterlife: '身后：date、text、cite',
      ids: '外部编号：wikidata、cbdb',
      life: '完整传记分节：h 标题、from、to、text、cites',
      assess: `评价：voice（${values(VOICES)}）、text、cite、quote（true 为逐字引文）`,
      quotes: '本人或关于本人的原话：text、cite、by、date、note、voice',
      works: '著作：title、date、cite',
      memberships: '分时段的主要派系：f、from、to、note、cite',
      fate: '命运节点，CSV 见 fates 表',
      photo: '照片：src、url、author、license、date',
    },
  }),
  table({
    id: 'fates',
    name: '命运节点',
    about: '人物的政治处境随时间的变化，按日期排列',
    parent: 'people',
    rows: (a) => a.people.flatMap((p) => p.fate.map((f) => ({ person: p.id, ...f }))),
    cols: [
      { key: 'person', about: 'people 的 id' },
      { key: 'date', about: DATE },
      { key: 's', about: `处境：${values(STATUSES)}` },
      { key: 'note', about: '说明' },
      { key: 'place', about: '关押、下放等地点在 places 的 id' },
      { key: 'cite', about: CITE },
      { key: 'verify', about: VERIFY },
    ],
  }),
  table({
    id: 'positions',
    name: '职务',
    about: '人物担任的职务',
    parent: 'people',
    rows: (a) => a.people.flatMap((p) => p.positions.map((x) => ({ person: p.id, ...x }))),
    cols: [
      { key: 'person', about: 'people 的 id' },
      { key: 'title', about: '职务名称' },
      { key: 'org', about: 'orgs 的 id；机构未建模时为空' },
      { key: 'orgName', about: '机构名称，按原文' },
      { key: 'sys', about: '系统：party 党、gov 政、army 军、other 其他' },
      { key: 'from', about: `起，${DATE}` },
      { key: 'to', about: `止，${DATE}` },
      { key: 'note', about: '说明' },
      { key: 'cite', about: CITE },
      { key: 'verify', about: VERIFY },
    ],
  }),
  table({
    id: 'events',
    name: '事件',
    about: '1949–1989 年的事件，每条并列多个声部的说法',
    link: '#/timeline?sel=event:{id}',
    rows: (a) => a.events,
    key: byId,
    cols: [
      { key: 'id', about: '稳定 id' },
      { key: 'date', about: DATE },
      { key: 'end', about: `结束，${DATE}` },
      { key: 'title', about: '标题' },
      { key: 'lane', about: `泳道：${values(LANES)}` },
      { key: 'weight', about: '重要程度 1–3' },
      { key: 'place', about: '地点，按原文' },
      { key: 'at', about: '地点在 places 的 id' },
      { key: 'summary', about: '概述' },
      { key: 'people', about: '涉及人物（people 的 id）' },
      { key: 'concepts', about: '涉及概念（concepts 的 id）' },
      { key: 'docs', about: '相关文献（sources 的 id）' },
      { key: 'topics', about: '所属专题（topics 的 id）' },
      { key: 'cites', about: CITES },
      { key: 'verify', about: VERIFY },
    ],
    nested: { voices: `各声部的说法：voice（${values(VOICES)}）、text、cite、quote（true 为逐字引文）` },
  }),
  table({
    id: 'relations',
    name: '关系',
    about: '人物之间有时段的关系，方向从 a 到 b',
    rows: relationRows,
    key: byId,
    cols: [
      { key: 'id', about: '构建时生成：a~type~b，同一对人同一种关系出现多次时加 ~2、~3' },
      { key: 'a', about: 'people 的 id' },
      { key: 'b', about: 'people 的 id' },
      { key: 'type', about: `关系：${values(RELATION_TYPES)}` },
      { key: 'from', about: `起，${DATE}` },
      { key: 'to', about: `止，${DATE}` },
      { key: 'note', about: '说明' },
      { key: 'cite', about: CITE },
      { key: 'verify', about: VERIFY },
    ],
  }),
  table({
    id: 'factions',
    name: '派系',
    about: '政治派系与群体',
    link: '#/factions/{id}',
    rows: (a) => a.factions,
    key: byId,
    cols: [
      { key: 'id', about: '稳定 id' },
      { key: 'name', about: '名称' },
      { key: 'kind', about: '类型：core 核心（毛泽东）、group 政治集团、institution 体制内机构与领导层、mass 群众与群体、target 被点名打击的群体、dissent 异见' },
      { key: 'color', about: '图上颜色' },
      { key: 'from', about: `起，${DATE}` },
      { key: 'to', about: `止，${DATE}` },
      { key: 'summary', about: '概述' },
      { key: 'cites', about: CITES },
    ],
  }),
  table({
    id: 'orgs',
    name: '机构',
    about: '党、政、军、群团与群众组织',
    link: '#/orgs/{id}',
    rows: (a) => a.orgs,
    key: byId,
    cols: [
      { key: 'id', about: '稳定 id' },
      { key: 'name', about: '全称' },
      { key: 'short', about: '简称' },
      { key: 'aliases', about: '别名' },
      { key: 'kind', about: `类别：${values(ORG_KINDS)}` },
      { key: 'level', about: `层级：${values(ORG_LEVELS)}` },
      { key: 'from', about: `成立，${DATE}` },
      { key: 'to', about: `撤销，${DATE}` },
      { key: 'parent', about: '最早的上级机构（orgs 的 id），全部见 JSON 的 under', get: (o) => o.under[0]?.org },
      { key: 'factions', about: '掌控派系（factions 的 id）' },
      { key: 'summary', about: '概述' },
      { key: 'cites', about: CITES },
      { key: 'verify', about: VERIFY },
    ],
    nested: {
      suspended: '名存实亡的时段：from、to、note',
      places: '驻地：at、from、to',
      under: '上级机构：org、from、to',
      links: '与其他机构的关系：org、kind（领导、设立、对立、并入、夺权、取代）、date、to、note、cite',
      leaders: '历任负责人，CSV 见 leaders 表',
    },
  }),
  table({
    id: 'leaders',
    name: '机构负责人',
    about: '各机构的历任负责人，包括未收入人物表的人',
    parent: 'orgs',
    rows: (a) => a.orgs.flatMap((o) => o.leaders.map((l) => ({ org: o.id, ...l }))),
    cols: [
      { key: 'org', about: 'orgs 的 id' },
      { key: 'name', about: '姓名' },
      { key: 'person', about: 'people 的 id；不在人物表时为空' },
      { key: 'title', about: '职务' },
      { key: 'from', about: `起，${DATE}` },
      { key: 'to', about: `止，${DATE}` },
      { key: 'faction', about: '任内派系（factions 的 id）' },
      { key: 'note', about: '说明' },
      { key: 'cite', about: `${CITE}；为空表示出自一般工具书，待核` },
    ],
  }),
  table({
    id: 'places',
    name: '地点',
    about: '出生、去世、关押与事件地点的近似坐标（约 0.1°）',
    rows: (a) => a.places,
    key: byId,
    cols: [
      { key: 'id', about: '稳定 id' },
      { key: 'name', about: '名称' },
      { key: 'names', about: '用来匹配原文的其他写法' },
      { key: 'lat', about: '纬度' },
      { key: 'lon', about: '经度' },
      { key: 'far', about: 'true 表示在地图范围以外' },
    ],
  }),
  table({
    id: 'concepts',
    name: '概念',
    about: '口号、罪名与关键词，及其在语料中的检索词',
    link: '#/concepts?sel=concept:{id}',
    rows: (a) => a.concepts.map(({ hits: _h, near: _n, ...c }) => c),
    key: byId,
    cols: [
      { key: 'id', about: '稳定 id' },
      { key: 'name', about: '名称' },
      { key: 'terms', about: '检索词' },
      { key: 'summary', about: '概述' },
      { key: 'related', about: '相关概念（concepts 的 id）' },
    ],
    nested: { notes: `各声部的说法：voice、text、cite、quote` },
  }),
  table({
    id: 'isms',
    name: '主义',
    about: '主义、路线、异端与罪名，及其源流和在两轴光谱上的位置',
    link: '#/lineage?sel=ism:{id}',
    rows: (a) => a.isms.map(({ hits: _h, ...m }) => m),
    key: byId,
    cols: [
      { key: 'id', about: '稳定 id' },
      { key: 'name', about: '名称' },
      { key: 'short', about: '简称' },
      { key: 'kind', about: `类别：${values(ISM_KINDS)}` },
      { key: 'from', about: `起，${DATE}` },
      { key: 'to', about: `止，${DATE}` },
      { key: 'parents', about: '源自（isms 的 id）' },
      { key: 'against', about: '针对（isms 的 id）' },
      { key: 'terms', about: '检索词' },
      { key: 'concepts', about: '相关概念（concepts 的 id）' },
      { key: 'summary', about: '概述' },
      { key: 'cites', about: CITES },
    ],
    nested: {
      carriers: '代表人物：name，在人物表时另有 person（people 的 id）',
      pos: '光谱位置：at、x（经济轴 −1 到 1）、y（政治轴 −1 到 1）、note；是编者对相对立场的判断，不是测量',
      notes: '各声部的说法：voice、text、cite、quote',
    },
  }),
  table({
    id: 'sources',
    name: '来源',
    about: '全部来源的登记：一手文献（多数有全文）与书目',
    link: '#/docs/{id}',
    rows: (a) => a.sources,
    key: byId,
    cols: [
      { key: 'id', about: '稳定 id，也是全文文件名' },
      { key: 'title', about: '标题' },
      { key: 'date', about: DATE },
      { key: 'author', about: '作者或发布机关' },
      { key: 'kind', about: `类别：${values(SOURCE_KINDS)}` },
      { key: 'alias', about: '通称' },
      { key: 'tier', about: '层级：1 原文、2 官方、3 亲历、4 研究' },
      { key: 'url', about: '取自何处' },
      { key: 'revid', about: '维基文库的修订号，可据此取回同一版本' },
      { key: 'via', about: '网页转录的来源' },
      { key: 'excerpt', about: 'true 表示只保留了摘录' },
      { key: 'hasText', about: 'true 表示有全文' },
      { key: 'text', about: '全文文件，相对 public/data/', get: (s) => (s.hasText ? `texts/${s.id}.txt` : undefined) },
      { key: 'publisher', about: '出版者' },
      { key: 'locator', about: '书目位置' },
      { key: 'access', about: '阅读状态：unread 未读、partial 部分、read 已读' },
      { key: 'want', about: '要从这本书里找的东西' },
      { key: 'note', about: '说明' },
    ],
  }),
  table({
    id: 'documents',
    name: '文献注释',
    about: '重点文献的提要、意义与逐条对照',
    link: '#/docs/{id}',
    rows: (a) => a.documents.map(({ source: _s, ...d }) => d),
    key: byId,
    cols: [
      { key: 'id', about: 'sources 的 id' },
      { key: 'summary', about: '提要' },
      { key: 'significance', about: '意义' },
      { key: 'people', about: '涉及人物（people 的 id）' },
      { key: 'concepts', about: '涉及概念（concepts 的 id）' },
    ],
    nested: { pairs: '逐条对照：against（被批驳的文献）、point、original、rebuttal' },
  }),
  table({
    id: 'claims',
    name: '研究结论',
    about: '本站由原文推出的结论，附证据、方法与保留意见',
    link: '#/research?sel=claim:{id}',
    rows: (a) => a.claims,
    key: byId,
    cols: [
      { key: 'id', about: '稳定 id，C 加三位数字' },
      { key: 'statement', about: '结论' },
      { key: 'status', about: '状态：supported 成立、partial 部分成立、contested 有争议、open 未定' },
      { key: 'method', about: '方法' },
      { key: 'caveats', about: '保留意见' },
      { key: 'people', about: '涉及人物' },
      { key: 'concepts', about: '涉及概念' },
      { key: 'events', about: '涉及事件' },
      { key: 'isms', about: '涉及主义' },
      { key: 'factions', about: '涉及派系' },
      { key: 'topics', about: '所属专题' },
      { key: 'logged', about: `登记日期，${DATE}` },
    ],
    nested: { evidence: '证据，CSV 见 evidence 表', history: '修订记录：date、note' },
  }),
  table({
    id: 'essays',
    name: '专题长文',
    about: '研究栏目的长文，由研究结论与原文写成',
    link: '#/essays/{id}',
    rows: (a) => a.essays,
    key: byId,
    cols: [
      { key: 'id', about: '稳定 id' },
      { key: 'title', about: '标题' },
      { key: 'period', about: '所论时期' },
      { key: 'summary', about: '提要' },
      { key: 'written', about: `写作日期，${DATE}` },
      { key: 'claims', about: '依据的研究结论（claims 的 id）', get: (e) => [...new Set(e.sections.flatMap((s) => s.claims))] },
    ],
    nested: { sections: `分节：h 标题、text 正文（段落以空行分隔，“”内四字以上的引文构建时逐字核对）、claims 依据的结论、cites 出处` },
  }),
  table({
    id: 'evidence',
    name: '结论证据',
    about: '每条研究结论的证据',
    parent: 'claims',
    rows: (a) => a.claims.flatMap((c) => c.evidence.map((e) => ({ claim: c.id, ...e }))),
    cols: [
      { key: 'claim', about: 'claims 的 id' },
      { key: 'cite', about: CITE },
      { key: 'quote', about: QUOTE },
      { key: 'note', about: '说明' },
    ],
  }),
  table({
    id: 'topics',
    name: '专题',
    about: '跨时期的专题；事件与结论通过各自的 topics 字段归入',
    link: '#/topics/{id}',
    rows: (a) => a.topics,
    key: byId,
    cols: [
      { key: 'id', about: '稳定 id' },
      { key: 'name', about: '名称' },
      { key: 'from', about: `起，${DATE}` },
      { key: 'to', about: `止，${DATE}` },
      { key: 'summary', about: '概述' },
      { key: 'gaps', about: '现有材料还回答不了的问题' },
      { key: 'cites', about: CITES },
    ],
    nested: { sections: '分节：h、text、cites' },
  }),
  table({
    id: 'archive',
    name: '视觉档案',
    about: '宣传画、像章、邮票、样板戏、书刊与歌曲，每条有日期、出处与版权状态',
    rows: (a) => a.archive,
    key: byId,
    cols: [
      { key: 'id', about: '稳定 id' },
      { key: 'kind', about: `类别：${values(ARCHIVE_KINDS)}` },
      { key: 'title', about: '标题' },
      { key: 'date', about: DATE },
      { key: 'dateFrom', about: '日期依据：metadata 文件元数据、title 文件名、source 引用的原文' },
      { key: 'file', about: 'Wikimedia Commons 文件名' },
      { key: 'url', about: '文件页' },
      { key: 'cite', about: CITE },
      { key: 'quote', about: QUOTE },
      { key: 'author', about: '作者' },
      { key: 'license', about: '许可或版权状态' },
      { key: 'licenseUrl', about: '许可证网址' },
      { key: 'description', about: '说明' },
      { key: 'via', about: '转录来源' },
      { key: 'image', about: '缩略图，相对站点根目录' },
    ],
  }),
  table({
    id: 'figures',
    name: '数字争议',
    about: '死亡与迫害数字：一个案例一条，各出处的数字并列',
    rows: (a) => a.figures,
    key: byId,
    cols: [
      { key: 'id', about: '稳定 id' },
      { key: 'title', about: '案例' },
      { key: 'period', about: '时期' },
      { key: 'region', about: '地区' },
      { key: 'summary', about: '概述' },
      { key: 'events', about: '相关事件' },
      { key: 'people', about: '相关人物' },
      { key: 'caveats', about: '保留意见' },
      { key: 'need', about: '还缺什么原文' },
    ],
    nested: { counts: '各出处的数字，CSV 见 counts 表' },
  }),
  table({
    id: 'counties',
    name: '县级登记',
    about: '县、市、地区一条，登记各来源给出的数字和县革委会成立日期',
    rows: (a) => a.counties,
    key: byId,
    cols: [
      { key: 'id', about: '稳定 id' },
      { key: 'name', about: '名称（当时）' },
      { key: 'province', about: '省' },
      { key: 'prefecture', about: '地区' },
      { key: 'kind', about: `类别：${values(COUNTY_KINDS)}` },
      { key: 'revcomDate', about: '县革委会成立日期', get: (u) => u.revcom?.date },
      { key: 'lon', about: '经度（今治所）', get: (u) => u.geo?.lon },
      { key: 'lat', about: '纬度（今治所）', get: (u) => u.geo?.lat },
      { key: 'note', about: '说明' },
    ],
    nested: {
      counts: '各出处的数字，CSV 见 counts 表',
      revcom: '县革委会成立：date、cite、quote',
      geo: '位置：lon、lat、wd（Wikidata 编号）、as（按哪个今地名定位）',
    },
  }),
  table({
    id: 'counts',
    name: '数字',
    about: '数字争议与县级登记里的每一个数字',
    parent: 'figures, counties',
    rows: countRows,
    cols: countCols,
  }),
  table({
    id: 'revcoms',
    name: '省级革委会',
    about: '每省一条，按当时报道的日期',
    rows: (a) => a.revcoms,
    key: (r) => r.org,
    cols: [
      { key: 'org', about: 'orgs 的 id，也是这张表的 id' },
      { key: 'province', about: '省' },
      { key: 'date', about: DATE },
      { key: 'kind', about: `日期的性质：${values(REVCOM_DATES)}` },
      { key: 'cite', about: CITE },
      { key: 'quote', about: QUOTE },
      { key: 'note', about: '说明' },
    ],
  }),
  table({
    id: 'series',
    name: '经济与人口序列',
    about: '粮食、钢、人口等逐年数字',
    rows: (a) => a.series,
    key: byId,
    cols: [
      { key: 'id', about: '稳定 id' },
      { key: 'title', about: '名称' },
      { key: 'group', about: `分组：${values(SERIES_GROUPS)}` },
      { key: 'unit', about: '单位' },
      { key: 'summary', about: '概述' },
      { key: 'caveats', about: '保留意见' },
      { key: 'events', about: '相关事件' },
    ],
    nested: { points: '逐年数字，CSV 见 points 表' },
  }),
  table({
    id: 'points',
    name: '序列数字',
    about: '序列的每一个数字；同一年可以有当时公布、后来修正、另一口径几个数',
    parent: 'series',
    rows: (a) => a.series.flatMap((s) => s.points.map((p) => ({ series: s.id, ...p }))),
    cols: [
      { key: 'series', about: 'series 的 id' },
      { key: 'year', about: '年份' },
      { key: 'value', about: '数值，已换算为序列单位' },
      { key: 'approx', about: 'true 表示原文是约数' },
      { key: 'kind', about: `口径：${values(POINT_KINDS)}` },
      { key: 'cite', about: CITE },
      { key: 'quote', about: `${QUOTE}；保留原单位` },
      { key: 'note', about: '说明' },
    ],
  }),
]

export const cellOf = <T>(c: Col<T>, r: T): Cell => (c.get ? c.get(r) : ((r as Record<string, unknown>)[c.key] as Cell))

// docs/fields.md, written by the build; a unit test fails when the committed file is out of date
export function fieldsMarkdown(): string {
  const esc = (s: string) => s.replaceAll('|', '\\|')
  const out = [
    '# 字段说明',
    '',
    '> 由 `npm run data:build` 从 `src/data/open.ts` 生成，请勿手改。格式、id 与引用方式见 [`data.md`](data.md)。',
    '',
    '| 表 | 内容 | 稳定 id | 站内网址 |',
    '|---|---|---|---|',
    ...OPEN_TABLES.map((t) => `| [\`${t.id}\`](#${t.id}) ${t.name} | ${esc(t.about)} | ${t.key ? '是' : `否，经 ${t.parent} 引用`} | ${t.link ? `\`${t.link}\`` : '—'} |`),
  ]
  for (const t of OPEN_TABLES) {
    out.push('', `## ${t.id}`, '', `**${t.name}**：${t.about}。文件 \`open/${t.id}.json\`、\`open/${t.id}.csv\`。`, '')
    out.push('| 列 | 说明 |', '|---|---|', ...t.cols.map((c) => `| \`${c.key}\` | ${esc(c.about)}${c.get ? '（只在 CSV，由 JSON 字段算出）' : ''} |`))
    if (t.nested) out.push('', '只在 JSON 中的嵌套字段：', '', '| 字段 | 说明 |', '|---|---|', ...Object.entries(t.nested).map(([k, v]) => `| \`${k}\` | ${esc(v)} |`))
  }
  return out.join('\n') + '\n'
}
