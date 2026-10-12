import * as d3 from 'd3'
import { useMemo, useRef } from 'react'
import { useTip } from '../../components/bits'
import type { Ism } from '../../data/atlas'
import { ISM_KINDS } from '../../data/schema'
import { ismColor, KIND_ORDER } from '../../lib/isms'
import { useSize } from '../../lib/useSize'
import { useApp, useHistoryState } from '../../state'

const PERIODS: [number, number][] = [
  [1959, 1965],
  [1966, 1966],
  [1967, 1967],
  [1968, 1972],
  [1973, 1978],
  [1979, 1983],
]
// below this many characters a year says more about which document survived than about the year
const MIN_CHARS = 5000
const AXIS_H = 34
const CORPUS_H = 54

type Bin = { label: string; from: number; to: number; chars: number; docs: number; ok: boolean }

export function Stream() {
  const { ix, sel, select } = useApp()
  const wrap = useRef<HTMLDivElement>(null)
  const { width, height } = useSize(wrap)
  const { tip, setTip } = useTip()
  const [byYear, setByYear] = useHistoryState('ideas.byYear', false)
  const [share, setShare] = useHistoryState('ideas.share', false)

  const bins = useMemo<Bin[]>(() => {
    const spans: [number, number][] = byYear ? d3.range(1959, 1984).map((y) => [y, y]) : PERIODS
    return spans.map(([from, to]) => {
      const years = ix.corpus.filter((c) => c.year >= from && c.year <= to)
      const chars = d3.sum(years, (c) => c.chars)
      return { label: from === to ? String(from) : `${from}–${to}`, from, to, chars, docs: d3.sum(years, (c) => c.docs), ok: chars >= MIN_CHARS }
    })
  }, [ix, byYear])

  const isms = useMemo(
    () => ix.isms.filter((m) => m.hits.length).sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.from.localeCompare(b.from)),
    [ix],
  )
  const counts = useMemo(
    () =>
      bins.map((b) => {
        const r: Record<string, number> = {}
        for (const m of isms) r[m.id] = d3.sum(m.hits.filter((h) => +h.date.slice(0, 4) >= b.from && +h.date.slice(0, 4) <= b.to), (h) => h.count)
        return r
      }),
    [bins, isms],
  )

  const W = Math.max(560, width - 8)
  const H = Math.max(260, height - AXIS_H - CORPUS_H - 16)
  const x = d3
    .scalePoint<number>()
    .domain(bins.map((_, i) => i))
    .range([150, W - 70])
  const rows = bins.map((b, i) => {
    const r: Record<string, number> = { i }
    for (const m of isms) r[m.id] = b.ok ? (counts[i][m.id] / b.chars) * 10000 : 0
    return r
  })
  const series = d3
    .stack<Record<string, number>>()
    .keys(isms.map((m) => m.id))
    .offset(share ? d3.stackOffsetExpand : d3.stackOffsetSilhouette)
    .order(share ? d3.stackOrderNone : d3.stackOrderInsideOut)(rows)
  const lo = d3.min(series, (s) => d3.min(s, (d) => d[0])) ?? 0
  const hi = d3.max(series, (s) => d3.max(s, (d) => d[1])) ?? 1
  const y = d3.scaleLinear().domain([lo, hi || 1]).range([H - 8, 12])
  const area = d3
    .area<d3.SeriesPoint<Record<string, number>>>()
    .defined((d) => bins[d.data.i].ok)
    .x((d) => x(d.data.i)!)
    .y0((d) => y(d[0]))
    .y1((d) => y(d[1]))
    .curve(d3.curveMonotoneX)
  const shade = new Map<string, number>()
  for (const k of KIND_ORDER) isms.filter((m) => m.kind === k).forEach((m, i, all) => shade.set(m.id, 0.95 - (0.45 * i) / Math.max(1, all.length - 1)))
  const focus = sel?.type === 'ism' ? sel.id : undefined
  const maxChars = d3.max(bins, (b) => b.chars) || 1
  const step = bins.length > 1 ? x(1)! - x(0)! : 100

  const tipAt = (e: React.MouseEvent, m: Ism) => {
    const r = wrap.current!.getBoundingClientRect()
    const sx = e.clientX - (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect().left
    const i = d3.minIndex(bins, (_, j) => Math.abs(x(j)! - sx))
    const b = bins[i]
    setTip({
      x: e.clientX - r.left,
      y: e.clientY - r.top + wrap.current!.scrollTop,
      content: (
        <>
          <b>{m.name}</b>
          <small>
            {ISM_KINDS[m.kind]} · {b.label}
          </small>
          <div style={{ marginTop: 4 }}>
            {b.ok ? `${counts[i][m.id]} 次，每万字 ${((counts[i][m.id] / b.chars) * 10000).toFixed(1)} 次` : '这段时间语料太少，不计'}
          </div>
        </>
      ),
    })
  }

  return (
    <>
      <div className="control-bar">
        <button className="chip" aria-pressed={!byYear} onClick={() => setByYear(false)}>
          按时期
        </button>
        <button className="chip" aria-pressed={byYear} onClick={() => setByYear(true)}>
          按年
        </button>
        <span className="muted-note">｜</span>
        <button className="chip" aria-pressed={!share} onClick={() => setShare(false)}>
          每万字次数
        </button>
        <button className="chip" aria-pressed={share} onClick={() => setShare(true)}>
          各主义所占份额
        </button>
        <span className="muted-note">
          {isms.length} 个主义在语料中出现过；本站语料只到 1983 年，1980 年代后期的主义（新权威主义、新启蒙等）尚无文本。语料不足 {MIN_CHARS / 1000}
          千字的{byYear ? '年份' : '时期'}留空。
        </span>
      </div>
      <div className="canvas" ref={wrap} style={{ overflow: 'auto' }} onMouseLeave={() => setTip(null)}>
        <svg width={W} height={H + AXIS_H + CORPUS_H + 8} style={{ display: 'block' }}>
          {bins.map((b, i) => (
            <g key={b.label} pointerEvents="none">
              <line x1={x(i)} x2={x(i)} y1={8} y2={H + AXIS_H + CORPUS_H} stroke="var(--rule)" />
              {!b.ok && <rect x={x(i)! - step / 2} y={8} width={step} height={H} fill="var(--paper-2)" opacity={0.7} />}
              {!b.ok && !byYear && (
                <text x={x(i)} y={H / 2} textAnchor="middle" fontSize={11} fill="var(--muted)">
                  语料太少
                </text>
              )}
            </g>
          ))}
          {series.map((s) => {
            const m = ix.ism.get(s.key)!
            const dim = focus && focus !== m.id
            return (
              <path
                key={s.key}
                d={area(s) ?? ''}
                fill={ismColor(m.kind)}
                fillOpacity={dim ? 0.15 : shade.get(m.id)}
                stroke="var(--paper)"
                strokeWidth={0.6}
                style={{ cursor: 'pointer' }}
                onClick={() => select({ type: 'ism', id: m.id })}
                onMouseMove={(e) => tipAt(e, m)}
              />
            )
          })}
          <g pointerEvents="none">
            {series.map((s) => {
              const m = ix.ism.get(s.key)!
              const j = d3.maxIndex(s, (d) => (bins[d.data.i].ok ? d[1] - d[0] : 0))
              const d = s[j]
              const h = y(d[0]) - y(d[1])
              if (h < 13) return null
              const half = (m.short ?? m.name).length * 5.6 + 4
              return (
                <text
                  key={s.key}
                  x={Math.max(x(0)! + half, Math.min(W - 8 - half, x(j)!))}
                  y={(y(d[0]) + y(d[1])) / 2 + 4}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill="var(--on-accent)"
                  style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.3)', strokeWidth: 2 }}
                >
                  {m.short ?? m.name}
                </text>
              )
            })}
          </g>
          <g pointerEvents="none" transform={`translate(0, ${H})`}>
            {bins.map((b, i) => (
              <text key={b.label} x={x(i)} y={20} textAnchor="middle" fontSize={byYear ? 10 : 11.5} fill="var(--ink-2)">
                {byYear ? (i % 2 && step < 40 ? '' : b.label) : b.label}
              </text>
            ))}
            <text x={16} y={AXIS_H + 14} fontSize={11} fill="var(--muted)">
              语料字数
            </text>
            {bins.map((b, i) => {
              const h = (b.chars / maxChars) * (CORPUS_H - 18)
              return (
                <g key={b.label}>
                  <rect x={x(i)! - Math.min(18, step / 3)} y={AXIS_H + CORPUS_H - 8 - h} width={Math.min(36, (step * 2) / 3)} height={h} fill={b.ok ? 'var(--ink-2)' : 'var(--rule-2)'} opacity={0.6} />
                  {(!byYear || step > 34) && b.chars > 0 && (
                    <text x={x(i)} y={AXIS_H + CORPUS_H - 12 - h} textAnchor="middle" fontSize={9.5} fill="var(--muted)">
                      {b.docs} 份 · {(b.chars / 10000).toFixed(1)} 万字
                    </text>
                  )}
                </g>
              )
            })}
          </g>
          <g transform="translate(16, 24)">
            {KIND_ORDER.filter((k) => isms.some((m) => m.kind === k)).map((k, i) => (
              <g key={k} transform={`translate(0, ${i * 18})`}>
                <rect width={10} height={10} rx={2} fill={ismColor(k)} />
                <text x={16} y={9} fontSize={11} fill="var(--ink-2)">
                  {ISM_KINDS[k]}
                </text>
              </g>
            ))}
          </g>
        </svg>
        {tip}
      </div>
    </>
  )
}
