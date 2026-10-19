// Builds the visual archive (M8) from Wikimedia Commons: lists the files in the categories and searches
// named in research/manifests/archive.yaml, reads each file's metadata, keeps those dated 1949–1990,
// downloads a 320px thumbnail to public/archive/<id>.jpg and writes content/archive/commons.yaml.
// Entries already in commons.yaml keep their title and date; `kind` and `skip` are re-derived on every run by
// the rules in curate() unless the entry has `keep: true`.
//   node tools/fetch-archive.ts [--curate] [pull substring ...]
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, stringify } from 'yaml'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const UA = 'red-decade/0.1 (https://github.com/andyuneducated/red-decade; research site)'
const WIDTH = 320
const FROM = 1949
const TO = 1990

type Pull = { category?: string; search?: string; kind: string; depth?: number; limit?: number }
type Rec = {
  kind: string
  title: string
  date: string
  dateFrom: 'metadata' | 'title'
  file: string
  url: string
  author?: string
  license: string
  licenseUrl?: string
  description?: string
  via: string
  skip?: boolean
  why?: string
  keep?: boolean
}

const manifest = parse(readFileSync(join(ROOT, 'research', 'manifests', 'archive.yaml'), 'utf8')) as { commons: Pull[] }
const outDir = join(ROOT, 'public', 'archive')
const regDir = join(ROOT, 'content', 'archive')
const regPath = join(regDir, 'commons.yaml')
const skippedDir = join(ROOT, '.probe', 'archive-skipped')
mkdirSync(outDir, { recursive: true })
mkdirSync(skippedDir, { recursive: true })
mkdirSync(regDir, { recursive: true })
const reg: Record<string, Rec> = existsSync(regPath) ? (parse(readFileSync(regPath, 'utf8')) ?? {}) : {}
const known = new Set(Object.values(reg).map((r) => r.file))

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function api(params: Record<string, string>) {
  const u = new URL('https://commons.wikimedia.org/w/api.php')
  for (const [k, v] of Object.entries({ format: 'json', ...params })) u.searchParams.set(k, v)
  // Commons answers 429 after bursts; back off for longer each time
  for (let i = 0; i < 5; i++) {
    const r = await fetch(u, { headers: { 'User-Agent': UA } }).catch(() => undefined)
    if (r?.ok) return r.json()
    await sleep(5000 * (i + 1))
  }
  throw new Error(`commons ${params.action} failed`)
}
const strip = (html?: string) =>
  html
    ?.replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
const IMAGE = /\.(jpe?g|png|gif|tiff?)$/i

async function members(category: string, depth: number, seen = new Set<string>()): Promise<string[]> {
  if (seen.has(category)) return []
  seen.add(category)
  const files: string[] = []
  let cont: Record<string, string> = {}
  do {
    const m = await api({ action: 'query', list: 'categorymembers', cmtitle: `Category:${category}`, cmtype: 'file|subcat', cmlimit: '500', ...cont })
    for (const x of m.query?.categorymembers ?? []) {
      if (x.ns === 6) files.push(x.title)
      else if (x.ns === 14 && depth > 0) files.push(...(await members(x.title.replace(/^Category:/, ''), depth - 1, seen)))
    }
    cont = m.continue ?? {}
  } while (cont.cmcontinue)
  return files
}

async function search(q: string, limit: number) {
  const m = await api({ action: 'query', list: 'search', srsearch: q, srnamespace: '6', srlimit: String(Math.min(limit, 500)) })
  return (m.search ?? m.query?.search ?? []).map((x: { title: string }) => x.title)
}

// Searches and broad categories also return foreign stamps, Vietnam War photos and the like; these rules,
// re-applied to the whole register on every run, mark them `skip` with the reason. `keep: true` overrides.
const FOREIGN_STAMP = /^Stamp of (?!China)/i
const ABOUT_CHINA = /Mao Zedong|Tiananmen/i
const OFF_TOPIC =
  /Unstamp|airmail|USPS|U\.S\. stamp|us stamp|Stamps of Germany|Bhuten|Gershwin|Willa cather|Veille meteorologique|Cholon|Nung Chinese|Bao Ca|Operation Coburg|An Thoi|China Beach|South China Sea|Nguyen Van Thieu|LucyStone|KvindeMedFugl|Orpheu|IRON11|HK Timepiece|Red Guard badge 1918|Museu de l'Art de la Pell|estación 1978|map detail|boundary\. LOC|NK-44-7|Seal of the Embassy/i
