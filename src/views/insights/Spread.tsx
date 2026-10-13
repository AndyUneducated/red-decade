import * as d3 from 'd3'
import { useMemo, useRef } from 'react'
import { SOURCE_KINDS, type ConceptHit } from '../../data/schema'
import type { Ref } from '../../data/atlas'
import { firstKey } from '../../derive/corpus'
import { fmtDate, toT } from '../../lib/dates'
import { useSize } from '../../lib/useSize'
import { useApp } from '../../state'
import { Insight } from './Insight'

// contemporary kinds of text, top to bottom of the hierarchy; press reports count with news
const KINDS: { id: string; color: string; also?: string[] }[] = [
  { id: 'party-doc', color: 'var(--sys-party)' },
  { id: 'speech', color: 'var(--org-mass)' },
  { id: 'editorial', color: 'var(--sys-gov)' },
  { id: 'news', color: 'var(--ink-2)', also: ['press'] },
  { id: 'redguard', color: 'var(--org-popular)' },
  { id: 'essay', color: 'var(--sys-army)', also: ['letter'] },
]
const kindOf = (k: string) => KINDS.find((x) => x.id === k || x.also?.includes(k))
const ROW = 20
const LABEL = 150

type Row = { ref: Ref; name: string; firsts: { kind: string; hit: ConceptHit }[] }

export function Spread() {
  const { ix, select } = useApp()
  const wrap = useRef<HTMLDivElement>(null)
  const { width } = useSize(wrap)
  const rows = useMemo(() => {
    const firsts = (hits: ConceptHit[]) => {
      const by = new Map<string, ConceptHit>()
      for (const h of [...hits].sort((a, b) => firstKey(a.date).localeCompare(firstKey(b.date)))) {
        const k = kindOf(ix.source.get(h.source)?.kind ?? '')
        if (k && !by.has(k.id)) by.set(k.id, h)
      }
      return [...by].map(([kind, hit]) => ({ kind, hit }))
    }
    const all: Row[] = [
      ...ix.concepts.map((c) => ({ ref: { type: 'concept', id: c.id } as Ref, name: c.name, firsts: firsts(c.hits) })),
      ...ix.isms.map((m) => ({ ref: { type: 'ism', id: m.id } as Ref, name: m.short ?? m.name, firsts: firsts(m.hits) })),
    ]
    return all.filter((r) => r.firsts.length >= 2).sort((a, b) => firstKey(a.firsts[0].hit.date).localeCompare(firstKey(b.firsts[0].hit.date)))
  }, [ix])
  const leaders = d3.rollup(
    rows,
    (v) => v.length,
    (r) => r.firsts[0].kind,
  )

  const W = Math.max(320, width)
  const x = d3
    .scaleLinear()
    .domain([1949, 1990])
    .range([LABEL, W - 10])
  return (
    <Insight
      question="一个口号或罪名，是先出现在中央文件和领导讲话里，还是先出现在社论、红卫兵小报或民间文章里？从首现到各类文本都在用，隔了多久？"
      method={`对每个概念和主义，在本站原始文本中找出各类文本（${KINDS.map((k) => SOURCE_KINDS[k.id]).join('、')}）里最早出现它的那一份，按日期画在同一行上，最早的点在最左。只列至少在两类文本中出现过的（${rows.length} 个）。点名称看它的语境与出处。`}
      caveats="“最早”是本站已收文本中的最早，不是历史上的最早：本站收的红卫兵文献和民间文章远少于中央文件和社论，下层先用、上层后收的情况会被低估。同一类文本里只画第一份。"
    >
      <p className="sub-note" style={{ marginTop: 0 }}>
        最早出现在：{KINDS.filter((k) => leaders.get(k.id)).map((k) => `${SOURCE_KINDS[k.id]} ${leaders.get(k.id)} 个`).join(' · ')}
      </p>
      <div className="chips" style={{ marginBottom: 10 }}>
        {KINDS.map((k) => (
          <span key={k.id} className="chip nolink">
            <i style={{ background: k.color }} />
            {SOURCE_KINDS[k.id]}
          </span>
        ))}
      </div>
      <div ref={wrap} style={{ maxWidth: 1200 }}>
        <svg width={W} height={rows.length * ROW + 20} style={{ display: 'block' }}>
          {d3.range(1950, 1991, 5).map((yr) => (
            <g key={yr}>
              <line x1={x(yr)} x2={x(yr)} y1={0} y2={rows.length * ROW} stroke="var(--rule)" />
              <text x={x(yr)} y={rows.length * ROW + 14} textAnchor="middle" fontSize={10} fill="var(--muted)">
                {yr}
              </text>
            </g>
          ))}
          {rows.map((r, i) => {
            const ts = r.firsts.map((f) => toT(f.hit.date))
            const cy = i * ROW + ROW / 2
            return (
              <g key={`${r.ref.type}:${r.ref.id}`}>
                <text x={LABEL - 8} y={cy + 4} textAnchor="end" fontSize={12} fill="var(--ink)" style={{ cursor: 'pointer' }} onClick={() => select(r.ref)}>
                  {r.name.length > 11 ? r.name.slice(0, 10) + '…' : r.name}
                </text>
                <line x1={x(d3.min(ts)!)} x2={x(d3.max(ts)!)} y1={cy} y2={cy} stroke="var(--rule-2)" strokeWidth={2} />
                {r.firsts.map((f) => (
                  <circle key={f.kind} cx={x(toT(f.hit.date))} cy={cy} r={4.5} fill={kindOf(f.kind)!.color} stroke="var(--paper)" style={{ cursor: 'pointer' }} onClick={() => select({ type: 'doc', id: f.hit.source })}>
                    <title>{`${SOURCE_KINDS[f.kind]} · ${fmtDate(f.hit.date)} · ${ix.source.get(f.hit.source)?.title ?? ''}\n…${f.hit.context}…`}</title>
                  </circle>
                ))}
              </g>
            )
          })}
        </svg>
      </div>
    </Insight>
  )
}
