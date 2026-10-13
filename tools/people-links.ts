// Lists events that name a person in their title, summary or voices without listing the person in `people`,
// so the links can be added by hand. People with no event and no relation (no personal view) come first.
// Usage: node tools/people-links.ts   (report in .probe/people-links.txt)
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadAll } from './build/load.ts'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const data = loadAll()

const linked = new Set<string>()
for (const e of data.events) for (const p of e.people ?? []) linked.add(p)
for (const r of data.relations) linked.add(r.a), linked.add(r.b)

const rows: { id: string; name: string; alone: boolean; hits: string[] }[] = []
for (const p of data.people) {
  const names = [p.name, ...(p.aka ?? []).map((a) => a.name)].filter((n) => n.length >= 2)
  const hits = data.events
    .filter((e) => !(e.people ?? []).includes(p.id))
    .filter((e) => {
      const t = [e.title, e.summary, ...(e.voices ?? []).map((v) => v.text)].join(' ')
      return names.some((n) => t.includes(n))
    })
    .map((e) => e.id)
  if (hits.length || !linked.has(p.id)) rows.push({ id: p.id, name: p.name, alone: !linked.has(p.id), hits })
}
rows.sort((a, b) => Number(b.alone) - Number(a.alone) || b.hits.length - a.hits.length)

const alone = rows.filter((r) => r.alone)
const lines = [
  `people ${data.people.length}; without event or relation ${alone.length}; of those with a named event ${alone.filter((r) => r.hits.length).length}`,
  '',
  ...rows.map((r) => `${r.alone ? '*' : ' '} ${r.id} ${r.name}: ${r.hits.join(' ')}`),
  '',
  '# without event or relation',
  ...alone.flatMap((r) => {
    const p = data.people.find((x) => x.id === r.id)!
    return [`${p.id} ${p.born ?? ''}–${p.died ?? ''} [${p.cites.join(' ')}]`, `  ${p.bio ?? ''}`]
  }),
]
mkdirSync(join(ROOT, '.probe'), { recursive: true })
writeFileSync(join(ROOT, '.probe', 'people-links.txt'), lines.join('\n') + '\n')
console.log(lines[0])
