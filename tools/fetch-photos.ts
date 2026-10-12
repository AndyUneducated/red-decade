// Finds a portrait for each person through Wikidata (P18) and keeps it only if Commons states a free
// licence. A Wikidata item counts as the person only when its birth year (P569) equals `born`, so
// namesakes (王力 the linguist, 陆平 the actor) are skipped rather than guessed.
// Writes public/photos/<id>.jpg (Commons thumbnail, 480px wide) and content/photos.yaml.
// Entries already in photos.yaml are kept; `skip: true` there blocks a person for good, and
// `pick: <Commons file name>` uses that file instead of searching (for photos not linked from Wikidata).
//   node tools/fetch-photos.ts [person-id ...]
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, stringify } from 'yaml'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const UA = 'red-decade/0.1 (https://github.com/andyuneducated/red-decade; research site)'
const FREE = /^(public domain|pd\b|pd-|cc0|cc[ -]by(-sa)?[ -]\d)/i
const WIDTH = 480

type Rec = {
  qid?: string
  file?: string
  url?: string
  author?: string
  license?: string
  licenseUrl?: string
  date?: string
  focus?: string
  zoom?: number
  skip?: boolean
  noCategory?: boolean
  pick?: string
  via?: string
  why?: string
}

type Person = { id: string; name: string; born?: string | number }
const peopleDir = join(ROOT, 'content', 'people')
const people: Person[] = [
  ...(parse(readFileSync(join(ROOT, 'content', 'people.yaml'), 'utf8')) as Person[]),
  ...readdirSync(peopleDir)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .flatMap((f) => parse(readFileSync(join(peopleDir, f), 'utf8')) as Person[]),
]
const regPath = join(ROOT, 'content', 'photos.yaml')
const reg: Record<string, Rec> = existsSync(regPath) ? (parse(readFileSync(regPath, 'utf8')) ?? {}) : {}
const only = process.argv.slice(2)
const outDir = join(ROOT, 'public', 'photos')
mkdirSync(outDir, { recursive: true })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function api(host: string, params: Record<string, string>) {
  const u = new URL(`https://${host}/w/api.php`)
  for (const [k, v] of Object.entries({ format: 'json', ...params })) u.searchParams.set(k, v)
  for (let i = 0; i < 3; i++) {
    const r = await fetch(u, { headers: { 'User-Agent': UA } })
    if (r.ok) return r.json()
    await sleep(1500 * (i + 1))
  }
  throw new Error(`${host} ${params.action} failed`)
}
const strip = (html?: string) =>
  html
    ?.replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

async function findItem(name: string, born: string) {
  const s = await api('www.wikidata.org', { action: 'wbsearchentities', search: name, language: 'zh', uselang: 'zh', type: 'item', limit: '40' })
  const ids: string[] = (s.search ?? []).map((x: { id: string }) => x.id)
  if (!ids.length) return undefined
  // wbgetentities takes at most 50 ids
  const e = await api('www.wikidata.org', { action: 'wbgetentities', ids: ids.slice(0, 50).join('|'), props: 'claims' })
  for (const id of ids) {
    const c = e.entities[id]?.claims ?? {}
    const human = (c.P31 ?? []).some((x: any) => x.mainsnak.datavalue?.value?.id === 'Q5')
    const year = (c.P569 ?? []).map((x: any) => x.mainsnak.datavalue?.value?.time?.slice(1, 5))
    if (human && year.includes(born.slice(0, 4)))
      return {
        qid: id,
        image: c.P18?.[0]?.mainsnak.datavalue?.value as string | undefined,
        category: c.P373?.[0]?.mainsnak.datavalue?.value as string | undefined,
      }
  }
  return undefined
}

// Fallback when P18 is empty: a free photo from the person's Commons category (P373). Category
// pages also hold graves, houses, statues and calligraphy, so those file names are excluded and
// every pick is marked `via: category` for a visual check.
const NOT_PORTRAIT = /grave|tomb|墓|故居|residence|house|statue|雕像|塑像|bust|memorial|纪念|calligraph|书法|題字|题字|signature|签名|stamp|邮票|郵票|map|地图|book|cover|封面|manuscript|手稿|letter|信|museum|博物|plaque|碑|monument|exhibit|展|coin|banknote|\.svg$|\.pdf$|\.tif/i
async function fromCategory(category: string) {
  const m = await api('commons.wikimedia.org', { action: 'query', list: 'categorymembers', cmtitle: `Category:${category}`, cmtype: 'file', cmlimit: '50' })
  const titles: string[] = (m.query?.categorymembers ?? []).map((x: { title: string }) => x.title).filter((t: string) => /\.(jpe?g|png)$/i.test(t) && !NOT_PORTRAIT.test(t))
  if (!titles.length) return undefined
  const q = await api('commons.wikimedia.org', { action: 'query', titles: titles.slice(0, 50).join('|'), prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: String(WIDTH) })
  const pages = Object.values(q.query.pages) as any[]
  pages.sort((a, b) => titles.indexOf(a.title) - titles.indexOf(b.title))
  for (const pg of pages) {
    const info = pg.imageinfo?.[0]
    const license = strip(info?.extmetadata?.LicenseShortName?.value) ?? ''
    if (info && FREE.test(license)) return { file: (pg.title as string).replace(/^File:/, ''), info, license }
  }
  return undefined
}

