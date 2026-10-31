// The build's guards on small hand-made data: each rule must reject the record it is written for,
// and a clean set must pass. The real content is checked by `npm run data:build`.
import { describe, expect, it } from 'vitest'
import { ClaimSchema, EssaySchema, EventSchema, FactionSchema, OrgSchema, PersonSchema, SeriesSchema, SourceSchema } from '../../src/data/schema'
import { check } from '../../tools/build/check.ts'
import { errors } from '../../tools/build/io.ts'
import type { Data } from '../../tools/build/load.ts'
import { checkQuotes } from '../../tools/build/quotes.ts'

const TEXT = '无产阶级文化大革命，是一场触及人们灵魂的大革命。'

const person = (x: object = {}) => PersonSchema.parse({ id: 'p', name: '某甲', tier: 3, role1966: '', bio: '', factions: ['f'], born: '1910', died: '1970', ...x })
const event = (x: object = {}) => EventSchema.parse({ id: 'e', date: '1966-05-16', title: '通知', lane: 'center', summary: '', cites: ['s'], ...x })
const org = (x: object = {}) => OrgSchema.parse({ id: 'o', name: '某委员会', kind: 'party', level: 'central', summary: '', verify: true, ...x })

function data(over: Partial<Record<keyof Data, unknown>> = {}): Data {
  const sources = [SourceSchema.parse({ id: 's', title: '通知', date: '1966-05-16', kind: 'party-doc', tier: 1, hasText: true })]
  return {
    people: [person()],
    factions: [FactionSchema.parse({ id: 'f', name: '某派', kind: 'core', color: '#000', summary: '' })],
    events: [event()],
    orgs: [org()],
    concepts: [],
    places: [],
    isms: [],
    topics: [],
    counties: [],
    pressTerms: [],
    relations: [],
    claims: [],
    essays: [],
    archive: [],
    documents: [],
    line: [],
    figures: [],
    revcoms: [],
    series: [],
    provinces: new Set<string>(),
    selfcrit: { texts: [], phrases: [] },
    authorities: [],
    sources,
    sourceById: new Map(sources.map((s) => [s.id, s])),
    texts: new Map([['s', TEXT]]),
    ...over,
  } as unknown as Data
}

function run(d: Data) {
  errors.length = 0
  check(d)
  checkQuotes(d)
  return [...errors]
}

describe('build check', () => {
  it('passes a clean set', () => {
    expect(run(data())).toEqual([])
  })

  it('rejects ids that point nowhere', () => {
    expect(run(data({ people: [person({ factions: ['nope'] })] }))).toEqual([expect.stringContaining('unknown id "nope"')])
    expect(run(data({ events: [event({ people: ['nobody'] })] }))).toEqual([expect.stringContaining('unknown id "nobody"')])
    expect(run(data({ events: [event({ cites: ['missing'] })] }))).toEqual([expect.stringContaining('unknown source "missing"')])
  })

  it('rejects a duplicate id', () => {
    expect(run(data({ events: [event(), event()] }))).toEqual(['duplicate event id e'])
  })

  it('requires every person to have a faction, since views group by the first', () => {
    expect(run(data({ people: [person({ factions: [] })] }))).toEqual(['person p: no faction'])
  })

  it('keeps fate nodes in order and dated facts inside the life', () => {
    const fate = [
      { date: '1967', s: 'purged' },
      { date: '1966', s: 'attacked' },
    ]
    expect(run(data({ people: [person({ fate })] }))).toEqual(['person p: fate out of order at 1966'])
    expect(run(data({ people: [person({ positions: [{ title: '书记', from: '1905' }] })] }))[0]).toMatch(/before birth/)
    expect(run(data({ people: [person({ positions: [{ title: '书记', from: '1960', to: '1950' }] })] }))[0]).toMatch(/ends \(1950\) before it starts/)
    expect(run(data({ people: [person({ joinedParty: '1975' })] }))[0]).toMatch(/after death/)
  })

  it('reads a partial date as neither before nor after a fuller one in the same span', () => {
    expect(run(data({ people: [person({ died: '1970', fate: [{ date: '1970-11', s: 'dead' }] })] }))).toEqual([])
  })

  it('refuses death details without a death date', () => {
    expect(run(data({ people: [person({ died: undefined, deathKind: 'suicide' })] }))).toEqual(['person p: death details without a death date'])
  })

  it('needs a source or a verify mark on life sections, events and orgs', () => {
    expect(run(data({ people: [person({ life: [{ h: '早年', text: '' }] })] }))).toEqual(['person p life "早年": no cites and not marked verify'])
    expect(run(data({ events: [event({ cites: [] })] }))).toEqual(['event e: no cites and not marked verify'])
    expect(run(data({ orgs: [org({ verify: undefined })] }))).toEqual(['org o: no cites and not marked verify'])
  })

  it('pairs verify with why on events', () => {
    expect(run(data({ events: [event({ verify: true })] }))).toEqual(['event e: marked verify without saying why'])
    expect(run(data({ events: [event({ why: '缺原文' })] }))).toEqual(['event e: has a why but is not marked verify'])
  })

  it('keeps leaders inside the life of their org', () => {
    const o = org({ from: '1966-05', leaders: [{ name: '某乙', title: '组长', from: '1965' }] })
    expect(run(data({ orgs: [o] }))).toEqual(['org o leader 某乙: starts 1965 before the org (1966-05)'])
  })

  it('treats two first-published values for one year as an unmarked revision', () => {
    const pt = (value: number) => ({ year: 1958, value, kind: 'reported', cite: 's', quote: '文化大革命' })
    const s = SeriesSchema.parse({ id: 'grain', title: '粮食', unit: '万吨', group: 'agri', points: [pt(1), pt(2)] })
    expect(run(data({ series: [s] }))).toEqual(['series grain: two reported values for 1958'])
  })
})

describe('quote check', () => {
  const claim = (quote: string, cite = 's') => ClaimSchema.parse({ id: 'C900', statement: '', status: 'supported', method: '', logged: '2026', evidence: [{ cite, quote }] })

  it('accepts a verbatim quote and rejects one the source does not contain', () => {
    expect(run(data({ claims: [claim('触及人们灵魂')] }))).toEqual([])
    expect(run(data({ claims: [claim('触及人们思想')] }))).toEqual([expect.stringContaining('quote not found in s')])
  })

  it('refuses a quote against a source with no text', () => {
    const bare = SourceSchema.parse({ id: 'bare', title: '书目', date: '1990', kind: 'monograph', tier: 4 })
    const d = data({ claims: [claim('任何话', 'bare')] })
    d.sourceById.set('bare', bare)
    expect(run(d)).toEqual(['claim C900: source bare has no text to check quote against'])
  })

  it('checks a voice only when it is marked as a quote, and then needs a cite', () => {
    expect(run(data({ events: [event({ voices: [{ voice: 'editor', text: '本站的概括' }] })] }))).toEqual([])
    expect(run(data({ events: [event({ voices: [{ voice: 'doc', text: '原话', quote: true }] })] }))).toEqual(['event e voice doc is marked as a quote but has no cite'])
  })

  it('checks quotes of four characters or more in essay prose against the section sources', () => {
    const essay = (text: string) => EssaySchema.parse({ id: 'x', title: '', period: '1966', summary: '', written: '2026', sections: [{ h: '一', text, cites: ['s'] }] })
    expect(run(data({ essays: [essay('文件说“触及人们灵魂”，又说“大革”。')] }))).toEqual([])
    expect(run(data({ essays: [essay('文件说“触及人们肉体”。')] }))).toEqual([expect.stringContaining('quote not found in the section\'s sources')])
  })
})
