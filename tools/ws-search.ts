// Full-text search on zh.wikisource to locate exact page titles.
// Usage: node tools/ws-search.ts <query> [<query> ...]
const API = 'https://zh.wikisource.org/w/api.php'

type Hits = { query: { search: { title: string; size: number; snippet: string }[] } }

async function search(q: string) {
  const url = `${API}?action=query&list=search&format=json&srlimit=12&srsearch=${encodeURIComponent(q)}`
  let json: Hits | undefined
  for (let attempt = 0; !json; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'red-decade-research/0.1 (github.com/AndyUneducated/red-decade)' } })
    const body = await res.text()
    if (body.startsWith('{')) json = JSON.parse(body) as Hits
    else if (attempt >= 3) throw new Error(`${q}: ${body.slice(0, 80)}`)
    else await new Promise((r) => setTimeout(r, 30000 * (attempt + 1)))
  }
  console.log(`\n## ${q}`)
  for (const hit of json.query.search) {
    const snippet = hit.snippet.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').slice(0, 70)
    console.log(`- ${hit.title}  [${hit.size}B]  ${snippet}`)
  }
}

// the API answers "too many requests" after about five back-to-back queries
for (const q of process.argv.slice(2)) {
  await search(q)
  await new Promise((r) => setTimeout(r, 4000))
}
