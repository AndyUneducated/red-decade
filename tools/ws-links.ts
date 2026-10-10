// List the pages linked from a Wikisource page (e.g. a periodical index) and whether each exists.
// Usage: node tools/ws-links.ts <page title> [filter substring]
const API = 'https://zh.wikisource.org/w/api.php'
const UA = { 'User-Agent': 'red-decade-research/0.1 (github.com/AndyUneducated/red-decade)' }

const [title, filter] = process.argv.slice(2)
if (!title) {
  console.error('usage: node tools/ws-links.ts <page title> [filter]')
  process.exit(1)
}

type Page = { title: string; missing?: string; length?: number }
const pages: Page[] = []
let cont: Record<string, string> = {}
do {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    titles: title,
    generator: 'links',
    gpllimit: '500',
    gplnamespace: '0',
    prop: 'info',
    ...cont,
  })
  const json = (await (await fetch(`${API}?${params}`, { headers: UA })).json()) as {
    query?: { pages: Record<string, Page> }
    continue?: Record<string, string>
  }
  pages.push(...Object.values(json.query?.pages ?? {}))
  cont = json.continue ?? {}
} while (Object.keys(cont).length)

const shown = pages.filter((p) => !filter || p.title.includes(filter)).sort((a, b) => a.title.localeCompare(b.title, 'zh'))
for (const p of shown) console.log(`${'missing' in p ? '✘' : '✔'} ${p.title}${p.length ? `  [${p.length}B]` : ''}`)
console.log(`\n${shown.filter((p) => !('missing' in p)).length} exist / ${shown.length} linked`)
