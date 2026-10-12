// Fetches primary texts listed under `web:` in research/manifests/*.yaml from sites other
// than Wikisource (People's Daily archive, Wilson Center Digital Archive, Wayback snapshots).
//   sources/raw/<id>.html      verbatim page (not kept for excerpt sources)
//   sources/text/<id>.txt      extracted text
//   research/fetch-log.jsonl   one line per fetch (append-only), sha256 of the raw page
// Extraction: `article` picks a People's Daily article by heading; otherwise `start`/`end`
// mark the first and last characters of the wanted text (inclusive).
// `excerpt: true` + `keep: [...]` keeps only paragraphs containing one of the `keep` strings.
// Usage:
//   node tools/fetch-web.ts [--force] [id ...]
//   node tools/fetch-web.ts --list <url> ...    People's Daily headings -> .probe/rmrb-list.txt
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const UA = 'Mozilla/5.0 (red-decade-research; github.com/AndyUneducated/red-decade)'

type Entry = { id: string; title: string; url: string; article?: string; start?: string; end?: string; excerpt?: boolean; keep?: string[]; unwrap?: boolean }

const args = process.argv.slice(2)
if (args[0] === '--list') {
  const lines: string[] = []
  for (const url of args.slice(1)) {
    lines.push(`== ${url}`)
    for (const a of rmrbArticles(await get(url))) lines.push(`${a.heading}  (${a.text.length} 字)`)
  }
  writeFileSync(join(ROOT, '.probe', 'rmrb-list.txt'), lines.join('\n') + '\n')
  console.log(`${lines.length} lines -> .probe/rmrb-list.txt`)
  process.exit(0)
}
const force = args.includes('--force')
// --peek writes the full extracted text to .probe/peek-<id>.txt only, to choose `keep` paragraphs
const peek = args.includes('--peek')
const only = new Set(args.filter((a) => !a.startsWith('--')))

const manifestDir = join(ROOT, 'research', 'manifests')
const entries: Entry[] = readdirSync(manifestDir)
  .filter((f) => f.endsWith('.yaml'))
  .flatMap((f) => (parse(readFileSync(join(manifestDir, f), 'utf8')) as { web?: Entry[] }).web ?? [])

for (const dir of ['sources/raw', 'sources/text']) mkdirSync(join(ROOT, dir), { recursive: true })

let fetched = 0
for (const e of entries) {
  if (only.size && !only.has(e.id)) continue
  const textPath = join(ROOT, 'sources', 'text', `${e.id}.txt`)
  if (existsSync(textPath) && !force && !peek) continue
  const html = await get(e.url)
  let text: string
  if (e.article) {
    const articles = rmrbArticles(html)
    // headings with a subtitle join the two with runs of spaces, so a unique prefix is accepted too
    const a = articles.find((x) => x.heading === e.article) ?? articles.find((x) => x.heading.startsWith(e.article!))
    if (!a) {
      console.error(`NO ARTICLE  ${e.id}  "${e.article}" on ${e.url}`)
      for (const x of articles) console.error(`    ${JSON.stringify(x.heading)}`)
      continue
    }
    const heading = a.heading.replace(/\s{2,}/g, '\n')
    const body = a.text
      .split('\n')
      .filter((l) => !/^第\d+版\(.*\)$/.test(l) && l !== '专栏：')
      .join('\n')
      .replace(/^\n+/, '')
    text = body.startsWith(heading.split('\n')[0]) ? body : `${heading}\n\n${body}`
  } else {
    const all = htmlToText(html)
    const i = e.start ? all.indexOf(e.start) : 0
    const j = e.end ? all.indexOf(e.end, Math.max(0, i)) : -1
    if (i < 0 || (e.end && j < 0)) {
      console.error(`MARKERS NOT FOUND  ${e.id}  start=${i} end=${j}`)
      continue
    }
    text = all.slice(i, e.end ? j + e.end.length : undefined).trim()
  }
  // one paragraph per line in the source pages; the reader splits paragraphs on blank lines
  let paras = text.split(/\n+/).map((p) => p.trim()).filter(Boolean)
  // `unwrap`: pages exported from Word break every visual line into its own paragraph; a line
  // that does not end a sentence continues into the next one
  if (e.unwrap)
    paras = paras.reduce<string[]>((out, p) => {
      if (out.length && !/[。！？：”）)]$/.test(out[out.length - 1])) out[out.length - 1] += p
      else out.push(p)
      return out
    }, [])
  const fullChars = paras.join('').length
  if (peek) {
    mkdirSync(join(ROOT, '.probe'), { recursive: true })
    writeFileSync(join(ROOT, '.probe', `peek-${e.id}.txt`), paras.join('\n\n') + '\n')
    console.log(`PEEK  ${e.id.padEnd(32)} ${fullChars} chars`)
    await new Promise((r) => setTimeout(r, 1500))
    continue
  }
  if (e.excerpt) paras = paras.filter((p) => (e.keep ?? []).some((k) => p.includes(k)))
  else writeFileSync(join(ROOT, 'sources', 'raw', `${e.id}.html`), html)
  text = paras.join('\n\n')
  writeFileSync(textPath, text + '\n')
  appendFileSync(
    join(ROOT, 'research', 'fetch-log.jsonl'),
    JSON.stringify({
      id: e.id,
      title: e.title,
      status: 'ok',
      at: new Date().toISOString(),
      url: e.url,
      sha256: createHash('sha256').update(html).digest('hex'),
      chars: text.length,
      ...(e.excerpt ? { excerpt: true, fullChars } : {}),
    }) + '\n',
  )
  console.log(`OK  ${e.id.padEnd(32)} ${text.length}${e.excerpt ? `/${fullChars}` : ''} chars`)
  fetched++
  await new Promise((r) => setTimeout(r, 1500))
}
console.log(`\n${fetched} fetched`)

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  // some older Chinese sites are GBK; Wayback snapshots keep the original bytes but send a utf-8
  // header, so the page's own <meta charset> wins over the HTTP header
  const buf = new Uint8Array(await res.arrayBuffer())
  const head = new TextDecoder('latin1').decode(buf.slice(0, 8192))
  const meta = head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1]
  const charset = (meta ?? res.headers.get('content-type')?.match(/charset=([\w-]+)/i)?.[1] ?? 'utf-8').toLowerCase()
  return new TextDecoder(charset === 'gb2312' ? 'gbk' : charset).decode(buf)
}

function decode(s: string): string {
  const named: Record<string, string> = {
    ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', mdash: '—', ndash: '–', hellip: '…', middot: '·', copy: '©',
  }
  return s
    .replace(/&(ldquo|rdquo|lsquo|rsquo|mdash|ndash|hellip|middot|copy);/g, (_, n: string) => named[n])
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
}

function htmlToText(html: string): string {
  return decode(
    html
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article)>/gi, '\n\n')
      .replace(/<[^>]+>/g, ''),
  )
    .split('\n')
    .map((l) => l.replace(/[ \t\u3000]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
}

function rmrbArticles(html: string) {
  const out: { heading: string; text: string }[] = []
  const re = /<article class="content-section"[^>]*>\s*<h2[^>]*>([\s\S]*?)<\/h2>\s*<div class="content-body"[^>]*>([\s\S]*?)<\/div>\s*<\/article>/g
  for (const m of html.matchAll(re)) out.push({ heading: decode(m[1].replace(/<[^>]+>/g, '')).trim(), text: htmlToText(m[2]).trim() })
  return out
}
