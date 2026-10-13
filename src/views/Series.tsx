import { PageTitle } from '../components/PageTitle'
import { Cite, Entity } from '../components/bits'
import { POINT_KINDS, SERIES_GROUPS, type Series, type SeriesPoint } from '../data/schema'
import { useApp, useHistoryState } from '../state'

// Every chart shares one 1949–1989 axis, so the years a series has no number for line up as blank columns.
const Y0 = 1949
const Y1 = 1989
const W = 360
const H = 128
const PAD = { l: 40, r: 8, t: 8, b: 18 }
const x = (year: number) => PAD.l + ((year - Y0) / (Y1 - Y0)) * (W - PAD.l - PAD.r)
// Points one year apart are joined by a solid line, a few years apart by a dashed one; a longer gap is left open.
const SOLID = 1
const DASHED = 6

const KIND_COLOR: Record<SeriesPoint['kind'], string> = { reported: 'var(--ink)', revised: 'var(--accent)', variant: 'var(--sys-gov)' }

const fmtNum = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 2 })

function niceMax(v: number) {
  const step = 10 ** Math.floor(Math.log10(v))
  return Math.ceil(v / step / 0.5) * 0.5 * step
}

function Chart({ s, pick, onPick }: { s: Series; pick: number; onPick: (i: number) => void }) {
  const max = niceMax(Math.max(...s.points.map((p) => p.value)))
  const y = (v: number) => H - PAD.b - (v / max) * (H - PAD.t - PAD.b)
  const main = s.points.filter((p) => p.kind === 'reported')
  const segs: { a: SeriesPoint; b: SeriesPoint; dashed: boolean }[] = []
  const gaps: [number, number][] = []
  main.forEach((b, i) => {
    const a = main[i - 1]
    if (!a) return
    const d = b.year - a.year
    if (d <= DASHED) segs.push({ a, b, dashed: d > SOLID })
    else gaps.push([a.year, b.year])
  })
  const reportedIn = new Map(main.map((p) => [p.year, p.value]))
  return (
    <svg className="series-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${s.title}，${s.points.length} 个数据点`}>
      {gaps.map(([a, b]) => (
        <g key={a}>
          <rect className="series-gap" x={x(a + 0.5)} y={PAD.t} width={x(b - 0.5) - x(a + 0.5)} height={H - PAD.t - PAD.b} />
          {x(b - 0.5) - x(a + 0.5) > 50 && (
            <text className="series-gap-label" x={(x(a + 0.5) + x(b - 0.5)) / 2} y={PAD.t + 14} textAnchor="middle">
              本库无数
            </text>
          )}
        </g>
      ))}
      {[0, max / 2, max].map((v) => (
        <g key={v}>
          <line className="series-rule" x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} />
          <text className="series-tick" x={PAD.l - 4} y={y(v) + 3} textAnchor="end">
            {fmtNum(v)}
          </text>
        </g>
      ))}
      {[1950, 1960, 1970, 1980, 1989].map((t) => (
        <text key={t} className="series-tick" x={x(t)} y={H - 4} textAnchor="middle">
          {t}
        </text>
      ))}
      {segs.map(({ a, b, dashed }) => (
        <line key={a.year} className="series-line" data-dashed={dashed || undefined} x1={x(a.year)} y1={y(a.value)} x2={x(b.year)} y2={y(b.value)} />
      ))}
      {s.points.map((p, i) =>
        p.kind !== 'reported' && reportedIn.has(p.year) ? (
          <line key={`r${i}`} className="series-drop" x1={x(p.year)} x2={x(p.year)} y1={y(reportedIn.get(p.year)!)} y2={y(p.value)} style={{ stroke: KIND_COLOR[p.kind] }} />
        ) : null,
      )}
      {s.points.map((p, i) => (
        <g key={i} className="series-pt" data-kind={p.kind} data-on={i === pick || undefined} onClick={() => onPick(i)} style={{ color: KIND_COLOR[p.kind] }}>
          <title>
            {p.year} 年 {p.approx ? '约 ' : ''}
            {fmtNum(p.value)} {s.unit}（{POINT_KINDS[p.kind]}）
          </title>
          <circle cx={x(p.year)} cy={y(p.value)} r={9} className="series-hit" />
          {p.kind === 'variant' ? (
            <rect x={x(p.year) - 3} y={y(p.value) - 3} width={6} height={6} />
          ) : (
            <circle cx={x(p.year)} cy={y(p.value)} r={p.kind === 'revised' ? 3.6 : 2.6} />
          )}
        </g>
      ))}
    </svg>
  )
}

