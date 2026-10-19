// Checks the source files in the repository against research/fetch-log.jsonl, offline: for each source in
// research/manifests with a text file, the last successful fetch gives the SHA-256 of the raw page as
// downloaded, which must equal the SHA-256 of sources/raw/<id>.wiki, .html or .pdf. Excerpt sources keep no raw page.
// git normalises line endings (.gitattributes), so a page fetched with CRLF is also hashed with CRLF restored.
//   node tools/verify-sources.ts
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
type Fetch = { id: string; status: string; sha256?: string; excerpt?: boolean }

const listed = new Set<string>()
for (const f of readdirSync(join(ROOT, 'research', 'manifests')).filter((f) => f.endsWith('.yaml'))) {
  const m = parse(readFileSync(join(ROOT, 'research', 'manifests', f), 'utf8')) as { wikisource?: { id: string }[]; web?: { id: string }[] }
  for (const s of [...(m.wikisource ?? []), ...(m.web ?? [])]) listed.add(s.id)
}
const last = new Map<string, Fetch>()
for (const line of readFileSync(join(ROOT, 'research', 'fetch-log.jsonl'), 'utf8').split('\n')) {
  if (!line.trim()) continue
  const f = JSON.parse(line) as Fetch
  if (f.status === 'ok' && listed.has(f.id) && existsSync(join(ROOT, 'sources', 'text', `${f.id}.txt`))) last.set(f.id, f)
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
let ok = 0
const bad: string[] = []
for (const f of last.values()) {
  const raw = ['wiki', 'html', 'pdf'].map((x) => join(ROOT, 'sources', 'raw', `${f.id}.${x}`)).find(existsSync)
  if (f.excerpt) ok++
  else if (!raw) bad.push(`${f.id}: no raw file`)
  else if (raw.endsWith('.pdf')) {
    if (f.sha256 === createHash('sha256').update(readFileSync(raw)).digest('hex')) ok++
    else bad.push(`${f.id}: raw file differs from the fetch on record`)
  } else {
    const body = readFileSync(raw, 'utf8')
    if (f.sha256 === sha(body) || f.sha256 === sha(body.replaceAll('\n', '\r\n'))) ok++
    else bad.push(`${f.id}: raw file differs from the fetch on record`)
  }
}
console.log(`${ok}/${last.size} sources match the fetch log`)
const unlogged = readdirSync(join(ROOT, 'sources', 'text'))
  .map((f) => f.replace(/\.txt$/, ''))
  .filter((id) => !last.has(id))
if (unlogged.length) console.log(`text files without a fetch on record (written by hand or not in a manifest): ${unlogged.join(' ')}`)
if (bad.length) {
  console.log(bad.map((b) => `  ✗ ${b}`).join('\n'))
  process.exit(1)
}
