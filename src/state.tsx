// App state lives in the URL hash so every view/selection is linkable:
//   #/<view>?sel=<type>:<id>[:<sub>]&t=<fractional year>
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type SetStateAction } from 'react'
import type { EntityType, Index, Ref } from './data/atlas'
import { adoptEntry, beginRestore, currentEntry, findBack, getUi, pushEntry, restoreScroll, setUi } from './lib/history'

export const VIEWS = {
  timeline: '时间线',
  people: '人物名录',
  network: '关系网络',
  fates: '命运矩阵',
  orgs: '机构',
  river: '派系消长',
  control: '派系与机构',
  factions: '派系档案',
  map: '革委会地图',
  ideas: '思想谱系',
  docs: '文献',
  figures: '数字争议',
  series: '经济与人口',
  narratives: '叙事对照',
  research: '研究',
} as const
export type View = keyof typeof VIEWS

// The top bar runs from the concrete to the abstract: events in time, persons, the formal networks they
// make up (orgs), the informal ones beneath (factions), places, ideas, and the evidence for all of it.
// A group with several items opens a menu; an item with doc is a tab inside a view (思想谱系).
// Every view keeps its own route, so old links still open.
export type NavItem = { view: View; doc?: string; label: string; desc: string }
export const NAV: { label: string; items: NavItem[] }[] = [
  { label: '时间', items: [{ view: 'timeline', label: '时间线', desc: '按日期排列的事件，可切换国际对照' }] },
  {
    label: '人物',
    items: [
      { view: 'people', label: '名录', desc: '每人一生的状态色带与完整传记' },
      { view: 'network', label: '关系网络', desc: '此刻有效的人际关系' },
      { view: 'fates', label: '命运矩阵', desc: '1965–1980 年每人的政治命运' },
    ],
  },
  { label: '机构', items: [{ view: 'orgs', label: '机构', desc: '党、政、军、群团与群众组织的隶属和存续' }] },
  {
    label: '派系',
    items: [
      { view: 'river', label: '派系消长', desc: '各派在位人数与成员命运' },
      { view: 'control', label: '派系与机构', desc: '各派此刻掌握哪些机构' },
      { view: 'factions', label: '派系档案', desc: '每派的成员、核心人物与掌控变化' },
    ],
  },
  { label: '空间', items: [{ view: 'map', label: '革委会地图', desc: '省、县革委会成立与地方暴力分布' }] },
  {
    label: '思想',
    items: [
      { view: 'ideas', doc: 'tree', label: '主义谱系', desc: '主义、路线、异端与罪名的源流' },
      { view: 'ideas', doc: 'spectrum', label: '光谱漂移', desc: '人物在两条轴上的位置变化' },
      { view: 'ideas', doc: 'stream', label: '主义词频', desc: '各主义在语料中的逐年出现' },
      { view: 'ideas', doc: 'press', label: '报刊词频', desc: '口号逐年词频与首现日期' },
      { view: 'ideas', doc: 'concepts', label: '概念 × 文献', desc: '概念在哪些文献里出现' },
    ],
  },
  {
    label: '史料',
    items: [
      { view: 'docs', label: '文献', desc: '一手文献全文' },
      { view: 'figures', label: '数字争议', desc: '死亡与迫害数字按出处并列' },
      { view: 'series', label: '经济与人口', desc: '粮食、钢、人口等序列，逐点附公报原文' },
      { view: 'narratives', label: '叙事对照', desc: '同一事件不同立场的说法' },
      { view: 'research', label: '研究', desc: '本站结论与来源登记' },
    ],
  },
]
export const groupOf = (v: View) => NAV.find((g) => g.items.some((i) => i.view === v))!
// the item a page belongs to; for 思想谱系 the tab in doc, defaulting to the first
export const itemOf = (v: View, doc?: string) => {
  const items = groupOf(v).items.filter((i) => i.view === v)
  return items.find((i) => i.doc === doc) ?? items[0]
}

// the item last shown in each group, so the group's tab returns to it; kept for the session
const lastShown = new Map<string, NavItem>()
export const lastItem = (g: (typeof NAV)[number]) => lastShown.get(g.label) ?? g.items[0]

// doc is the second path segment: a document id in docs, a person id in people, an org id in orgs;
// entry identifies the history entry, which carries remembered scroll offsets and UI state
type State = { view: View; sel?: Ref; t: number; doc?: string; entry: string }

const DEFAULT_T = 1966 + 7.5 / 12

function parseHash(hash = location.hash): Omit<State, 'entry'> {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const [view, doc] = path.split('/')
  const q = new URLSearchParams(query)
  const sel = q.get('sel')?.split(':')
  const t = Number(q.get('t'))
  return {
    view: (view in VIEWS ? view : 'timeline') as View,
    doc: doc || undefined,
    sel: sel && sel.length >= 2 ? { type: sel[0] as EntityType, id: sel[1], sub: sel[2] } : undefined,
    t: Number.isFinite(t) && t > 1900 ? t : DEFAULT_T,
  }
}

function toHash(s: Omit<State, 'entry'>): string {
  const q = new URLSearchParams()
  if (s.sel) q.set('sel', `${s.sel.type}:${s.sel.id}${s.sel.sub ? `:${s.sel.sub}` : ''}`)
  if (s.t !== DEFAULT_T) q.set('t', s.t.toFixed(3))
  const qs = q.toString()
  return `#/${s.view}${s.doc ? `/${s.doc}` : ''}${qs ? `?${qs}` : ''}`
}