function Card({ s }: { s: Series }) {
  // open on the first correction or other-basis number, since that is where the series has a story
  const first = s.points.findIndex((p) => p.kind !== 'reported')
  const [pick, setPick] = useHistoryState(`series.${s.id}`, first >= 0 ? first : s.points.length - 1)
  const p = s.points[pick] ?? s.points[0]
  const years = s.points.filter((q) => q.kind === 'reported').map((q) => q.year)
  return (
    <article className="series-card" id={`series-${s.id}`}>
      <header>
        <h3>{s.title}</h3>
        <span>
          {s.unit} · {years[0]}–{years[years.length - 1]} 年 · {new Set(years).size} 个年份
        </span>
      </header>
      {s.summary && <p>{s.summary}</p>}
      <Chart s={s} pick={pick} onPick={setPick} />
      <div className="series-detail">
        <div className="series-detail-head">
          <b>{p.year} 年</b>
          <span className="series-val">
            {p.approx ? '约 ' : ''}
            {fmtNum(p.value)} <small>{s.unit}</small>
          </span>
          <span className="series-kind" style={{ color: KIND_COLOR[p.kind] }}>
            {POINT_KINDS[p.kind]}
          </span>
          <Cite cite={p.cite} />
        </div>
        <q className="fig-quote">{p.quote}</q>
        {p.note && <div className="fig-note">{p.note}</div>}
      </div>
      {s.caveats && <div className="fig-caveat">{s.caveats}</div>}
      {s.events.length > 0 && (
        <div className="fig-links">
          {s.events.map((id) => (
            <Entity key={id} refTo={{ type: 'event', id }} />
          ))}
        </div>
      )}
    </article>
  )
}

export function SeriesView() {
  const { ix } = useApp()
  const sources = new Set(ix.series.flatMap((s) => s.points.map((p) => p.cite)))
  const points = ix.series.reduce((n, s) => n + s.points.length, 0)
  return (
    <div className="view">
      <div className="research figures">
        <div className="viewhead" style={{ padding: '0 0 14px', border: 0 }}>
          <div>
            <PageTitle />
            <p>
              {ix.series.length} 个序列、{points} 个数字，出自 {sources.size} 份文献，主要是国家统计局历年公报（《人民日报》刊载）和三次人口普查公报。每个数字附原文，构建时逐字核对；原文以亿斤、万担计的换算成万吨，原单位留在引文里。同一年有几个数时并列：当时公布的数连成线，后来修正的、另一口径的单独标出。1959–1976
              年的全国数字，本库只从个别会议文件和报告里找到几个；图上留白处是史料空白，不是数字为零。点任一个点看原文。
            </p>
          </div>
        </div>
        <div className="legend series-legend" style={{ marginBottom: 18 }}>
          {Object.entries(POINT_KINDS).map(([k, label]) => (
            <span key={k} data-kind={k}>
              <i style={{ background: KIND_COLOR[k as SeriesPoint['kind']] }} />
              {label}
            </span>
          ))}
          <span>
            <i className="series-gap-swatch" />
            本库没有找到数字的年份
          </span>
        </div>
        <nav className="fig-index">
          {ix.series.map((s) => (
            <a key={s.id} href={`#series-${s.id}`} onClick={(e) => (e.preventDefault(), document.getElementById(`series-${s.id}`)?.scrollIntoView({ behavior: 'smooth' }))}>
              {s.title}
            </a>
          ))}
        </nav>
        {Object.entries(SERIES_GROUPS).map(([g, label]) => {
          const list = ix.series.filter((s) => s.group === g)
          if (!list.length) return null
          return (
            <section key={g}>
              <h2 className="sec" style={{ marginTop: 22 }}>
                {label}
              </h2>
              <div className="series-grid">
                {list.map((s) => (
                  <Card key={s.id} s={s} />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
