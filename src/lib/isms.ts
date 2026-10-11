// Reading content/isms.yaml and content/line.yaml at a moment t.
import type { Ism } from '../data/atlas'
import type { IsmKind, LinePoint } from '../data/schema'
import { toT } from './dates'

export const ismColor = (k: IsmKind) => `var(--ism-${k})`
export const KIND_ORDER: IsmKind[] = ['foreign', 'core', 'line', 'heterodox', 'label']

export const AXES = {
  x: ['计划 · 公有 · 平均', '市场 · 多种所有制 · 物质刺激'],
  y: ['阶级斗争 · 群众动员 · 集中', '宽松 · 制度化 · 多元'],
} as const

export const aliveAt = (m: Ism, t: number) => toT(m.from) <= t && (!m.to || t < toT(m.to, true))

type Pt = { x: number; y: number }

// Linear between dated points, held flat before the first and after the last.
export function track(points: { at: string; x: number; y: number }[], t: number): Pt | undefined {
  if (!points.length) return undefined
  const ts = points.map((p) => toT(p.at))
  if (t <= ts[0]) return points[0]
  const i = ts.findIndex((u) => u > t)
  if (i < 0) return points[points.length - 1]
  const a = points[i - 1]
  const b = points[i]
  const k = (t - ts[i - 1]) / (ts[i] - ts[i - 1])
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
}

export const posAt = (m: Ism, t: number) => (aliveAt(m, t) ? track(m.pos, t) : undefined)

// The line's turns up to t, ending at its interpolated position.
export function lineUntil(line: LinePoint[], t: number): Pt[] {
  const past = line.filter((p) => toT(p.at) <= t)
  const now = track(line, t)
  return now && past.length ? [...past, now] : past
}

const word = (v: number, [lo, hi]: readonly [string, string]) =>
  Math.abs(v) < 0.15 ? '居中' : `${Math.abs(v) > 0.6 ? '强烈' : ''}偏向${(v < 0 ? lo : hi).split(' · ')[0]}`
export const describe = (p: Pt) => `经济${word(p.x, AXES.x)}，政治${word(p.y, AXES.y)}`
