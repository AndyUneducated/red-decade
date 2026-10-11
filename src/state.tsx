// App state lives in the URL hash so every view/selection is linkable:
//   #/<view>?sel=<type>:<id>[:<sub>]&t=<fractional year>
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { EntityType, Index, Ref } from './data/atlas'

export const VIEWS = {
  timeline: '时间线',
  people: '人物',
  orgs: '机构',
  network: '人物网络',
  fates: '命运矩阵',
  river: '派系河流',
  ideas: '思想谱系',
  narratives: '叙事对照',
  docs: '文献',
  research: '研究',
} as const
export type View = keyof typeof VIEWS

// doc is the second path segment: a document id in docs, a person id in people, an org id in orgs
type State = { view: View; sel?: Ref; t: number; doc?: string }

const DEFAULT_T = 1966 + 7.5 / 12

function parseHash(): State {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?')
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

function toHash(s: State): string {
  const q = new URLSearchParams()
  if (s.sel) q.set('sel', `${s.sel.type}:${s.sel.id}${s.sel.sub ? `:${s.sel.sub}` : ''}`)
  if (s.t !== DEFAULT_T) q.set('t', s.t.toFixed(3))
  const qs = q.toString()
  return `#/${s.view}${s.doc ? `/${s.doc}` : ''}${qs ? `?${qs}` : ''}`
}

type Ctx = State & {
  ix: Index
  go: (view: View, doc?: string) => void
  select: (ref?: Ref) => void
  setT: (t: number) => void
  openDoc: (id: string) => void
  // full profile page (#/people/<id>); the drawer closes so the same person is not shown twice
  openPerson: (id?: string) => void
  openOrg: (id?: string) => void
}

const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({ ix, children }: { ix: Index; children: ReactNode }) {
  const [state, setState] = useState<State>(parseHash)

  useEffect(() => {
    const onHash = () => setState(parseHash())
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  const update = useCallback((patch: Partial<State>, push = true) => {
    setState((prev) => {
      const next = { ...prev, ...patch }
      const hash = toHash(next)
      if (hash !== location.hash) history[push ? 'pushState' : 'replaceState'](null, '', hash)
      return next
    })
  }, [])

  const value = useMemo<Ctx>(
    () => ({
      ...state,
      ix,
      go: (view, doc) => update({ view, doc }),
      select: (sel) => update({ sel }),
      setT: (t) => update({ t }, false),
      openDoc: (id) => update({ view: 'docs', doc: id }),
      openPerson: (id) => update({ view: 'people', doc: id, sel: undefined }),
      openOrg: (id) => update({ view: 'orgs', doc: id, sel: undefined }),
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
