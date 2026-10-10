// Fetches primary texts listed in research/manifests/*.yaml from zh.wikisource,
// pins each to a revision id, and writes:
//   sources/raw/<id>.wiki      verbatim wikitext at that revision
//   sources/text/<id>.txt      plain text derived from the wikitext
//   research/fetch-log.jsonl   one line per fetch (append-only)
// Usage: node tools/fetch-wikisource.ts [--force] [id ...]
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { wikiToText } from './lib/wikitext.ts'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const API = 'https://zh.wikisource.org/w/api.php'
const UA = 'red-decade-research/0.1 (github.com/AndyUneducated/red-decade)'

type Entry = { id: string; title: string; variant?: string }

const args = process.argv.slice(2)
const force = args.includes('--force')
const only = new Set(args.filter((a) => !a.startsWith('--')))

const manifestDir = join(ROOT, 'research', 'manifests')
const entries: Entry[] = readdirSync(manifestDir)
  .filter((f) => f.endsWith('.yaml'))
  .flatMap((f) => (parse(readFileSync(join(manifestDir, f), 'utf8')) as { wikisource?: Entry[] }).wikisource ?? [])

for (const dir of ['sources/raw', 'sources/text']) mkdirSync(join(ROOT, dir), { recursive: true })

let fetched = 0
for (const entry of entries) {
  if (only.size && !only.has(entry.id)) continue
  const rawPath = join(ROOT, 'sources', 'raw', `${entry.id}.wiki`)
  if (existsSync(rawPath) && !force) continue

  const url =
    `${API}?action=query&prop=revisions&rvprop=ids|timestamp|content&rvslots=main&format=json&formatversion=2` +
    `&redirects=1&titles=${encodeURIComponent(entry.title)}` +
    (entry.variant ? `&variant=${entry.variant}` : '')
  const json = (await getJson(url)) as {
    query: { pages: { title: string; missing?: boolean; revisions?: { revid: number; timestamp: string; slots: { main: { content: string } } }[] }[] }
  }
  const page = json.query.pages[0]
  if (page.missing || !page.revisions) {
    console.error(`MISSING  ${entry.id}  ${entry.title}`)
    appendLog({ id: entry.id, title: entry.title, status: 'missing', at: new Date().toISOString() })
    continue
  }
  const rev = page.revisions[0]
  const wikitext = rev.slots.main.content
  const text = wikiToText(wikitext)
  writeFileSync(rawPath, wikitext)
  writeFileSync(join(ROOT, 'sources', 'text', `${entry.id}.txt`), text)
  const license = [...wikitext.matchAll(/\{\{\s*(PD-[^|}]+|Public domain[^|}]*)/gi)].map((m) => m[1].trim())
  appendLog({
    id: entry.id,
    title: page.title,
    status: 'ok',
    at: new Date().toISOString(),
    url: `https://zh.wikisource.org/w/index.php?oldid=${rev.revid}`,
    revid: rev.revid,
    revTimestamp: rev.timestamp,
    sha256: createHash('sha256').update(wikitext).digest('hex'),
    chars: text.length,
    license,
  })
  console.log(`OK  ${entry.id.padEnd(28)} rev ${rev.revid}  ${text.length} chars  ${page.title}`)
  fetched++
  await sleep(1500)
}
console.log(`\n${fetched} fetched`)

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function getJson(url: string): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    const body = await res.text()
    try {
      return JSON.parse(body)
    } catch {
      if (attempt >= 5) throw new Error(`non-JSON response after retries: ${body.slice(0, 80)}`)
      const wait = 5000 * 2 ** attempt
      console.error(`rate-limited, retrying in ${wait / 1000}s`)
      await sleep(wait)
    }
  }
}

function appendLog(record: object) {
  appendFileSync(join(ROOT, 'research', 'fetch-log.jsonl'), JSON.stringify(record) + '\n')
}
