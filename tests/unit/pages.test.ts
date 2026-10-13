import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { groupOf, itemOf, NAV, navProblems } from '../../src/nav'
import { DEFAULT_PAGE, detailPage, page, PAGE_IDS, type DetailKind } from '../../src/pages'
import { DEFAULT_T, parseHash, toHash, type Route } from '../../src/routes'

describe('page registry and menu', () => {
  it('lists every visible page in exactly one menu group', () => {
    expect(navProblems()).toEqual([])
  })

  it('gives every page a title and a description', () => {
    for (const p of PAGE_IDS) {
      expect(page(p).title, p).not.toBe('')
      expect(page(p).desc, p).not.toBe('')
    }
  })

  it('has page ids that are safe as a URL path segment', () => {
    for (const p of PAGE_IDS) expect(p).toMatch(/^[a-z][a-z0-9-]*$/)
  })

  it('shows each kind of entity on one page, with a sample to open', () => {
    const kinds = PAGE_IDS.flatMap((p) => (page(p).detail ? [page(p).detail!.kind] : []))
    expect(new Set(kinds).size).toBe(kinds.length)
    for (const k of kinds as DetailKind[]) expect(page(detailPage(k)).sample, k).toBeTruthy()
  })

  it('finds the group and label of every listed page', () => {
    for (const g of NAV)
      for (const it of g.items) {
        expect(groupOf(it.page).label).toBe(g.label)
        expect(itemOf(it.page).label).toBe(it.label)
      }
  })
})

describe('routes', () => {
  const samples: Route[] = PAGE_IDS.flatMap((p) => {
    const plain: Route = { page: p, t: DEFAULT_T }
    const s = page(p).sample
    return s ? [plain, { page: p, param: s, t: DEFAULT_T }] : [plain]
  })

  it('round-trips every page and sample detail page', () => {
    for (const r of samples) expect(parseHash(toHash(r))).toEqual({ ...r, sel: undefined })
  })

  it('round-trips the selection and the time', () => {
    const r: Route = { page: 'timeline', sel: { type: 'person', id: 'mao-zedong', sub: 'x' }, t: 1967.25 }
    expect(parseHash(toHash(r))).toEqual({ ...r, param: undefined })
    expect(toHash({ page: 'people', t: DEFAULT_T })).toBe('#/people')
  })

  it('escapes a param that contains a slash or a query', () => {
    const r: Route = { page: 'docs', param: 'a/b?c', t: DEFAULT_T }
    expect(parseHash(toHash(r)).param).toBe('a/b?c')
  })

  it('falls back to the default page and drops a param the page does not take', () => {
    expect(parseHash('').page).toBe(DEFAULT_PAGE)
    expect(parseHash('#/no-such-page/x').page).toBe(DEFAULT_PAGE)
    expect(parseHash('#/no-such-page/x').param).toBeUndefined()
    expect(parseHash('#/network/liu-shaoqi')).toMatchObject({ page: 'network', param: undefined })
    expect(parseHash('#/timeline?t=abc').t).toBe(DEFAULT_T)
  })
})

// public/data/atlas.json is written by `npm run data:build`; CI builds before it tests
const ATLAS = new URL('../../public/data/atlas.json', import.meta.url)
describe.skipIf(!existsSync(ATLAS))('sample detail pages', () => {
  const atlas = JSON.parse(readFileSync(ATLAS, 'utf8')) as Record<string, { id: string }[]>
  // a day is not an entity in the atlas; its sample only has to name a day
  const LISTS: Record<Exclude<DetailKind, 'day'>, string> = { person: 'people', org: 'orgs', faction: 'factions', doc: 'sources', topic: 'topics' }
  it('open entities that exist', () => {
    for (const p of PAGE_IDS) {
      const d = page(p).detail
      if (d?.kind === 'day') expect(page(p).sample).toMatch(/^\d\d-\d\d$/)
      else if (d) expect(atlas[LISTS[d.kind]].map((x) => x.id), `${p}: ${page(p).sample}`).toContain(page(p).sample)
    }
  })
})