const report: string[] = []
for (const p of people) {
  if (only.length && !only.includes(p.id)) continue
  const have = reg[p.id]
  if (have?.skip || (have?.file && existsSync(join(outDir, `${p.id}.jpg`)))) continue
  if (!p.born && !have?.pick) {
    report.push(`${p.id}: no birth date, cannot match`)
    continue
  }
  try {
    const item = have?.pick ? { qid: have.qid, image: have.pick, category: undefined } : await findItem(p.name, String(p.born))
    await sleep(250)
    if (!item) {
      reg[p.id] = { ...have, why: 'no Wikidata item with matching birth year' }
      report.push(`${p.id} ${p.name}: no matching item`)
      continue
    }
    let file = item.image
    let info: any
    let license = ''
    let via: string | undefined = have?.pick ? 'pick' : undefined
    if (file) {
      const q = await api('commons.wikimedia.org', { action: 'query', titles: `File:${file}`, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: String(WIDTH) })
      info = (Object.values(q.query.pages)[0] as any).imageinfo?.[0]
      license = strip(info?.extmetadata?.LicenseShortName?.value) ?? ''
    }
    if ((!info || !FREE.test(license)) && item.category && !have?.noCategory) {
      const c = await fromCategory(item.category)
      if (c) {
        file = c.file
        info = c.info
        license = c.license
        via = 'category'
      }
    }
    if (!file) {
      reg[p.id] = { ...have, qid: item.qid, why: item.category ? 'no P18 and no free photo in the Commons category' : 'Wikidata item has no image (P18)' }
      report.push(`${p.id} ${p.name}: ${item.qid} has no image${item.category ? ' (category checked)' : ''}`)
      continue
    }
    const meta = info?.extmetadata ?? {}
    if (!info || !FREE.test(license)) {
      reg[p.id] = { ...have, qid: item.qid, file, license, why: 'licence not on the allow-list' }
      report.push(`${p.id} ${p.name}: ${file} licence "${license}" rejected`)
      continue
    }
    const img = await fetch(info.thumburl, { headers: { 'User-Agent': UA } })
    if (!img.ok) throw new Error(`download ${img.status}`)
    writeFileSync(join(outDir, `${p.id}.jpg`), Buffer.from(await img.arrayBuffer()))
    reg[p.id] = {
      qid: item.qid,
      ...(have?.pick ? { pick: have.pick } : {}),
      file,
      ...(via ? { via } : {}),
      url: info.descriptionurl,
      author: strip(meta.Artist?.value)?.slice(0, 160),
      license,
      licenseUrl: meta.LicenseUrl?.value,
      date: strip(meta.DateTimeOriginal?.value)
        ?.replace(/date QS:\S+/g, '')
        .trim()
        .slice(0, 40),
      ...(have?.focus ? { focus: have.focus } : {}),
      ...(have?.zoom ? { zoom: have.zoom } : {}),
    }
    report.push(`${p.id} ${p.name}: ✔ ${file} (${license})${via ? ` via ${via}` : ''}`)
    await sleep(400)
  } catch (err) {
    report.push(`${p.id} ${p.name}: error ${(err as Error).message}`)
  }
}

const sorted = Object.fromEntries(Object.entries(reg).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync(
  regPath,
  '# Portraits: written by tools/fetch-photos.ts from Wikidata P18 + Commons metadata; edit `focus`\n' +
    '# (CSS object-position, e.g. "50% 20%") or set `skip: true` by hand. `why` explains a missing photo.\n' +
    stringify(sorted, { lineWidth: 0 }),
)
writeFileSync(join(ROOT, '.probe', 'photos-report.txt'), report.join('\n'))
console.log(`${report.filter((r) => r.includes('✔')).length} fetched, ${report.length} processed — see .probe/photos-report.txt`)