const OFF_TOPIC_2 = /Matchbox label|nian bei jing|Cardboard sleeve|Paper sleeve|Soviet Union 1966 CPA|Thailand’s anti-Communist|Grave of Ying-Hsing|44 Chinese prisoners|1958 Events (College|montage)|offense against the Indo-Chinese/i
// the 1977–1989 searches match aircraft registrations, years of birth and foreign places
const OFF_TOPIC_3 =
  /Marines in relief party|Stilwell|China Lake|China Airlines|China Clipper|Taxkorgan|Ferrari|法拉利|Mijas|Benadalid|footballer|B-1981@|Volkswagen Santana|Pompeo|Events montage|^Map of |China Town|Postage Prepaid indicia|Boeing C-137B|Gewurztraminer|Dinah Shore|Wang Yaping \(|蒲志強|Naruyama|Kenhirano|Torata Nakamura|Kyoshiro Niwa|Sjöhistorisk|Caption- circa 1950|韩卫民/i
// a later photograph of the period (anniversaries, museum objects): a year after 1990 in the file name, not part
// of an archive number such as GPN-2002-000077
const LATER = /(?<![\dA-Za-z-])(199[1-9]|20[0-2]\d)|anniversary|Remember|周年|紀念/i
const NA_KEEP = 6
// crops and recolourings of a file that is itself in the register; a person's name in brackets marks a crop of
// a group photograph (MaoLiuZhouZhuLin19660915 (刘少奇).jpg)
const CROP = /\(cropped[,)]|cropped\)|\(crop\)|\(colourised\)|detail, |^Face detail|\([\u4e00-\u9fff]{2,4}\)\.\w+$/i
// near-identical shots (红灯记2, 红灯记3 …) are kept up to this many per title
const NEAR_KEEP = 3
const nearKey = (r: Rec) => r.title.replace(/[\s\d()]+$/, '').replace(/\s*(vue avec allumettes|photo Mao|page de garde)$/, '')
const SERIES = /^(Revolutionary Opera Performance of|Performance of the Revolut\w* Opera) The Red Detachment of Women - DPLA/
const SERIES_KEEP = 12
// full-text search matches loosely (intitle:Te finds the Dutch "te"), so a search hit is kept only when its name,
// description or author points to China; kana marks Japanese captions, whose kanji would otherwise pass
// (also the names in other languages, Chinese stamp numbers such as Ji47 or Wen7, and the pinyin of everyone in
// the people files)
const CHINA =
  /China|Chinese|cinese|chinois|chines|\bPRC\b|Peking|Peiping|Beijing|Shanghai|Tibet|Xinjiang|Taiwan|Hong Kong|Macau|\bMao\b|Mao Tse|Chou En|Red Guard|Tiananmen|Yan'?an|Nanjing|Canton|Guangzhou|Wuhan|Great Leap|commune|Backyard furnace|People's Heroes|People's Liberation/i
