// Stage 6: the open-data files under public/data/open (tables in src/data/open.ts) and the id register.
// research/ids.txt lists every <table>/<id> any build has published. An id that drops out of the data fails
// the build unless content/ids-moved.yaml records where it went, so a citation never silently breaks.
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
import { CLAIM_ID, cellOf, fieldsMarkdown, ID_FORMAT, OPEN_TABLES, type Cell } from '../../src/data/open.ts'
import type { Atlas } from '../../src/data/schema.ts'
import { errors, exists, load, path, read, ROOT } from './io.ts'

const REGISTER = path('research', 'ids.txt')
const MovedSchema = z.object({ id: z.string(), to: z.string().optional(), date: z.string(), note: z.string() })
export type Moved = z.infer<typeof MovedSchema>

const SITE = 'https://andyuneducated.github.io/red-decade/'
const REPO = 'https://github.com/AndyUneducated/red-decade'

function cell(v: Cell, where: string): string {
  if (v === undefined || v === null) return ''
  if (Array.isArray(v)) {
    if (v.some((x) => typeof x !== 'string' || x.includes(';'))) errors.push(`${where}: a list cell must hold strings without ";"`)
    return quote(v.join(';'))
  }
  if (typeof v === 'object') {
    errors.push(`${where}: nested value in a CSV column`)
    return ''
  }
  return quote(String(v))
}
const quote = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s)

function commit(): string | undefined {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return undefined
  }
}

export function openData(atlas: Atlas) {
  const moved = load(MovedSchema, exists('content', 'ids-moved.yaml') ? read('content', 'ids-moved.yaml') : [], 'ids-moved')
  const now = new Set<string>()
  const files = new Map<string, string>()
  const tables = OPEN_TABLES.map((t) => {
    const rows = t.rows(atlas)
    if (t.key)
      for (const r of rows) {
        const id = t.key(r)
        const ok = t.id === 'claims' ? CLAIM_ID : ID_FORMAT
        // relation ids join two person ids, which are checked in the people table
        if (t.id !== 'relations' && !ok.test(id)) errors.push(`${t.id}/${id}: id must be lower-case letters, digits and single hyphens`)
        const ref = `${t.id}/${id}`
        if (now.has(ref)) errors.push(`duplicate id ${ref}`)
        now.add(ref)
      }
    const lines = [t.cols.map((c) => c.key).join(','), ...rows.map((r, i) => t.cols.map((c) => cell(cellOf(c, r), `${t.id} row ${i + 1} ${c.key}`)).join(','))]
    files.set(`${t.id}.json`, JSON.stringify(rows))
    // the byte-order mark lets Excel read the file as UTF-8
    files.set(`${t.id}.csv`, '\uFEFF' + lines.join('\r\n') + '\r\n')
    return { t, rows: rows.length }
  })

  const before = existsSync(REGISTER) ? readFileSync(REGISTER, 'utf8').split(/\r?\n/).filter(Boolean) : []
  const movedIds = new Set(moved.map((m) => m.id))
  for (const ref of before) if (!now.has(ref) && !movedIds.has(ref)) errors.push(`${ref}: published id is gone; keep it, or record it in content/ids-moved.yaml`)
  for (const m of moved) {
    if (now.has(m.id)) errors.push(`ids-moved ${m.id}: the id is still in the data`)
    if (m.to && !now.has(m.to)) errors.push(`ids-moved ${m.id}: unknown target ${m.to}`)
  }
  const register = [...new Set([...before, ...now])].sort()

  const index = {
    title: '红色年代 · Red Decade 开放数据',
    site: SITE,
    repo: REPO,
    builtAt: atlas.builtAt,
    commit: commit(),
    license: {
      data: 'CC BY 4.0（content/、research/ 及由其生成的本目录文件）',
      texts: '原始文献全文（texts/）不在 CC BY 4.0 之内，版权状态以来源页面为准',
    },
    cite: '红色年代 · Red Decade，<表名> <id>，数据版本 <commit 前 7 位>，<站内网址>，访问于 <日期>。',
    atlas: 'atlas.json',
    texts: 'texts/<sources 的 id>.txt',
    ids: 'open/ids.txt',
    moved: 'open/moved.json',
    tables: tables.map(({ t, rows }) => ({
      id: t.id,
      name: t.name,
      about: t.about,
      rows,
      stableIds: !!t.key,
      parent: t.parent,
      link: t.link,
      json: `open/${t.id}.json`,
      csv: `open/${t.id}.csv`,
      bytes: { json: Buffer.byteLength(files.get(`${t.id}.json`)!), csv: Buffer.byteLength(files.get(`${t.id}.csv`)!) },
      cols: t.cols.map((c) => ({ key: c.key, about: c.about, csvOnly: c.get ? true : undefined })),
      nested: t.nested,
    })),
  }
  files.set('index.json', JSON.stringify(index, null, 1))
  files.set('moved.json', JSON.stringify(moved, null, 1))
  files.set('ids.txt', register.join('\n') + '\n')
  // the site link of each table, so a renamed record's old link can be sent to the new one
  const linkOf = (ref: string) => {
    const [table, id] = ref.split('/')
    return OPEN_TABLES.find((t) => t.id === table)?.link?.replace('{id}', id)
  }
  const relinks = moved.flatMap((m) => {
    const from = linkOf(m.id)
    const to = m.to && linkOf(m.to)
    return from && to ? [{ from, to }] : []
  })
  return { files, register, relinks }
}

export function writeOpen({ files, register }: ReturnType<typeof openData>) {
  const out = path('public', 'data', 'open')
  mkdirSync(out, { recursive: true })
  for (const [name, body] of files) writeFileSync(`${out}/${name}`, body)
  writeFileSync(REGISTER, register.join('\n') + '\n')
  mkdirSync(path('docs'), { recursive: true })
  writeFileSync(path('docs', 'fields.md'), fieldsMarkdown())
}

export const openStats = ({ files }: ReturnType<typeof openData>) => {
  const index = JSON.parse(files.get('index.json')!) as { tables: { rows: number; stableIds: boolean }[] }
  const bytes = [...files.values()].reduce((n, b) => n + Buffer.byteLength(b), 0)
  return `open       ${index.tables.length} tables, ${index.tables.filter((t) => t.stableIds).reduce((n, t) => n + t.rows, 0)} stable ids, ${(bytes / 1e6).toFixed(1)} MB`
}
