// The top bar: groups of pages, from the concrete to the abstract — events in time, persons, the formal
// networks they make up (orgs), the informal ones beneath (factions), places, ideas, insights that read
// across all of these, and the evidence for all of it. Moving a page is moving its line here; `label` overrides the page title inside its group.
// A group with several pages opens a menu. nav.test.ts checks every visible page appears exactly once.
import { page, PAGE_IDS, type PageId } from './pages'

export type NavItem = { page: PageId; label: string; desc: string }
export type NavGroup = { label: string; items: NavItem[] }

type Entry = PageId | { page: PageId; label?: string; desc?: string }
const NAV_CONFIG: { label: string; pages: Entry[] }[] = [
  { label: '时间', pages: ['timeline'] },
  { label: '人物', pages: [{ page: 'people', label: '名录' }, 'network', 'fates'] },
  { label: '机构', pages: ['orgs'] },
  { label: '派系', pages: ['river', 'control', 'factions'] },
  { label: '空间', pages: ['map'] },
  { label: '思想', pages: ['lineage', 'spectrum', 'ism-stream', 'press', 'concepts'] },
  { label: '洞察', pages: ['survival'] },
  { label: '史料', pages: ['docs', 'figures', 'series', 'narratives', 'research'] },
]

export const NAV: NavGroup[] = NAV_CONFIG.map((g) => ({
  label: g.label,
  items: g.pages.map((e) => {
    const o = typeof e === 'string' ? { page: e } : e
    return { page: o.page, label: o.label ?? page(o.page).title, desc: o.desc ?? page(o.page).desc }
  }),
}))

const HIDDEN_GROUP: NavGroup = { label: '', items: [] }
// pages reachable only by URL belong to no group; they get no crumb and no menu highlight
export const groupOf = (p: PageId): NavGroup => NAV.find((g) => g.items.some((i) => i.page === p)) ?? HIDDEN_GROUP
export const itemOf = (p: PageId): NavItem => groupOf(p).items.find((i) => i.page === p) ?? { page: p, label: page(p).title, desc: page(p).desc }

// problems with the menu, for the unit test and the dev console
export function navProblems(): string[] {
  const out: string[] = []
  const seen = new Map<PageId, string>()
  for (const g of NAV)
    for (const it of g.items) {
      if (seen.has(it.page)) out.push(`${it.page} is in both ${seen.get(it.page)} and ${g.label}`)
      seen.set(it.page, g.label)
      if (page(it.page).hidden) out.push(`${it.page} is hidden but listed under ${g.label}`)
    }
  for (const p of PAGE_IDS) if (!page(p).hidden && !seen.has(p)) out.push(`${p} is in no menu group (mark it hidden if that is intended)`)
  if (new Set(NAV.map((g) => g.label)).size !== NAV.length) out.push('two menu groups share a label')
  for (const g of NAV) if (!g.items.length) out.push(`group ${g.label} is empty`)
  return out
}
