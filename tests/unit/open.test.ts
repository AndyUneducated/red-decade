import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fieldsMarkdown, OPEN_TABLES } from '../../src/data/open'
import type { Atlas } from '../../src/data/schema'
import { isPage } from '../../src/pages'

describe('open-data tables', () => {
  it('have unique ids and link to real pages', () => {
    expect(new Set(OPEN_TABLES.map((t) => t.id)).size).toBe(OPEN_TABLES.length)
    for (const t of OPEN_TABLES) {
      expect(!!t.key !== !!t.parent, `${t.id}: either stable ids or a parent`).toBe(true)
      if (t.link) expect(isPage(t.link.slice(2).split(/[/?]/)[0]), t.link).toBe(true)
    }
  })
  it('match the committed docs/fields.md', () => {
    const doc = readFileSync(new URL('../../docs/fields.md', import.meta.url), 'utf8').replaceAll('\r\n', '\n')
    expect(doc).toBe(fieldsMarkdown())
  })
})

// every field a record carries is documented, either as a CSV column or as a nested JSON field
const ATLAS = new URL('../../public/data/atlas.json', import.meta.url)
describe.skipIf(!existsSync(ATLAS))('open data on the built atlas', () => {
  const atlas = JSON.parse(readFileSync(ATLAS, 'utf8')) as Atlas
  for (const t of OPEN_TABLES)
    it(`documents every field of ${t.id}`, () => {
      const known = new Set([...t.cols.filter((c) => !c.get).map((c) => c.key), ...Object.keys(t.nested ?? {})])
      const seen = new Set(t.rows(atlas).flatMap((r) => Object.keys(r)))
      expect([...seen].filter((k) => !known.has(k))).toEqual([])
    })
  it('registers every stable id', () => {
    const register = new Set(readFileSync(new URL('../../research/ids.txt', import.meta.url), 'utf8').split(/\r?\n/))
    for (const t of OPEN_TABLES) if (t.key) for (const r of t.rows(atlas)) expect(register.has(`${t.id}/${t.key(r)}`)).toBe(true)
  })
})
