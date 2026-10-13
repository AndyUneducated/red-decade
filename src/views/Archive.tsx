import { PageTitle } from '../components/PageTitle'
import { Cite } from '../components/bits'
import { ARCHIVE_KINDS, type ArchiveItem, type ArchiveKind } from '../data/schema'
import { useApp, useHistoryState } from '../state'

const Y0 = 1949
const Y1 = 1990
const KINDS = Object.keys(ARCHIVE_KINDS) as ArchiveKind[]
export const KIND_COLOR: Record<ArchiveKind, string> = {
  poster: '#b8452f',
  badge: '#c99a2e',
  stamp: '#5b7f4a',
  opera: '#7a4a86',
  publication: '#3e6a8a',
  song: '#a0607a',
  film: '#4a7a7a',
  photo: '#6b6258',
}
const DATE_FROM: Record<ArchiveItem['dateFrom'], string> = { metadata: '文件日期', title: '文件名中的年份', source: '原文日期' }
const PAGE = 60

function Histogram({ items, year, onYear }: { items: ArchiveItem[]; year: number | undefined; onYear: (y: number | undefined) => void }) {
  const W = 840
  const H = 120
  const pad = { l: 28, r: 6, t: 6, b: 18 }
  const years = Array.from({ length: Y1 - Y0 + 1 }, (_, i) => Y0 + i)
  const counts = new Map(years.map((y) => [y, Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<ArchiveKind, number>]))
  for (const a of items) {
    const c = counts.get(+a.date.slice(0, 4))
    if (c) c[a.kind]++
  }
  const max = Math.max(1, ...years.map((y) => KINDS.reduce((n, k) => n + counts.get(y)![k], 0)))
  const bw = (W - pad.l - pad.r) / years.length
  const h = (n: number) => (n / max) * (H - pad.t - pad.b)
  return (
    <svg className="archive-hist" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="各年份条目数">
      <text className="series-tick" x={pad.l - 4} y={pad.t + 8} textAnchor="end">
        {max}
      </text>
      <line className="series-rule" x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} />
      {years.map((y, i) => {
        let top = H - pad.b
        const total = KINDS.reduce((n, k) => n + counts.get(y)![k], 0)
        return (
          <g key={y} className="archive-bar" data-on={year === y || undefined} onClick={() => onYear(year === y ? undefined : y)}>
            <title>
              {y} 年：{total} 条
            </title>
            <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} className="archive-hit" />
            {KINDS.map((k) => {
              const n = counts.get(y)![k]
              if (!n) return null
              top -= h(n)
              return <rect key={k} x={pad.l + i * bw + 1} y={top} width={bw - 2} height={h(n)} fill={KIND_COLOR[k]} />
            })}
            {y % 5 === 0 && (
              <text className="series-tick" x={pad.l + i * bw + bw / 2} y={H - 4} textAnchor="middle">
                {y}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export function ArchiveCard({ a }: { a: ArchiveItem }) {
  return (
    <figure className="archive-card">
      {a.image ? (
        <a href={a.url} target="_blank" rel="noreferrer" className="archive-img">
          <img src={`${import.meta.env.BASE_URL}${a.image}`} alt={a.title} loading="lazy" />
        </a>
      ) : (
        <div className="archive-img archive-noimg" style={{ color: KIND_COLOR[a.kind] }}>
          {ARCHIVE_KINDS[a.kind]}
        </div>
      )}
      <figcaption>
        <b>{a.title}</b>
        <span className="archive-meta">
          <i style={{ background: KIND_COLOR[a.kind] }} />
          {ARCHIVE_KINDS[a.kind]} · {a.date}（{DATE_FROM[a.dateFrom]}）
        </span>
        {a.quote && <q className="fig-quote">{a.quote}</q>}
        {a.description && !a.quote && <span className="archive-desc">{a.description}</span>}
        <span className="archive-rights">
          {a.licenseUrl ? (
            <a href={a.licenseUrl} target="_blank" rel="noreferrer">
              {a.license}
            </a>
          ) : (
            a.license
          )}
          {a.author && <> · {a.author}</>}
        </span>
        <span className="archive-src">
          {a.cite ? <Cite cite={a.cite} /> : a.url && <a href={a.url} target="_blank" rel="noreferrer">Wikimedia Commons 文件页</a>}
        </span>
      </figcaption>
    </figure>
  )
}

export function Archive() {
  const { ix, lens } = useApp()
  const [kind, setKind] = useHistoryState<ArchiveKind | ''>('archive.kind', '')
  const [year, setYear] = useHistoryState<number | undefined>('archive.year', undefined)
  const [shown, setShown] = useHistoryState('archive.shown', PAGE)
  const pool = lens ? ix.archive.filter((a) => lens.archive.has(a.id)) : ix.archive
  const ofKind = kind ? pool.filter((a) => a.kind === kind) : pool
  const list = year ? ofKind.filter((a) => +a.date.slice(0, 4) === year) : ofKind
  const withImage = ix.archive.filter((a) => a.image).length
  return (
    <div className="view">
      <div className="research">
        <div className="viewhead" style={{ padding: '0 0 14px', border: 0 }}>
          <div>
            <PageTitle />
            <p>
              {ix.archive.length} 条，其中 {withImage} 条有图。图片取自 Wikimedia Commons，每条登记文件页、作者和许可，日期取文件的日期字段，没有时取文件名中的年份，并注明依据；没有图的条目登记库内原文中的一次记载，附原句，构建时逐字核对。点柱子只看那一年。
            </p>
          </div>
        </div>
        {lens && (
          <p className="lens-empty">
            个人视角：标题或说明提到{lens.person.name}的 {pool.length} 条{pool.length ? '' : '。档案里没有这样的条目'}
          </p>
        )}
        <div className="chips" style={{ marginBottom: 10 }}>
          <button className="chip" aria-pressed={!kind} onClick={() => (setKind(''), setShown(PAGE))}>
            全部 {pool.length}
          </button>
          {KINDS.map((k) => {
            const n = pool.filter((a) => a.kind === k).length
            if (!n) return null
            return (
              <button key={k} className="chip" aria-pressed={kind === k} onClick={() => (setKind(kind === k ? '' : k), setShown(PAGE))}>
                <i style={{ background: KIND_COLOR[k] }} />
                {ARCHIVE_KINDS[k]} {n}
              </button>
            )
          })}
        </div>
        <Histogram items={ofKind} year={year} onYear={(y) => (setYear(y), setShown(PAGE))} />
        <h2 className="sec" style={{ marginTop: 14 }}>
          {year ? `${year} 年` : `${Y0}–${Y1} 年`} · {list.length} 条
        </h2>
        <div className="archive-grid">
          {list.slice(0, shown).map((a) => (
            <ArchiveCard key={a.id} a={a} />
          ))}
        </div>
        {list.length > shown && (
          <button className="chip archive-more" onClick={() => setShown(shown + PAGE)}>
            再显示 {Math.min(PAGE, list.length - shown)} 条（共 {list.length}）
          </button>
        )}
      </div>
    </div>
  )
}
