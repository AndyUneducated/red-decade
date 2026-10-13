// App state lives in the URL hash so every view/selection is linkable:
//   #/<view>?sel=<type>:<id>[:<sub>]&t=<fractional year>
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type SetStateAction } from 'react'
import type { EntityType, Index, Ref } from './data/atlas'
import { adoptEntry, beginRestore, currentEntry, getUi, pushEntry, restoreScroll, setUi, stepsBackTo } from './lib/history'

export const VIEWS = {
  timeline: '时间线',
  people: '名录',
  orgs: '机构',
  network: '人物网络',
  fates: '命运矩阵',
  river: '派系河流',
  map: '革委会地图',
  ideas: '思想谱系',
  narratives: '叙事对照',
  figures: '数字争议',
  docs: '文献',
  research: '研究',
} as const
export type View = keyof typeof VIEWS

// The top bar shows these groups; views that share a group get a sub-nav above their title.
// Every view keeps its own route, so old links still open.
export const NAV: { label: string; views: View[] }[] = [
  { label: '时间线', views: ['timeline'] },
  { label: '人物', views: ['people', 'network', 'fates'] },
  { label: '机构与派系', views: ['orgs', 'river'] },
  { label: '革委会地图', views: ['map'] },
  { label: '思想谱系', views: ['ideas'] },
  { label: '争议', views: ['figures', 'narratives', 'research'] },
  { label: '文献', views: ['docs'] },
]
export const groupOf = (v: View) => NAV.find((g) => g.views.includes(v))!

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
}

const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({ ix, children }: { ix: Index; children: ReactNode }) {
  const [state, setState] = useState<State>(() => ({ ...parseHash(), entry: adoptEntry().key }))
  const latest = useRef(state)
  latest.current = state
  const restoreTo = useRef<string>(undefined)

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
        const n = stepsBackTo((h) => {
          const s = parseHash(h)
          return s.view === view && !s.doc
        })
        if (n) history.go(-n)
        else update({ view, doc: undefined, sel: undefined })
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
