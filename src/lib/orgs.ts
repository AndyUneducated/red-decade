// Time-scoped reading of content/orgs.yaml: what existed, where, and under whom at a moment t.
import type { Org, OrgLink } from '../data/schema'
import { toT } from './dates'

type Span = { from?: string; to?: string }

export const within = (s: Span, t: number) => (!s.from || toT(s.from) <= t) && (!s.to || t < toT(s.to, true))

export const existsAt = (o: Org, t: number) => within(o, t)
export const suspendedAt = (o: Org, t: number) => o.suspended.find((s) => within(s, t))

// The entry valid at t; outside every span, the nearest one, so that an org drawn before its first
// recorded parent (or after its last) still sits somewhere sensible in the tree.
function nearest<T extends Span>(xs: T[], t: number): T | undefined {
  if (!xs.length) return undefined
  const hit = xs.find((x) => within(x, t))
  if (hit) return hit
  const first = xs.reduce((a, b) => (toT(a.from ?? '0') <= toT(b.from ?? '0') ? a : b))
  return first.from && t < toT(first.from) ? first : xs.reduce((a, b) => (toT(a.from ?? '0') >= toT(b.from ?? '0') ? a : b))
}

// Spans laid end to end: an open end runs to the next entry's start, or to hi.
export type Seg<T> = { s: T; a: number; b: number }
export function segments<T extends Span>(xs: T[], lo: number, hi: number): Seg<T>[] {
  const sorted = [...xs].sort((u, v) => (u.from ? toT(u.from) : lo) - (v.from ? toT(v.from) : lo))
  return sorted.map((s, i) => {
    const next = sorted[i + 1]?.from
    return { s, a: s.from ? toT(s.from) : lo, b: s.to ? toT(s.to, true) : next ? toT(next) : hi }
  })
}

export const parentAt = (o: Org, t: number) => nearest(o.under, t)?.org
export const placeAt = (o: Org, t: number) => nearest(o.places, t)?.at

export const KIND_ORDER = ['party', 'state', 'army', 'mass', 'popular', 'unit'] as const
export const LEVEL_ORDER = ['central', 'regional', 'provincial', 'local', 'basic'] as const

// verbs for a dated link, read from this org's side and from the other org's side
export const LINK_OUT: Record<OrgLink, string> = {
  lead: '领导',
  found: '设立',
  oppose: '对立于',
  merge: '并入',
  takeover: '夺权 / 接管',
  replace: '取代',
}
export const LINK_IN: Record<OrgLink, string> = {
  lead: '受其领导：',
  found: '由其设立：',
  oppose: '与之对立：',
  merge: '并入本机构：',
  takeover: '夺权 / 接管本机构：',
  replace: '被其取代：',
}

// heads of a body, as opposed to deputies, members and staff
const HEAD = /(主席|书记|部长|组长|主任|司令员?|总指挥|总理|校长|院长|社长|总编辑|委员长|军长|师长|军团长|局长|政治委员|政委|团长|教育长|参谋长|总负责人)/
const NOT_HEAD = /(副|候补|委员$|常委|成员|组员|书记处书记|秘书)/
// When the title names the org itself, what follows must be the head title (中共中央委员会主席, but not
// 中共中央军事部长, which heads a department of it).
export const isHead = (title: string, o: Org) => {
  const first = title.split('、')[0]
  if (!HEAD.test(first) || NOT_HEAD.test(first)) return false
  const prefix = [o.name, o.short, ...o.aliases].filter((a): a is string => !!a && first.startsWith(a)).sort((a, b) => b.length - a.length)[0]
  if (!prefix) return true
  const rest = first.slice(prefix.length)
  return rest === '长' || new RegExp(`^(党委|党组)?(第[一二三])?${HEAD.source}`).test(rest)
}
