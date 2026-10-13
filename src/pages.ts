// Every page of the site, once. The id is also the URL (#/<id>[/<param>]) and does not depend on where the page
// sits in the menu (nav.ts), so a page can move between menu groups without touching links or views.
// Components are mapped in pageComponents.tsx; this file stays free of React so tests can load it.
import type { Index } from './data/atlas'

// a page with `detail` takes an entity id as its second path segment (#/people/<id>); open(kind, id) finds the
// page by kind, so the profile page for a kind can be renamed or moved freely
export type DetailKind = 'person' | 'org' | 'faction' | 'doc'

export type PageDef = {
  title: string
  desc: string
  detail?: { kind: DetailKind; name: (ix: Index, id: string) => string | undefined }
  // shown only by URL, not in the menu (work in progress, or reached from another page)
  hidden?: boolean
  // id of an entity the smoke test opens as a sample detail page
  sample?: string
}

export const PAGES = {
  timeline: { title: '时间线', desc: '按日期排列的事件，可切换国际对照' },
  people: {
    title: '人物名录',
    desc: '每人一生的状态色带与完整传记',
    detail: { kind: 'person', name: (ix, id) => ix.person.get(id)?.name },
    sample: 'liu-shaoqi',
  },
  network: { title: '关系网络', desc: '此刻有效的人际关系' },
  fates: { title: '命运矩阵', desc: '1965–1980 年每人的政治命运' },
  orgs: {
    title: '机构',
    desc: '党、政、军、群团与群众组织的隶属和存续',
    detail: { kind: 'org', name: (ix, id) => ix.org.get(id)?.short ?? ix.org.get(id)?.name },
    sample: 'ccrg',
  },
  river: { title: '派系消长', desc: '各派在位人数与成员命运' },
  control: { title: '派系与机构', desc: '各派此刻掌握哪些机构' },
  factions: {
    title: '派系档案',
    desc: '每派的成员、核心人物与掌控变化',
    detail: { kind: 'faction', name: (ix, id) => ix.faction.get(id)?.name },
    sample: 'lin',
  },
  map: { title: '革委会地图', desc: '省、县革委会成立与地方暴力分布' },
  lineage: { title: '主义谱系', desc: '主义、路线、异端与罪名的源流' },
  spectrum: { title: '光谱漂移', desc: '各主义在经济、政治两轴上的位置与中央路线的轨迹' },
  'ism-stream': { title: '主义词频', desc: '各主义在语料中的逐年出现' },
  press: { title: '报刊词频', desc: '口号逐年词频与首现日期' },
  concepts: { title: '概念 × 文献', desc: '概念在哪些文献里出现' },
  drift: { title: '词义漂移', desc: '同一个罪名旁边的人名，随年代换了谁' },
  authority: { title: '权威来源', desc: '官方文本逐年援引马恩列斯、毛泽东与后继者' },
  attribution: { title: '归因追踪', desc: '同一事件，各种叙述点了谁的名' },
  spread: { title: '口号传播', desc: '一个说法最早出现在哪类文本' },
  selfcrit: { title: '检讨文体', desc: '检讨与认罪文本的固定用语' },
  citations: { title: '文献互引', desc: '文件之间的援引与逐条批驳' },
  survival: { title: '生存曲线', desc: '各派成员从 1965 年底起多久被打倒' },
  overlap: { title: '加害与受害', desc: '批判、诬陷他人的人，后来是否自己被打倒' },
  parallel: { title: '平行人生', desc: '命运轨迹最相近、同起点而分岔的人' },
  moments: { title: '表态时刻', desc: '各个转折关头，谁先开口、说了什么' },
  paralysis: { title: '机构瘫痪', desc: '党政机构停止运转、被夺权与革委会取代的时间' },
  outcomes: { title: '人均产量', desc: '粮食、布等按人口平均，公布数与修正数并列' },
  flows: { title: '派系流向', desc: '批判与诬陷在派系之间的流向，跨派系的人' },
  docs: {
    title: '文献',
    desc: '一手文献全文',
    detail: { kind: 'doc', name: (ix, id) => ix.source.get(id)?.alias ?? ix.source.get(id)?.title },
    sample: 'ws-1966-05-16-notice',
  },
  figures: { title: '数字争议', desc: '死亡与迫害数字按出处并列' },
  series: { title: '经济与人口', desc: '粮食、钢、人口等序列，逐点附公报原文' },
  narratives: { title: '叙事对照', desc: '同一事件不同立场的说法' },
  research: { title: '研究', desc: '本站结论与来源登记' },
} satisfies Record<string, PageDef>

export type PageId = keyof typeof PAGES
export const PAGE_IDS = Object.keys(PAGES) as PageId[]
export const page = (id: PageId): PageDef => PAGES[id]
export const isPage = (s: string): s is PageId => Object.hasOwn(PAGES, s)
export const DEFAULT_PAGE: PageId = 'timeline'

export function detailPage(kind: DetailKind): PageId {
  const id = PAGE_IDS.find((p) => page(p).detail?.kind === kind)
  if (!id) throw new Error(`no page shows ${kind}`)
  return id
}
