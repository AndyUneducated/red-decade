// Chronological concordance over sources/text: for each term, list every source
// (ordered by date) that contains it, with hit count and the first context window.
// Usage: node tools/concordance.ts [--json] <term> [<term> ...]
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

type Meta = { id: string; title: string; date: string | number; author?: string }
const metas = new Map<string, Meta>()
for (const f of readdirSync(join(ROOT, 'research', 'manifests')).filter((f) => f.endsWith('.yaml'))) {
  const doc = parse(readFileSync(join(ROOT, 'research', 'manifests', f), 'utf8')) as { wikisource?: Meta[] }
  for (const m of doc.wikisource ?? []) metas.set(m.id, m)
}

const texts = readdirSync(join(ROOT, 'sources', 'text'))
  .filter((f) => f.endsWith('.txt'))
  .map((f) => {
    const id = f.replace(/\.txt$/, '')
    return { id, meta: metas.get(id), body: readFileSync(join(ROOT, 'sources', 'text', f), 'utf8') }
  })
  .filter((t) => t.meta && t.meta.date !== 1966 && !t.id.endsWith('-index'))
  .sort((a, b) => String(a.meta!.date).localeCompare(String(b.meta!.date)))

export type Hit = { term: string; source: string; date: string; count: number; context: string }

export function concordance(term: string, width = 40): Hit[] {
  const hits: Hit[] = []
  for (const t of texts) {
    const count = t.body.split(term).length - 1
    if (!count) continue
    const i = t.body.indexOf(term)
    const context = t.body.slice(Math.max(0, i - width), i + term.length + width).replace(/\s+/g, ' ')
    hits.push({ term, source: t.id, date: String(t.meta!.date), count, context })
  }
  return hits
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const terms = args.filter((a) => !a.startsWith('--'))
  const all = terms.map((term) => ({ term, hits: concordance(term) }))
  if (json) console.log(JSON.stringify(all, null, 2))
  else
    for (const { term, hits } of all) {
      console.log(`\n## ${term}  (${hits.length} sources, ${hits.reduce((s, h) => s + h.count, 0)} hits)`)
      for (const h of hits) console.log(`  ${h.date.padEnd(10)} ${h.source.padEnd(34)} ×${h.count}  …${h.context}…`)
    }
}
