import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { indexAtlas } from '../../src/data/atlas'
import type { Atlas, Org, Place } from '../../src/data/schema'
import { firstKey, termHits, yearTotals } from '../../src/derive/corpus'
import { orgMentioner, placeMatcher, positionMatcher } from '../../src/derive/match'
import { quoteMisses, stripAttribution } from '../../src/derive/quotes'
import { after } from '../../src/lib/dates'

describe('quotes', () => {
  const body = '我们要‘斗私批修’。这是一场伟大的革命，触及人们灵魂。'
  it('accepts a verbatim quote, nested quote marks and a final mark where the source goes on', () => {
    expect(quoteMisses(body, '我们要“斗私批修”')).toEqual([])
    expect(quoteMisses(body, '这是一场伟大的革命。')).toEqual([])
  })
  it('checks each part around an ellipsis', () => {
    expect(quoteMisses(body, '我们要……触及人们灵魂')).toEqual([])
    expect(quoteMisses(body, '我们要……触及人们思想')).toEqual(['触及人们思想'])
  })
  it('strips a trailing attribution', () => {
    expect(stripAttribution('“千万不要忘记”（十中全会公报）')).toBe('“千万不要忘记”')
  })
})

describe('partial dates', () => {
  it('compares on the common prefix', () => {
    expect(after('1967', '1966-12')).toBe(true)
    expect(after('1966', '1966-05')).toBe(false)
    expect(after('1966-05', '1966')).toBe(false)
  })
})

describe('corpus', () => {
  const texts = [
    { id: 'a', date: '1966-05', body: '走资本主义道路的当权派。当权派。' },
    { id: 'b', date: '1966', body: '无关' },
    { id: 'c', date: '1967-01', body: '一小撮当权派' },
  ]
  it('counts every mention and keeps context around the first', () => {
    const [a, c] = termHits(texts, ['当权派'])
    expect(a).toMatchObject({ source: 'a', count: 2 })
    expect(a.context).toContain('当权派')
    expect(c).toMatchObject({ source: 'c', count: 1 })
  })
  it('masks longer words listed as exceptions', () => {
    expect(termHits(texts, ['当权派'], ['走资本主义道路的当权派'])[0]).toMatchObject({ source: 'a', count: 1 })
  })
  it('totals by year and sorts a year-only date last in its year', () => {
    expect(yearTotals(texts)).toEqual([
      { year: 1966, docs: 2, chars: texts[0].body.length + 2 },
      { year: 1967, docs: 1, chars: 6 },
    ])
    expect(firstKey('1966') > firstKey('1966-12-31')).toBe(true)
  })
})

describe('name matching', () => {
  const place = (id: string, name: string, names: string[] = []) => ({ id, name, names }) as unknown as Place
  it('takes the longest place name, ignoring notes in parentheses', () => {
    const placeOf = placeMatcher([place('hunan', '湖南'), place('shaoshan', '韶山'), place('xiangtan', '湘潭')])
    expect(placeOf('湖南湘潭韶山')).toBe('shaoshan')
    expect(placeOf('湖南湘潭（今属韶山）')).toBe('xiangtan')
    expect(placeOf(undefined)).toBeUndefined()
  })

  const org = (id: string, name: string, extra: Partial<Org> = {}) => ({ id, name, aliases: [], under: [], kind: 'party', ...extra }) as unknown as Org
  const orgs = [org('ccp', '中共中央'), org('ccrg', '中共中央文革小组', { short: '中央文革', under: [{ org: 'ccp' }] } as Partial<Org>), org('xijiu', '西城区纠察队', { short: '西纠', kind: 'popular' } as Partial<Org>)]
  it('credits only the longest org name at each position', () => {
    const mentions = orgMentioner(orgs)
    expect([...mentions('中共中央文革小组发出通知')]).toEqual(['ccrg'])
    expect([...mentions('中共中央和中央文革')].sort()).toEqual(['ccp', 'ccrg'])
    expect([...mentions('西纠成立')]).toEqual(['xijiu'])
  })
  it('links a position to the sub-body its title names', () => {
    const orgOf = positionMatcher(orgs)
    expect(orgOf({ title: '中共中央文革小组组长', orgName: '中共中央' } as never)).toBe('ccrg')
    expect(orgOf({ title: '委员', orgName: '中共中央' } as never)).toBe('ccp')
  })
})

// public/data/atlas.json is written by `npm run data:build`; CI builds before it tests
const ATLAS = new URL('../../public/data/atlas.json', import.meta.url)
describe.skipIf(!existsSync(ATLAS))('the built atlas', () => {
  const ix = indexAtlas(JSON.parse(readFileSync(ATLAS, 'utf8')) as Atlas)
  it('indexes every collection by id', () => {
    expect(ix.person.size).toBe(ix.people.length)
    expect(ix.org.size).toBe(ix.orgs.length)
    expect(ix.event.size).toBe(ix.events.length)
  })
  it('links events to the orgs they name', () => {
    expect(ix.eventsByOrg.get('ccrg')?.length).toBeGreaterThan(0)
  })
})