const STAMP_NO = /^(Wen|Ji|Te|J|T)\d+[ ,]/
const HANZI = /[\u4e00-\u9fff]/
const KANA = /[\u3040-\u30ff]/
const peopleFiles = [join(ROOT, 'content', 'people.yaml'), ...readdirSync(join(ROOT, 'content', 'people')).map((f) => join(ROOT, 'content', 'people', f))]
const PINYIN = peopleFiles
  .flatMap((f) => (parse(readFileSync(f, 'utf8')) as { pinyin?: string }[]).map((p) => p.pinyin))
  .filter((s): s is string => !!s)
  .map((s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())
const aboutChina = (r: Rec) => {
  const t = `${r.file} ${r.title} ${r.description ?? ''} ${r.author ?? ''}`
  const lower = t.toLowerCase()
  return CHINA.test(t) || STAMP_NO.test(r.file) || (HANZI.test(t) && !KANA.test(t)) || PINYIN.some((n) => lower.includes(n))
}

// the kind named in the manifest for the pull an item came from; pulls since dropped from the manifest fall
// back to the kind on record
const pullKind = (r: Rec) => manifest.commons.find((p) => r.via === (p.category ? `category:${p.category}` : `search:${p.search}`))?.kind ?? r.kind

function kindOf(r: Rec) {
  const t = `${r.title} ${r.file}`
  const kind = pullKind(r)
  if (/电影|\bfilm\b|百花奖/i.test(t)) return 'film'
  if (/stamp|邮票|郵票|^(Wen|Ji|Te|J|T)\d+[ ,]/i.test(r.file)) return 'stamp'
  if (/badge|像章|臂章/i.test(t)) return 'badge'
  if (/红灯记|紅燈記|沙家浜|智取威虎山|娘子军|娘子軍|Red Detachment|样板|白毛女|海港|奇袭白虎团|龙江颂|杜鹃山|芦荡火种|京剧|芭蕾|ballet|opera/i.test(t)) return 'opera'
  if (/语录|語錄|Quotations|Citations|Livre rouge|Little ?Red ?Book|lille røde|bibel|日报|daily|Pictorial|画报|杂志|book|封面|\bcover\b|《/i.test(t)) return 'publication'
  if (/poster|宣传画|lithograph|propaganda/i.test(t)) return 'poster'
  // the propaganda-poster category also holds portrait photographs
  if (r.via.startsWith('category:')) return kind === 'poster' && /^(Mao Zedong|Peng Zhen|Norodom|Mao )/.test(r.file) ? 'photo' : kind
  // a search hit without a word naming its kind is most likely a photograph of the subject (searches for 人民画报
  // return the photographs printed in it, not covers)
  return ['poster', 'opera', 'stamp', 'badge', 'publication'].includes(kind) ? 'photo' : kind
}

function curate() {
  const files = new Set(Object.values(reg).map((r) => r.file))
  const base = (f: string) => f.replace(IMAGE, '').replace(/\s*\(cropped\)/g, '').trim()
  const bases = new Map<string, string[]>()
  for (const f of files) bases.set(base(f), [...(bases.get(base(f)) ?? []), f])
  let series = 0
  let na = 0
  const near = new Map<string, number>()
  const rules: [string, (r: Rec) => boolean][] = [
    ['foreign stamp', (r) => FOREIGN_STAMP.test(r.file) && !ABOUT_CHINA.test(r.file)],
    ['off topic', (r) => OFF_TOPIC.test(r.file) || OFF_TOPIC_2.test(r.file) || OFF_TOPIC_3.test(r.file)],
    ['photographed after 1990', (r) => r.date >= '1977' && LATER.test(r.file)],
    [`more than ${NA_KEEP} Nationaal Archief photos of one visit`, (r) => /Bestanddeelnr/.test(r.file) && ++na > NA_KEEP],
    ['search hit with nothing about China', (r) => r.via.startsWith('search:') && !aboutChina(r)],
    ['crop of another file', (r) => CROP.test(r.file)],
    ['tif copy of a jpg', (r) => /\.tiff?$/i.test(r.file) && (bases.get(base(r.file)) ?? []).some((f) => f !== r.file && !/\.tiff?$/i.test(f))],
    [`more than ${SERIES_KEEP} photos of the 1972 performance series`, (r) => SERIES.test(r.file) && ++series > SERIES_KEEP],
    [`more than ${NEAR_KEEP} near-identical shots`, (r) => near.set(nearKey(r), (near.get(nearKey(r)) ?? 0) + 1).get(nearKey(r))! > NEAR_KEEP],
  ]
  for (const [id, r] of Object.entries(reg).sort(([, a], [, b]) => a.file.localeCompare(b.file))) {
    // rules run in order and stop at the first that applies, so the counting rules only count survivors
    const why = r.keep ? undefined : rules.find(([, test]) => test(r))?.[0]
    const { skip: _s, why: _w, ...rest } = r
    if (why) {
      reg[id] = { ...rest, skip: true, why }
      shelve(join(outDir, `${id}.jpg`), join(skippedDir, `${id}.jpg`))
    } else {
      reg[id] = r.keep ? rest : { ...rest, kind: kindOf(r) }
      shelve(join(skippedDir, `${id}.jpg`), join(outDir, `${id}.jpg`))
    }
  }
  // thumbnails left by an interrupted run, with no entry in the register
  for (const f of readdirSync(outDir)) if (!reg[f.replace(/\.jpg$/, '')]) shelve(join(outDir, f), join(skippedDir, f))
}

// skipped thumbnails are moved out of public/ rather than deleted, so a rule change can bring them back
function shelve(from: string, to: string) {
  if (!existsSync(from)) return
  try {
    renameSync(from, to)
  } catch (e) {
    report.push(`${from}: could not move (${(e as Error).message})`)
  }
}

// a year inside the period, from the file's own date field first, then from its title
function yearOf(dateText: string | undefined, title: string): { date: string; from: Rec['dateFrom'] } | undefined {
  const pick = (s: string) => [...s.matchAll(/(?<!\d)(19[4-9]\d)(?:[-./年](\d{1,2}))?(?:[-./月](\d{1,2}))?/g)].find((m) => +m[1] >= FROM && +m[1] <= TO)
  // "1958-1959" is a range, not month 19
  const fmt = (m: RegExpMatchArray) => {
    const mo = m[2] && +m[2] >= 1 && +m[2] <= 12 ? m[2] : undefined
    return [m[1], mo?.padStart(2, '0'), mo && m[3] ? m[3].padStart(2, '0') : undefined].filter(Boolean).join('-')
  }
  const a = dateText && pick(dateText)
  if (a) return { date: fmt(a), from: 'metadata' }
  const b = pick(title)
  return b ? { date: b[1], from: 'title' } : undefined
}

const report: string[] = []
let added = 0
// --curate re-applies the rules to the register without going online; other arguments limit the run to the
// pulls whose category or search contains one of them
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'))
for (const p of process.argv.includes('--curate') ? [] : manifest.commons) {
  const via = p.category ? `category:${p.category}` : `search:${p.search}`
  if (only.length && !only.some((s) => via.includes(s))) continue
  let titles: string[]
  try {
    titles = p.category ? await members(p.category, p.depth ?? 0) : await search(p.search!, p.limit ?? 100)
  } catch (e) {
    report.push(`${via}: error ${(e as Error).message}`)
    continue
  }
  titles = [...new Set(titles)].filter((t) => IMAGE.test(t) && !known.has(t.replace(/^File:/, '')))
  if (p.limit) titles = titles.slice(0, p.limit)
  let kept = 0
  for (let i = 0; i < titles.length; i += 50) {
    const q = await api({ action: 'query', titles: titles.slice(i, i + 50).join('|'), prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: String(WIDTH) }).catch((e: Error) => {
      report.push(`${via}: batch ${i / 50 + 1} ${e.message}`)
      return undefined
    })
    if (!q) continue
    for (const pg of Object.values(q.query?.pages ?? {}) as any[]) {
      const info = pg.imageinfo?.[0]
      if (!info?.thumburl) continue
      const meta = info.extmetadata ?? {}
      const file = (pg.title as string).replace(/^File:/, '')
      if (known.has(file)) continue
      const name = strip(meta.ObjectName?.value) || file.replace(IMAGE, '')
      const dateText = strip(meta.DateTimeOriginal?.value)?.replace(/date QS:\S+/g, '')
      const y = yearOf(dateText, `${name} ${file}`)
      if (!y) continue
      const id = 'cm-' + createHash('sha1').update(file).digest('hex').slice(0, 10)
      const img = await fetch(info.thumburl, { headers: { 'User-Agent': UA } })
      if (!img.ok) {
        report.push(`${file}: download ${img.status}`)
        continue
      }
      writeFileSync(join(outDir, `${id}.jpg`), Buffer.from(await img.arrayBuffer()))
      reg[id] = {
        kind: p.kind,
        title: name.slice(0, 120),
        date: y.date,
        dateFrom: y.from,
        file,
        url: info.descriptionurl,
        author: strip(meta.Artist?.value)?.slice(0, 160),
        license: strip(meta.LicenseShortName?.value) || 'unknown',
        licenseUrl: meta.LicenseUrl?.value,
        description: strip(meta.ImageDescription?.value)?.slice(0, 300),
        via,
      }
      known.add(file)
      kept++
      added++
      await sleep(150)
    }
    await sleep(300)
  }
  report.push(`${via}: ${titles.length} new files, ${kept} kept`)
}

curate()
const kept = Object.values(reg).filter((r) => !r.skip)
report.push(`curated: ${Object.values(reg).filter((r) => r.skip).length} skipped, ${kept.length} kept`)
const byKind = new Map<string, number>()
for (const r of kept) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1)
report.push(`kept by kind: ${[...byKind].map(([k, n]) => `${k} ${n}`).join(', ')}`, '', 'kept:')
report.push(...kept.sort((a, b) => a.kind.localeCompare(b.kind) || a.date.localeCompare(b.date)).map((r) => `${r.kind} | ${r.date} | ${r.title} | ${r.license}`))
const sorted = Object.fromEntries(Object.entries(reg).sort(([, a], [, b]) => a.date.localeCompare(b.date) || a.file.localeCompare(b.file)))
writeFileSync(
  regPath,
  '# Visual archive from Wikimedia Commons, written by tools/fetch-archive.ts. Hand edits to title and date are\n' +
    '# kept on the next run; kind and skip are re-derived unless `keep: true`. `why` says why an item was dropped.\n' +
    '# `dateFrom: title` means the year was read from the file name because Commons has no date for it.\n' +
    stringify(sorted, { lineWidth: 0 }),
)
writeFileSync(join(ROOT, '.probe', 'archive-report.txt'), report.join('\n'))
console.log(`${added} added, ${Object.keys(reg).length} in the archive — see .probe/archive-report.txt`)
