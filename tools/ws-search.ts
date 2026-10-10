// Full-text search on zh.wikisource to locate exact page titles.
// Usage: node tools/ws-search.ts <query> [<query> ...]
const API = 'https://zh.wikisource.org/w/api.php'

async function search(q: string) {
  const url = `${API}?action=query&list=search&format=json&srlimit=12&srsearch=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { 'User-Agent': 'red-decade-research/0.1 (github.com/AndyUneducated/red-decade)' } })
  const json = (await res.json()) as { query: { search: { title: string; size: number; snippet: string }[] } }
  console.log(`\n## ${q}`)
  for (const hit of json.query.search) {
    const snippet = hit.snippet.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').slice(0, 70)
    console.log(`- ${hit.title}  [${hit.size}B]  ${snippet}`)
  }
}

for (const q of process.argv.slice(2)) await search(q)
