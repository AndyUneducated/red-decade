import * as d3 from 'd3'
import { Cite } from '../../components/bits'
import { fmtDate } from '../../lib/dates'
import { useApp } from '../../state'
import { Insight } from './Insight'
import { AUTHORITY_MIN_CHARS as MIN_CHARS } from './shared'

export function Authority() {
  const { ix } = useApp()
  const { years, terms } = ix.authorities
  const shown = years.filter((y) => y.chars >= MIN_CHARS && y.year >= 1949 && y.year <= 1989).sort((a, b) => a.year - b.year)
  const rate = (id: string, year: number) => {
    const n = terms.find((t) => t.id === id)?.counts.find((c) => c.year === year)?.n ?? 0
    const chars = years.find((y) => y.year === year)?.chars ?? 1
    return { n, r: (n / chars) * 1e4 }
  }
  const max = d3.max(terms.flatMap((t) => shown.map((y) => rate(t.id, y.year).r))) ?? 1
  const color = d3.scaleSqrt().domain([0, max]).range([0, 1])

  return (
    <Insight
      question="官方文本在论证时搬出谁？马恩列斯、毛泽东本人、“毛泽东思想”、林彪、华国锋、邓小平，各自在哪些年份被援引得最多？"
      method={`在中央文件、社论、讲话和新闻（${d3.sum(shown, (y) => y.docs)} 份，1949–1989 年）中逐年计数下列称呼，除以该年这些文本的总字数，得每万字出现次数；颜色越深越多。“毛泽东（本人）”计“毛主席”“毛泽东”，不含“毛泽东思想”“毛泽东选集”；林彪、华国锋、邓小平只计“林副主席”“华主席”“××同志”这类尊称，批判他们时的直呼其名不算。不足 ${MIN_CHARS / 10000} 万字的年份留空。`}
      caveats="本站语料按专题收集，1963–1964 年的中苏论战文章、1966–1968 年的报刊社论特别多，其他年份很少，同一行左右比较时要看下方的文献数。提到名字不等于援引为权威，“马克思”也可能出现在论战对方的引文里。"
    >
      <div className="flow-wrap">
        <table className="heat">
          <thead>
            <tr>
              <th />
              {shown.map((y) => (
                <th key={y.year} className="yr">
                  {y.year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {terms.map((t) => (
              <tr key={t.id}>
                <th>{t.name}</th>
                {shown.map((y) => {
                  const { n, r } = rate(t.id, y.year)
                  return (
                    <td key={y.year} style={{ background: n ? `color-mix(in srgb, var(--accent) ${Math.round(100 * color(r))}%, var(--paper))` : undefined }} title={`${y.year} 年 ${t.name}：${n} 次，每万字 ${r.toFixed(1)}`} />
                  )
                })}
              </tr>
            ))}
            <tr>
              <th className="muted-note">文献数</th>
              {shown.map((y) => (
                <td key={y.year} style={{ fontSize: 9.5, color: 'var(--muted)', textAlign: 'center' }}>
                  {y.docs}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <section className="insight-detail">
        <h3>各称呼最早的出现</h3>
        <ul className="minilist">
          {terms.map(
            (t) =>
              t.first && (
                <li key={t.id}>
                  <time>{fmtDate(t.first.date)}</time>
                  <b style={{ fontWeight: 500 }}>{t.name}</b> · 共 {t.total} 次 <Cite cite={t.first.source} />
                  <div className="q" style={{ color: 'var(--ink-2)' }}>
                    …{t.first.context}…
                  </div>
                </li>
              ),
          )}
        </ul>
      </section>
    </Insight>
  )
}
