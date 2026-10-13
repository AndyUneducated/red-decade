import * as d3 from 'd3'
import { useMemo, useRef, useState } from 'react'
import { fmtDate, toT } from '../../lib/dates'
import { shortTitle } from '../../lib/sources'
import { useSize } from '../../lib/useSize'
import { useApp } from '../../state'
import { Insight } from './Insight'

const H = 200

export function Citations() {
  const { ix, select } = useApp()
  const wrap = useRef<HTMLDivElement>(null)
  const { width } = useSize(wrap)
  const [focus, setFocus] = useState<string | null>(null)
  const rebuttals = useMemo(() => new Map(ix.documents.filter((d) => d.pairs?.length).flatMap((d) => [...d3.group(d.pairs!, (p) => p.against)].map(([to, ps]) => [`${d.id}>${to}`, ps.length]))), [ix])
  // a point-by-point rebuttal is a citation even where the text never writes the other's title in 《》
  const edges = useMemo(() => {
    const has = new Set(ix.citations.map((c) => `${c.from}>${c.to}`))
    return [
      ...ix.citations,
      ...[...rebuttals].filter(([k]) => !has.has(k)).map(([k, n]) => {
        const [from, to] = k.split('>')
        return { from, to, n }
      }),
    ]
  }, [ix, rebuttals])
  const cited = useMemo(
    () =>
      [...d3.group(edges, (c) => c.to)]
        .map(([to, cs]) => ({ to, cs: [...cs].sort((a, b) => (ix.source.get(a.from)?.date ?? '').localeCompare(ix.source.get(b.from)?.date ?? '')) }))
        .sort((a, b) => b.cs.length - a.cs.length || (ix.source.get(a.to)?.date ?? '').localeCompare(ix.source.get(b.to)?.date ?? '')),
    [edges, ix],
  )
  const name = (id: string) => {
    const s = ix.source.get(id)
    return s ? shortTitle(s) : id
  }
  const W = Math.max(320, width)
  const x = d3.scaleLinear().domain([1949, 1990]).range([12, W - 12])
  const at = (id: string) => x(toT(ix.source.get(id)?.date))

  return (
    <Insight
      question="文件和文章之间怎样互相援引、互相反驳？哪些文件被后来的文本反复点名，成为论战的靶子或依据？"
      method={`在中央文件、社论、讲话、新闻、红卫兵文献、民间文章、司法文书和信件中，查找用书名号点到的本站另一份文献（按简称，或五字以上的标题），只算日期不晚于引用者的文献。共 ${edges.length} 处引用、${cited.length} 份被引文献。弧线从引用的文本（右）连到被引的文献（左），点文献名只看与它有关的弧线。文献档案中记有逐条批驳的（如《五一六通知》对《二月提纲》）画成红色，即使原文没有用书名号点名。`}
      caveats="只认书名号里的完整名称，“提纲”“通知”这类简称和不加书名号的提及都漏掉了；被引用可能是依据，也可能是批判对象，要看原文。"
    >
      <div ref={wrap} style={{ maxWidth: 1200 }}>
        <svg width={W} height={H + 18} style={{ display: 'block' }}>
          {d3.range(1950, 1991, 5).map((yr) => (
            <text key={yr} x={x(yr)} y={H + 14} textAnchor="middle" fontSize={10} fill="var(--muted)">
              {yr}
            </text>
          ))}
          <line x1={x(1949)} x2={x(1990)} y1={H} y2={H} stroke="var(--rule-2)" />
          {edges.map((c, i) => {
            const [a, b] = [at(c.to), at(c.from)]
            const r = Math.max(4, (b - a) / 2)
            const on = !focus || focus === c.to || focus === c.from
            const rebut = rebuttals.has(`${c.from}>${c.to}`)
            return (
              <path
                key={i}
                d={`M${b},${H} A${r},${Math.min(r, H - 8)} 0 0 0 ${a},${H}`}
                fill="none"
                stroke={rebut ? 'var(--accent)' : 'var(--ink-2)'}
                strokeOpacity={on ? 0.75 : 0.08}
                strokeWidth={Math.min(4, 0.8 + c.n * 0.5)}
              >
                <title>{`${fmtDate(ix.source.get(c.from)?.date)} ${name(c.from)} → ${name(c.to)}（${c.n} 处）`}</title>
              </path>
            )
          })}
        </svg>
      </div>
      <section className="insight-detail" style={{ maxWidth: 1000 }}>
        <h3>被引用的文献</h3>
        <ul className="minilist">
          {cited.map(({ to, cs }) => (
            <li key={to}>
              <time>{fmtDate(ix.source.get(to)?.date)}</time>
              <button className="linklike" style={{ fontWeight: focus === to ? 600 : 500 }} onClick={() => setFocus(focus === to ? null : to)}>
                {name(to)}
              </button>{' '}
              <button className="linklike muted-note" onClick={() => select({ type: 'doc', id: to })}>
                原文 →
              </button>
              <div style={{ marginTop: 2, color: 'var(--ink-2)', fontSize: 12 }}>
                被引用于：
                {cs.map((c, i) => (
                  <span key={c.from}>
                    {i > 0 && '；'}
                    <button className="linklike" onClick={() => select({ type: 'doc', id: c.from })}>
                      {fmtDate(ix.source.get(c.from)?.date)} {name(c.from)}
                    </button>
                    {c.n > 1 && ` ×${c.n}`}
                    {rebuttals.has(`${c.from}>${to}`) && <b style={{ color: 'var(--accent)', fontWeight: 500 }}> 逐条批驳 {rebuttals.get(`${c.from}>${to}`)} 处</b>}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </Insight>
  )
}
