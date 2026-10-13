import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { indexAtlas } from '../../src/data/atlas'
import type { Atlas } from '../../src/data/schema'
import { lensOf, lensUsable } from '../../src/derive/lens'
import { DAYS, dayIndex, dayOf, shiftDay, todayKey } from '../../src/derive/today'
import { DEFAULT_T, parseHash, toHash } from '../../src/routes'

describe('days of the year', () => {
  it('has every day of a leap year once', () => {
    expect(DAYS).toHaveLength(366)
    expect(new Set(DAYS).size).toBe(366)
    expect(DAYS[59]).toBe('02-29')
  })
  it('steps across the year end', () => {
    expect(shiftDay('12-31', 1)).toBe('01-01')
    expect(shiftDay('01-01', -1)).toBe('12-31')
    expect(todayKey(new Date(2026, 9, 13))).toBe('10-13')
  })
  it('keeps only full dates inside the period', () => {
    expect(dayOf('1966-08-18')).toBe('08-18')
    expect(dayOf('1966-08')).toBeUndefined()
    expect(dayOf('1990-01-11')).toBeUndefined()
  })
})

describe('the personal view in the URL', () => {
  it('carries the person across pages and drops an empty one', () => {
    const r = { page: 'timeline' as const, t: DEFAULT_T, as: 'liu-shaoqi' }
    expect(toHash(r)).toBe('#/timeline?as=liu-shaoqi')
    expect(parseHash(toHash(r))).toEqual(r)
    expect(parseHash('#/timeline?as=').as).toBeUndefined()
  })
})

// M9 acceptance (milestones.md): at least 300 people have a personal view, and every day has something to show
const ATLAS = new URL('../../public/data/atlas.json', import.meta.url)
describe.skipIf(!existsSync(ATLAS))('M9 acceptance on the built atlas', () => {
  const ix = indexAtlas(JSON.parse(readFileSync(ATLAS, 'utf8')) as Atlas)
  it('has something on every day of the year', () => {
    const days = dayIndex(ix)
    expect(DAYS.filter((d) => !days.get(d)?.length)).toEqual([])
  })
  it('offers a personal view for at least 300 people', () => {
    const usable = ix.people.filter((p) => lensUsable(lensOf(ix, p.id)))
    expect(usable.length).toBeGreaterThanOrEqual(300)
  })
  it("finds a person's own texts and events", () => {
    const l = lensOf(ix, 'liu-shaoqi')!
    expect(l.events.size).toBeGreaterThan(10)
    expect(l.wrote.size).toBeGreaterThan(0)
    for (const s of l.sources) expect(ix.source.has(s)).toBe(true)
  })
})
