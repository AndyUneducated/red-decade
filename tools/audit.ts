// Depth audit (milestones.md part 3): per period, how far the events, claims and sources meet the standard.
// Reads public/data/atlas.json, so run `node tools/build-data.ts` first. --gaps lists the events that fall short.
//   node tools/audit.ts [--gaps]
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Atlas, Event, Person } from '../src/data/schema.ts'

const atlas = JSON.parse(readFileSync(fileURLToPath(new URL('../public/data/atlas.json', import.meta.url)), 'utf8')) as Atlas
const gaps = process.argv.includes('--gaps')

const PERIODS = [
  { name: '1949–1965', from: 1949, to: 1965, events: 200 },
  { name: '1966', from: 1966, to: 1966, events: 0 },
  { name: '1967–1969', from: 1967, to: 1969, events: 150 },
  { name: '1970–1976', from: 1970, to: 1976, events: 150 },
  { name: '1977–1989', from: 1977, to: 1989, events: 150 },
]
const year = (d: string) => Number(d.slice(0, 4))
const source = new Map(atlas.sources.map((s) => [s.id, s]))
const event = new Map(atlas.events.map((e) => [e.id, e]))
const ids = (cites: string[]) => cites.map((c) => c.split('@')[0])
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : '—')

const primary = (e: Event) => ids([...e.cites, ...e.voices.flatMap((v) => (v.cite ? [v.cite] : []))]).some((id) => source.get(id)?.tier === 1)
const voices = (e: Event) => new Set(e.voices.map((v) => v.voice)).size

const lines = ['| 时期 | 事件 | 目标 | 有一手出处 | 待核 | ≥2 声部 | 研究结论 | 来源（有全文） |', '|---|---|---|---|---|---|---|---|']
const short: string[] = []
for (const p of PERIODS) {
  const inP = (d: string) => year(d) >= p.from && year(d) <= p.to
  const evs = atlas.events.filter((e) => inP(e.date))
  // a claim belongs to the period of its earliest event
  const claims = atlas.claims.filter((c) => {
    const first = c.events.flatMap((id) => (event.has(id) ? [event.get(id)!.date] : [])).sort()[0]
    return first && inP(first)
  })
  const srcs = atlas.sources.filter((s) => inP(s.date))
  lines.push(
    `| ${p.name} | ${evs.length} | ${p.events ? `≥ ${p.events}` : '全部有一手出处'} | ${pct(evs.filter(primary).length, evs.length)} | ${evs.filter((e) => e.verify).length} | ${pct(evs.filter((e) => voices(e) >= 2).length, evs.length)} | ${claims.length} | ${srcs.length}（${srcs.filter((s) => s.hasText).length}） |`,
  )
  for (const e of evs) if (!primary(e) || e.verify) short.push(`${p.name}  ${e.id}  ${!primary(e) ? '无一手出处 ' : ''}${e.verify ? '待核' : ''}`)
}
console.log(lines.join('\n'))

const people = atlas.people
const fullLife = (p: Person) => p.life.length >= 3
const spans = (p: Person) => p.fate.length >= 2 && (!p.died || p.fate.some((f) => f.s === 'dead'))
const tiers = [1, 2, 3].map((t) => {
  const ps = people.filter((p) => p.tier === t)
  return `${t} 级 ${ps.length} 人 ${ps.reduce((n, p) => n + p.fate.filter((f) => f.verify).length, 0)} 个`
})
console.log()
console.log(`人物 ${people.length}：传记 ≥ 3 段 ${people.filter(fullLife).length}，命运轨迹到去世（在世者不计） ${people.filter(spans).length}，平均命运节点 ${(people.reduce((n, p) => n + p.fate.length, 0) / people.length).toFixed(1)}`)
console.log(`待核命运节点 ${people.reduce((n, p) => n + p.fate.filter((f) => f.verify).length, 0)}（${tiers.join('，')}）`)
console.log(`研究结论 ${atlas.claims.length}（${Object.entries(Object.groupBy(atlas.claims, (c) => c.status)).map(([k, v]) => `${k} ${v!.length}`).join('，')}），专题长文 ${atlas.essays.length}`)
console.log(`来源 ${atlas.sources.length}：一手 ${atlas.sources.filter((s) => s.tier === 1).length}，有全文 ${atlas.sources.filter((s) => s.hasText).length}`)
if (gaps) console.log(`\n${short.join('\n')}`)
