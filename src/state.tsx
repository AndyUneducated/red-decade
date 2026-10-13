// App state lives in the URL hash (routes.ts) so every page and selection is linkable. Pages are defined in
// pages.ts and arranged into the menu in nav.ts; nothing here knows where a page sits in the menu.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type SetStateAction } from 'react'
import type { Index, Ref } from './data/atlas'
import { lensOf, type Lens } from './derive/lens'
import { adoptEntry, beginRestore, currentEntry, findBack, getUi, pushEntry, restoreScroll, setUi } from './lib/history'
import { groupOf, type NavGroup } from './nav'
import { detailPage, page as pageDef, type DetailKind, type PageId } from './pages'
import { parseHash, toHash, type Route } from './routes'

// the page last shown in each menu group, so the group's tab returns to it; kept for the session
const lastShown = new Map<string, PageId>()
export const lastPage = (g: NavGroup): PageId => lastShown.get(g.label) ?? g.items[0].page

// entry identifies the history entry, which carries remembered scroll offsets and UI state
type State = Route & { entry: string }

type Ctx = State & {
  ix: Index
  // sel, when given, is selected in the same history entry
  go: (page: PageId, param?: string, sel?: Ref) => void
  // selecting what the drawer already shows closes it, so a second click on a link works as a toggle;
  // force keeps it open (search results, programmatic jumps)
  select: (ref?: Ref, force?: boolean) => void
  setT: (t: number) => void
  // the full page of an entity (#/people/<id>); the drawer closes so the same thing is not shown twice
  open: (kind: DetailKind, id?: string) => void
  openDoc: (id: string) => void
  openPerson: (id?: string) => void
  openOrg: (id?: string) => void
  // from a detail page up to its list: go back through history when the list is there, so it comes back
  // where it was left; otherwise open the list fresh
  up: (page: PageId) => void
  // a detail page's back link: to the page it was opened from, else up to the list
  back: (list: PageId) => { label: string; run: () => void }
  // the personal view: the chosen person's share of the atlas, on every page until cleared
  lens?: Lens
  setLens: (id?: string) => void
}

export function pageName(ix: Index, r: { page: PageId; param?: string }): string {
  const d = pageDef(r.page)
  return (r.param && d.detail?.name(ix, r.param)) || d.title
}

const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({ ix, children }: { ix: Index; children: ReactNode }) {
  const [state, setState] = useState<State>(() => ({ ...parseHash(location.hash), entry: adoptEntry().key }))
  const latest = useRef(state)
  latest.current = state
  const restoreTo = useRef<string>(undefined)

  useEffect(() => {
    const g = groupOf(state.page)
    if (g.label) lastShown.set(g.label, state.page)
  }, [state.page])

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
      setState((latest.current = { ...parseHash(location.hash), entry: key }))
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

  const value = useMemo<Ctx>(() => {
    const open = (kind: DetailKind, id?: string) => update({ page: detailPage(kind), param: id, sel: undefined })
    return {
      ...state,
      ix,
      go: (page, param, sel) => update(sel ? { page, param, sel } : { page, param }),
      select: (sel, force) =>
        update({
          sel: !force && sel && state.sel && sel.type === state.sel.type && sel.id === state.sel.id && sel.sub === state.sel.sub ? undefined : sel,
        }),
      setT: (t) => update({ t }, false),
      open,
      openDoc: (id) => update({ page: detailPage('doc'), param: id }),
      openPerson: (id) => open('person', id),
      openOrg: (id) => open('org', id),
      up: (page) => {
        const b = findBack((h) => {
          const r = parseHash(h)
          return r.page === page && !r.param
        })
        if (b) history.go(-b.n)
        else update({ page, param: undefined, sel: undefined })
      },
      // entries that only differ in the drawer or the time are the same page and are skipped
      back: (list) => {
        const b = findBack((h) => {
          const r = parseHash(h)
          return r.page !== state.page || r.param !== state.param
        })
        if (!b) return { label: pageName(ix, { page: list }), run: () => update({ page: list, param: undefined, sel: undefined }) }
        return { label: pageName(ix, parseHash(b.hash)), run: () => history.go(-b.n) }
      },
      lens: state.as ? lensOf(ix, state.as) : undefined,
      setLens: (id) => update({ as: id }),
    }
  }, [state, ix, update])
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
