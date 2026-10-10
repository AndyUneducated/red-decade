import * as d3 from 'd3'
import { useMemo, useRef, useState } from 'react'
import { Cite, Entity, Voices } from '../components/bits'
import { fmtDate } from '../lib/dates'
import { useSize } from '../lib/useSize'
import { useApp } from '../state'

const LABEL_W = 220
const HEAD_H = 168
const ROW = 26

export const shortTitle = (s: { title: string; alias?: string }) =>
  (s.alias ?? s.title.replace(/[（(][^)）]*[)）]/g, '').replace(/^《|》$/g, '')).trim()

export function Ideas() {
  const { ix, sel, select, openDoc } = useApp()
  const wrap = useRef<HTMLDivElement>(null)
  const { width } = useSize(wrap)
  const [cell, setCell] = useState<{ c: string; s: string } | null>(null)
  const [hoverCol, setHoverCol] = useState<string | null>(null)

  const docs = useMemo(
    () => ix.sources.filter((s) => s.hasText && s.kind !== 'index').sort((a, b) => a.date.localeCompare(b.date)),
    [ix],
  )
  const concepts = useMemo(() => {
    const first = (c: (typeof ix.concepts)[number]) => c.hits[0]?.date ?? '9999'
    return [...ix.concepts].sort((a, b) => first(a).localeCompare(first(b)))
  }, [ix])

  const colW = Math.max(26, Math.min(44, (width - LABEL_W - 50) / docs.length))
  const max = d3.max(ix.concepts.flatMap((c) => c.hits.map((h) => h.count))) ?? 1
  const color = d3.scaleSequentialSqrt(d3.interpolate('#f7e3e3', '#8e0f25')).domain([1, max])

  const focusConcept = cell?.c ?? (sel?.type === 'concept' ? sel.id : concepts[0]?.id)
  const fc = ix.concept.get(focusConcept)

  const highlight = (text: string, terms: string[]) => {
    const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
    return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))
  }

  const yearBreaks = docs.map((d, i) => i > 0 && d.date.slice(0, 4) !== docs[i - 1].date.slice(0, 4))

  return (
    <div className="view">
      <div className="viewhead">
        <div>
          <h1>思想谱系</h1>
          <p>
            行＝概念，列＝原始文献（按日期排序），格子颜色＝该概念相关词在文中出现的次数。可以直接看出一个说法在哪份文件里第一次出现、在哪里突然变多。
          </p>
        </div>
      </div>
      <div className="ideas">
        <div className="canvas" ref={wrap}>
          <svg width={LABEL_W + docs.length * colW + 40} height={HEAD_H + concepts.length * ROW + 20} style={{ display: 'block' }}>
            {docs.map((d, j) => {
              const cx = LABEL_W + j * colW + colW / 2
              return (
                <g key={d.id}>
                  {yearBreaks[j] && <line x1={LABEL_W + j * colW} x2={LABEL_W + j * colW} y1={HEAD_H - 24} y2={HEAD_H + concepts.length * ROW} stroke="var(--ink-2)" strokeDasharray="3 3" />}
                  {hoverCol === d.id && <rect x={LABEL_W + j * colW} y={0} width={colW} height={HEAD_H + concepts.length * ROW} fill="var(--accent-soft)" opacity={0.5} />}
                  <text
                    transform={`translate(${cx + 4}, ${HEAD_H - 30}) rotate(-62)`}
                    fontSize={11.5}
                    fill="var(--ink)"
                    style={{ cursor: 'pointer' }}
                    onClick={() => openDoc(d.id)}
                    onMouseEnter={() => setHoverCol(d.id)}
                    onMouseLeave={() => setHoverCol(null)}
                  >
                    {shortTitle(d).slice(0, 16)}
                  </text>
                  <text x={cx} y={HEAD_H - 10} textAnchor="middle" fontSize={9.5} fill="var(--muted)">
                    {d.date.slice(2, 7).replace('-', '.')}
                  </text>
                </g>
              )
            })}
            {concepts.map((c, i) => {
              const y = HEAD_H + i * ROW
              const byDoc = new Map(c.hits.map((h) => [h.source, h]))
              const total = d3.sum(c.hits, (h) => h.count)
              const on = c.id === focusConcept
              return (
                <g key={c.id}>
                  {on && <rect x={0} y={y} width={LABEL_W + docs.length * colW} height={ROW} fill="var(--paper-2)" />}
                  <text x={LABEL_W - 10} y={y + 17} textAnchor="end" fontSize={12.5} fontWeight={on ? 600 : 400} style={{ cursor: 'pointer' }} onClick={() => {
                    setCell(null)
                    select({ type: 'concept', id: c.id })
                  }}>
                    {c.name}
                  </text>
                  <text x={LABEL_W + docs.length * colW + 8} y={y + 17} fontSize={10} fill="var(--muted)" fontFamily="var(--mono)">
                    {total || ''}
                  </text>
                  {docs.map((d, j) => {
                    const h = byDoc.get(d.id)
                    const first = c.hits[0]?.source === d.id
                    const picked = cell?.c === c.id && cell.s === d.id
                    return (
                      <g
                        key={d.id}
                        onMouseEnter={() => setHoverCol(d.id)}
                        onMouseLeave={() => setHoverCol(null)}
                        onClick={() => h && setCell({ c: c.id, s: d.id })}
                        style={{ cursor: h ? 'pointer' : 'default' }}
                      >
                        <rect x={LABEL_W + j * colW + 1} y={y + 2} width={colW - 2} height={ROW - 4} rx={3} fill={h ? color(h.count) : 'var(--paper-2)'} opacity={h ? 1 : 0.6} stroke={picked ? 'var(--focus)' : first ? 'var(--ink)' : 'none'} strokeWidth={picked ? 2.5 : 1.2} />
                        {h && colW > 24 && (
                          <text x={LABEL_W + j * colW + colW / 2} y={y + 17} textAnchor="middle" fontSize={10.5} fill={h.count > max * 0.18 ? '#fff' : 'var(--ink)'} pointerEvents="none">
                            {h.count}
                          </text>
                        )}
                      </g>
                    )
                  })}
                </g>
              )
            })}
            <g transform={`translate(${LABEL_W}, 18)`}>
              <text fontSize={11} fill="var(--muted)">
                黑框＝首次出现 · 虚线＝跨年 · 行末数字＝总次数
              </text>
            </g>
          </svg>
        </div>
        <aside>
          {fc && (
            <>
              <div className="kicker">概念</div>
              <h2 style={{ fontFamily: 'var(--serif)', margin: '4px 0 8px' }}>{fc.name}</h2>
              <p style={{ margin: '0 0 8px' }}>{fc.summary}</p>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8 }}>匹配词：{fc.terms.join('、')}</div>
              {fc.notes.length > 0 && <Voices voices={fc.notes} />}
              {fc.related.length > 0 && (
                <div className="chips" style={{ margin: '10px 0' }}>
                  {fc.related.map((r) => (
                    <Entity key={r} refTo={{ type: 'concept', id: r }} />
                  ))}
                </div>
              )}
              <h3 style={{ fontSize: 11.5, color: 'var(--muted)', letterSpacing: '0.1em', marginTop: 18 }}>
                原文语境（{fc.hits.length} 份文献）
              </h3>
              {(cell ? fc.hits.filter((h) => h.source === cell.s) : fc.hits).map((h) => (
                <div className="ctx" key={h.source}>
                  <time>{fmtDate(h.date)}</time> · {h.count} 次 <Cite cite={h.source} />
                  <div className="q">…{highlight(h.context, fc.terms)}…</div>
                </div>
              ))}
              {cell && (
                <button className="chip" style={{ marginTop: 10 }} onClick={() => setCell(null)}>
                  显示全部语境
                </button>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
