// Per-head values from two series: an output series divided by population. Population is read as published
// (kind 'reported'); between two census-style counts it is interpolated linearly, never extrapolated.
import type { Series, SeriesPoint } from '../data/schema.ts'

// series unit → per-head unit and the factor to whole units (population is in 万人)
export const PER_HEAD: Record<string, { unit: string; factor: number }> = {
  万吨: { unit: '公斤', factor: 1e7 },
  亿米: { unit: '米', factor: 1e8 },
  万担: { unit: '斤', factor: 1e6 },
  亿斤: { unit: '斤', factor: 1e8 },
}

export type PerHead = { year: number; value: number; point: SeriesPoint; pop: number; popFrom: SeriesPoint[] }

export function popAt(pop: SeriesPoint[], year: number): { value: number; from: SeriesPoint[] } | undefined {
  const pts = pop.filter((p) => p.kind === 'reported').sort((a, b) => a.year - b.year)
  const same = pts.find((p) => p.year === year)
  if (same) return { value: same.value, from: [same] }
  const i = pts.findIndex((p) => p.year > year)
  if (i <= 0) return
  const [a, b] = [pts[i - 1], pts[i]]
  return { value: a.value + ((b.value - a.value) * (year - a.year)) / (b.year - a.year), from: [a, b] }
}

export function perHead(s: Series, pop: Series): PerHead[] {
  const u = PER_HEAD[s.unit]
  if (!u) return []
  return s.points.flatMap((point) => {
    const p = popAt(pop.points, point.year)
    return p ? [{ year: point.year, value: (point.value * u.factor) / (p.value * 1e4), point, pop: p.value, popFrom: p.from }] : []
  })
}
