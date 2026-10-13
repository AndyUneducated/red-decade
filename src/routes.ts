// The URL hash carries the whole app state so every page and selection is linkable:
//   #/<page>[/<param>]?sel=<type>:<id>[:<sub>]&t=<fractional year>
// param is the entity id of a detail page (#/people/liu-shaoqi). An unknown page falls back to the default.
import type { EntityType, Ref } from './data/atlas'
import { DEFAULT_PAGE, isPage, page, type PageId } from './pages'

export type Route = { page: PageId; param?: string; sel?: Ref; t: number }

export const DEFAULT_T = 1966 + 7.5 / 12

export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const [head, ...rest] = path.split('/')
  const q = new URLSearchParams(query)
  const sel = q.get('sel')?.split(':')
  const t = Number(q.get('t'))
  const p = isPage(head) ? head : DEFAULT_PAGE
  const param = rest.join('/')
  return {
    page: p,
    param: param && page(p).detail ? decodeURIComponent(param) : undefined,
    sel: sel && sel.length >= 2 ? { type: sel[0] as EntityType, id: sel[1], sub: sel[2] } : undefined,
    t: Number.isFinite(t) && t > 1900 ? t : DEFAULT_T,
  }
}

export function toHash(r: Route): string {
  const q = new URLSearchParams()
  if (r.sel) q.set('sel', `${r.sel.type}:${r.sel.id}${r.sel.sub ? `:${r.sel.sub}` : ''}`)
  if (r.t !== DEFAULT_T) q.set('t', r.t.toFixed(3))
  const qs = q.toString()
  return `#/${r.page}${r.param ? `/${encodeURIComponent(r.param)}` : ''}${qs ? `?${qs}` : ''}`
}
