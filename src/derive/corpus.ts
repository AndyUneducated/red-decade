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

// documents and characters per year
export const yearTotals = (texts: CorpusText[]) =>
  [...groupBy(texts, (t) => Number(t.date.slice(0, 4)))].map(([year, ts]) => ({ year, docs: ts.length, chars: ts.reduce((n, t) => n + t.body.length, 0) }))

// sort key for "first occurrence": a year-only date is somewhere in that year, so it is first only if
// nothing dated within the year is
export const firstKey = (date: string) => (date.length === 4 ? `${date}-13` : date)
