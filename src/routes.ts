// The URL hash carries the whole app state so every page and selection is linkable:
//   #/<page>[/<param>]?sel=<type>:<id>[:<sub>]&t=<fractional year>&as=<person id>
// param is the entity id of a detail page (#/people/liu-shaoqi). An unknown page falls back to the default.
// as is the personal view (M9): it stays when moving between pages until it is cleared.
import type { EntityType, Ref } from './data/atlas'
import { DEFAULT_PAGE, isPage, page, type PageId } from './pages'

export type Route = { page: PageId; param?: string; sel?: Ref; t: number; as?: string }

export const DEFAULT_T = 1966 + 7.5 / 12

export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const [head, ...rest] = path.split('/')
  const q = new URLSearchParams(query)
  const sel = q.get('sel')?.split(':')
  const t = Number(q.get('t'))
  const known = isPage(head)
  const p = known ? head : DEFAULT_PAGE
  const param = rest.join('/')
  return {
    page: p,
    param: param && known && page(p).detail ? decodeURIComponent(param) : undefined,
    sel: sel && sel.length >= 2 ? { type: sel[0] as EntityType, id: sel[1], sub: sel[2] } : undefined,
    t: Number.isFinite(t) && t > 1900 ? t : DEFAULT_T,
    as: q.get('as') || undefined,
  }
}

// an old link to a renamed record (atlas.moved, site hashes old → new) points at the new record: its detail
// page, and a selection of it wherever it is open (a person's drawer card as well as #/people/<id>).
// Undefined when nothing moved.
export function relink(r: Route, moved: { from: string; to: string }[]): Route | undefined {
  const asSel = (h: Route): Ref | undefined => h.sel ?? (h.param ? { type: page(h.page).detail?.kind as EntityType, id: h.param } : undefined)
  for (const m of moved) {
    const a = parseHash(m.from)
    const b = parseHash(m.to)
    if (a.param && r.page === a.page && r.param === a.param) return { ...r, page: b.page, param: b.param }
    const [sa, sb] = [asSel(a), asSel(b)]
    if (sa && sb && r.sel?.type === sa.type && r.sel.id === sa.id) return { ...r, sel: { ...r.sel, type: sb.type, id: sb.id } }
  }
}

export function toHash(r: Route): string {
  const q = new URLSearchParams()
  if (r.sel) q.set('sel', `${r.sel.type}:${r.sel.id}${r.sel.sub ? `:${r.sel.sub}` : ''}`)
  if (r.t !== DEFAULT_T) q.set('t', r.t.toFixed(3))
  if (r.as) q.set('as', r.as)
  const qs = q.toString()
  return `#/${r.page}${r.param ? `/${encodeURIComponent(r.param)}` : ''}${qs ? `?${qs}` : ''}`
}
