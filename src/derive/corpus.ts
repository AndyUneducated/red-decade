// Term counts over the source texts. Shared by the data build and the browser (see quotes.ts).
import type { ConceptHit } from '../data/schema.ts'

export type CorpusText = { id: string; date: string; body: string }

export function groupBy<T, K>(xs: T[], key: (x: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>()
  for (const x of xs) {
    const k = key(x)
    const list = m.get(k)
    if (list) list.push(x)
    else m.set(k, [x])
  }
  return m
}

// One hit per text that mentions any of `terms`, with the count of all mentions and 36 characters of
// context around the earliest. `except` lists longer words that contain a term but mean something else;
// they are masked before counting.
export function termHits(texts: CorpusText[], terms: string[], except: string[] = []): ConceptHit[] {
  const hits: ConceptHit[] = []
  for (const t of texts) {
    const body = except.reduce((b, x) => b.replaceAll(x, '□'.repeat(x.length)), t.body)
    let count = 0
    let first = -1
    let firstTerm = ''
    for (const term of terms) {
      const n = body.split(term).length - 1
      if (!n) continue
      count += n
      const i = body.indexOf(term)
      if (first < 0 || i < first) [first, firstTerm] = [i, term]
    }
    if (!count) continue
    const context = t.body.slice(Math.max(0, first - 36), first + firstTerm.length + 36).replace(/\s+/g, ' ')
    hits.push({ source: t.id, date: t.date, count, context })
  }
  return hits
}

// A set of tracked terms counted year by year: hits sorted so the first is the earliest, and per-year counts.
// The year totals of the same texts are the denominator for rates.
export function tally<D extends { terms: string[]; except: string[] }>(texts: CorpusText[], defs: D[]) {
  return {
    years: yearTotals(texts),
    terms: defs.map(({ except, ...d }) => {
      const hits = termHits(texts, d.terms, except).sort((a, b) => firstKey(a.date).localeCompare(firstKey(b.date)))
      const counts = [...groupBy(hits, (h) => Number(h.date.slice(0, 4)))].map(([year, hs]) => ({ year, n: hs.reduce((n, h) => n + h.count, 0) }))
      return { ...d, counts, first: hits[0], total: hits.reduce((n, h) => n + h.count, 0) }
    }),
  }
}

// How often each name occurs within `radius` characters of a term: every term occurrence opens a passage,
// overlapping passages are merged, and a name counts once per passage. Longer names are matched first and
// masked, so 刘少奇 is not also counted as 少奇.
export function namesNear(texts: CorpusText[], terms: string[], names: { id: string; names: string[] }[], radius = 60): Map<string, number> {
  const byLength = names.flatMap((n) => n.names.map((name) => ({ id: n.id, name }))).sort((a, b) => b.name.length - a.name.length)
  const out = new Map<string, number>()
  for (const t of texts) {
    const spans: [number, number][] = []
    for (const term of terms)
      for (let i = t.body.indexOf(term); i >= 0; i = t.body.indexOf(term, i + term.length)) spans.push([Math.max(0, i - radius), i + term.length + radius])
    spans.sort((a, b) => a[0] - b[0])
    const merged: [number, number][] = []
    for (const s of spans) {
      const last = merged.at(-1)
      if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1])
      else merged.push([...s])
    }
    for (const [a, b] of merged) {
      let passage = t.body.slice(a, b)
      const seen = new Set<string>()
      for (const { id, name } of byLength) {
        if (!passage.includes(name)) continue
        passage = passage.replaceAll(name, '□'.repeat(name.length))
        seen.add(id)
      }
      for (const id of seen) out.set(id, (out.get(id) ?? 0) + 1)
    }
  }
  return out
}

// Texts that name another document in book-title marks (《二月提纲》). Only documents dated no later than the
// citing text count, so a later reprint with the same title is not taken for a citation.
export function titleMentions(texts: CorpusText[], docs: { id: string; date: string; names: string[] }[]): { from: string; to: string; n: number }[] {
  const out: { from: string; to: string; n: number }[] = []
  for (const t of texts)
    for (const d of docs) {
      if (d.id === t.id || firstKey(d.date) > firstKey(t.date)) continue
      const n = d.names.reduce((k, name) => k + t.body.split(`《${name}》`).length - 1, 0)
      if (n) out.push({ from: t.id, to: d.id, n })
    }
  return out
}

// documents and characters per year
export const yearTotals = (texts: CorpusText[]) =>
  [...groupBy(texts, (t) => Number(t.date.slice(0, 4)))].map(([year, ts]) => ({ year, docs: ts.length, chars: ts.reduce((n, t) => n + t.body.length, 0) }))

// sort key for "first occurrence": a year-only date is somewhere in that year, so it is first only if
// nothing dated within the year is
export const firstKey = (date: string) => (date.length === 4 ? `${date}-13` : date)
