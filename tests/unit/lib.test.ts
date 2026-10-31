import { describe, expect, it } from 'vitest'
import { fmtDate, fmtRange, fromT, lifespan, toT, tToDate } from '../../src/lib/dates'
import { describe as describePos, lineUntil, track } from '../../src/lib/isms'
import { heldAt, systemOf } from '../../src/lib/positions'
import { shortTitle } from '../../src/lib/sources'

describe('dates', () => {
  it('reads a partial date as the start of its span, or the end when asked', () => {
    expect(toT('1966')).toBe(1966)
    expect(toT('1966', true)).toBe(1967)
    expect(toT('1966-07')).toBeCloseTo(1966.5)
    expect(toT('1966-07', true)).toBeCloseTo(1966 + 7 / 12)
    expect(toT('1966-02-01')).toBeCloseTo(1966 + 1 / 12)
    expect(toT(undefined)).toBeNaN()
  })

  it('round-trips every day of a leap year through a fractional year', () => {
    for (let d = new Date(1968, 0, 1); d.getFullYear() === 1968; d.setDate(d.getDate() + 1)) {
      const iso = `1968-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      expect(tToDate(toT(iso))).toBe(iso)
    }
    expect(fromT(1968 + 1 / 12)).toEqual({ y: 1968, m: 2, d: 1 })
    let t = 1959.5
    for (let i = 0; i < 264; i++) t += 1 / 12
    expect(fromT(t)).toEqual({ y: 1981, m: 7, d: 1 })
  })

  it('writes dates and ranges the Chinese way, dropping what repeats', () => {
    expect(fmtDate('1966-05-16')).toBe('1966年5月16日')
    expect(fmtDate('1966-05')).toBe('1966年5月')
    expect(fmtDate('1966')).toBe('1966年')
    expect(fmtRange('1966-08-18', '1966-08-31')).toBe('1966年8月18日–31日')
    expect(fmtRange('1966-08', '1966-11')).toBe('1966年8月–11月')
    expect(fmtRange('1966', '1976')).toBe('1966年–1976年')
    expect(lifespan('1898-11-24', '1969-11-12')).toBe('1898–1969')
    expect(lifespan('1948')).toBe('1948–')
    expect(lifespan(undefined, '1966')).toBe('?–1966')
    expect(lifespan()).toBe('')
  })
})

describe('positions', () => {
  it('holds a post from the start of its first month to the end of its last', () => {
    const p = { from: '1966-08', to: '1967-01' }
    expect(heldAt(p, toT('1966-08'))).toBe(true)
    expect(heldAt(p, toT('1967-01-31'))).toBe(true)
    expect(heldAt(p, toT('1967-02-02'))).toBe(false)
    expect(heldAt({}, 1900)).toBe(true)
  })

  it('sorts posts into party, state, army and other lanes', () => {
    expect(systemOf({ title: '中共中央副主席、中央军委副主席' })).toBe('party')
    expect(systemOf({ title: '国务院总理' })).toBe('gov')
    expect(systemOf({ title: '北京军区司令员' })).toBe('army')
    expect(systemOf({ title: '委员', orgName: '中共中央军委' })).toBe('army')
    expect(systemOf({ title: '清华大学井冈山兵团总部负责人' })).toBe('other')
    expect(systemOf({ title: '北京大学党委书记' })).toBe('party')
    expect(systemOf({ title: '全国妇联主席' })).toBe('other')
    expect(systemOf({ title: '办公室主任', sys: 'army' })).toBe('army')
  })
})

describe('spectrum', () => {
  const pts = [
    { at: '1966', x: 0, y: 0 },
    { at: '1968', x: 1, y: -1 },
  ]
  it('interpolates between dated points and holds flat outside them', () => {
    expect(track(pts, 1960)).toEqual(pts[0])
    expect(track(pts, 1967)).toEqual({ x: 0.5, y: -0.5 })
    expect(track(pts, 1990)).toEqual(pts[1])
    expect(track([], 1967)).toBeUndefined()
  })
  it('draws the line up to t, ending where it is at t', () => {
    const line = pts.map((p) => ({ ...p, label: '' }))
    expect(lineUntil(line, 1967)).toEqual([line[0], { x: 0.5, y: -0.5 }])
    expect(lineUntil(line, 1965)).toEqual([])
  })
  it('describes a point in words', () => {
    expect(describePos({ x: 0, y: 0 })).toBe('经济居中，政治居中')
    expect(describePos({ x: -0.9, y: 0.3 })).toBe('经济强烈偏向计划，政治偏向宽松')
  })
})

describe('source titles', () => {
  it('prefers the alias, else drops bracketed notes and book marks', () => {
    expect(shortTitle({ title: '《五一六通知》（中发〔66〕267号）' })).toBe('五一六通知')
    expect(shortTitle({ title: '长标题', alias: '短名' })).toBe('短名')
  })
})