type Ctx = State & {
  ix: Index
  go: (view: View, doc?: string) => void
  // selecting what the drawer already shows closes it, so a second click on a link works as a toggle;
  // force keeps it open (search results, programmatic jumps)
  select: (ref?: Ref, force?: boolean) => void
  setT: (t: number) => void
  openDoc: (id: string) => void
  // full profile page (#/people/<id>); the drawer closes so the same person is not shown twice
  openPerson: (id?: string) => void
  openOrg: (id?: string) => void
  // from a profile page up to its list: go back through history when the list is there, so it comes back
  // where it was left; otherwise open the list fresh
  up: (view: View) => void
  // a profile page's back link: to the page it was opened from, else up to the list
  back: (list: View) => { label: string; run: () => void }
}

function pageName(ix: Index, s: { view: View; doc?: string }): string {
  if (s.view === 'people') return (s.doc && ix.person.get(s.doc)?.name) || '人物'
  if (s.view === 'orgs') {
    const o = s.doc ? ix.org.get(s.doc) : undefined
    return o ? (o.short ?? o.name) : '机构'
  }
  if (s.view === 'docs') return '文献'
  if (s.view === 'factions') return (s.doc && ix.faction.get(s.doc)?.name) || VIEWS.factions
  if (s.view === 'ideas') return itemOf('ideas', s.doc).label
  return VIEWS[s.view]
}

const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({ ix, children }: { ix: Index; children: ReactNode }) {
  const [state, setState] = useState<State>(() => ({ ...parseHash(), entry: adoptEntry().key }))
  const latest = useRef(state)
  latest.current = state
  const restoreTo = useRef<string>(undefined)

  useEffect(() => {
    lastShown.set(groupOf(state.view).label, itemOf(state.view, state.doc))
  }, [state.view, state.doc])

  // back/forward (popstate) and hand-edited hashes (hashchange) both land here; the second of a pair is a no-op
  useEffect(() => {
    const onNav = () => {
      const was = currentEntry()
      const { key, known } = adoptEntry()
      if (key === was) return
      if (known) {
        beginRestore()
        restoreTo.current = key
      }
      setState((latest.current = { ...parseHash(), entry: key }))
    }
    addEventListener('popstate', onNav)
    addEventListener('hashchange', onNav)
    return () => {
      removeEventListener('popstate', onNav)
      removeEventListener('hashchange', onNav)
    }
  }, [])

  // runs after every child has rendered the restored entry and reset its own scrollers
  useEffect(() => {
    if (restoreTo.current !== state.entry) return
    restoreTo.current = undefined
    restoreScroll(state.entry)
  }, [state.entry])

  const update = useCallback((patch: Partial<State>, push = true) => {
    const next = { ...latest.current, ...patch }
    const hash = toHash(next)
    if (hash !== location.hash) {
      if (push) pushEntry(hash)
      else history.replaceState(history.state, '', hash)
    }
    next.entry = currentEntry()
    setState((latest.current = next))
  }, [])

  const value = useMemo<Ctx>(
    () => ({
      ...state,
      ix,
      go: (view, doc) => update({ view, doc }),
      select: (sel, force) =>
        update({
          sel: !force && sel && state.sel && sel.type === state.sel.type && sel.id === state.sel.id && sel.sub === state.sel.sub ? undefined : sel,
        }),
      setT: (t) => update({ t }, false),
      openDoc: (id) => update({ view: 'docs', doc: id }),
      openPerson: (id) => update({ view: 'people', doc: id, sel: undefined }),
      openOrg: (id) => update({ view: 'orgs', doc: id, sel: undefined }),
      up: (view) => {
        const b = findBack((h) => {
          const s = parseHash(h)
          return s.view === view && !s.doc
        })
        if (b) history.go(-b.n)
        else update({ view, doc: undefined, sel: undefined })
      },
      // entries that only differ in the drawer or the time are the same page and are skipped
      back: (list) => {
        const b = findBack((h) => {
          const s = parseHash(h)
          return s.view !== state.view || s.doc !== state.doc
        })
        if (!b) return { label: pageName(ix, { view: list }), run: () => update({ view: list, doc: undefined, sel: undefined }) }
        return { label: pageName(ix, parseHash(b.hash)), run: () => history.go(-b.n) }
      },
    }),
    [state, ix, update],
  )
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp(): Ctx {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp outside AppProvider')
  return ctx
}

// useState for view settings (filters, grouping, sort) that should come back with the page on back/forward.
// A component mounted fresh on a new page starts from `initial`; one that stays mounted carries its value forward.
export function useHistoryState<T>(name: string, initial: T | (() => T)) {
  const { entry } = useApp()
  const [value, setValue] = useState<T>(() => {
    const s = getUi<T>(name)
    return s.has ? (s.value as T) : initial instanceof Function ? initial() : initial
  })
  const latest = useRef(value)
  latest.current = value
  const seen = useRef<string>(undefined)
  useEffect(() => {
    const s = getUi<T>(name)
    if (seen.current !== undefined && seen.current !== entry && s.has) setValue(s.value as T)
    else if (!s.has) setUi(name, latest.current)
    seen.current = entry
  }, [entry, name])
  const set = useCallback(
    (v: SetStateAction<T>) =>
      setValue((prev) => {
        const next = v instanceof Function ? v(prev) : v
        setUi(name, next)
        return next
      }),
    [name],
  )
  return [value, set] as const
}
