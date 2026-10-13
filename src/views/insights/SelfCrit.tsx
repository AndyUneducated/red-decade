import * as d3 from 'd3'
import { useState } from 'react'
import { fmtDate } from '../../lib/dates'
import { shortTitle } from '../../lib/sources'
import { useApp } from '../../state'
import { Insight } from './Insight'

export function SelfCrit() {
  const { ix, select } = useApp()
  const [cell, setCell] = useState<[string, string] | null>(null)
  const texts = [...ix.selfcrit.texts].sort((a, b) => (ix.source.get(a.id)?.date ?? '').localeCompare(ix.source.get(b.id)?.date ?? ''))
  const rate = (phrase: string, text: string) => {
    const hit = ix.selfcrit.phrases.find((p) => p.id === phrase)?.hits.find((h) => h.source === text)
    const chars = texts.find((t) => t.id === text)?.chars ?? 1
    return { hit, r: hit ? (hit.count / chars) * 1000 : 0 }
  }
  const max = d3.max(ix.selfcrit.phrases.flatMap((p) => texts.map((t) => rate(p.id, t.id).r))) ?? 1
  const color = d3.scaleSqrt().domain([0, max]).range([0, 1])
  const picked = cell && rate(cell[0], cell[1]).hit

  return (
    <Insight
      question="检讨有没有固定的写法？1960 年县委的检查、1966–1967 年刘少奇的检讨和省委书记的认罪电报，用的是同一套话吗？“我”还是“我们”？"
      method={`本站收录的检讨、检查和认罪文本共 ${texts.length} 份（content/insight-terms.yaml 列出），逐篇统计一组用语出现的次数，除以全文字数，得每千字次数；颜色越深越多。“我（单数）”不含“我们”“我国”“我党”“我省”等。点格子看第一次出现处的原文。`}
      caveats="只有五份文本，说的是这五份，不能代表检讨这一文体；文本长短相差十倍以上，短文本的每千字数波动大。部分文本是转载或摘录。"
    >
      <div className="flow-wrap">
        <table className="heat selfcrit">
          <thead>
            <tr>
              <th />
              {texts.map((t) => {
                const s = ix.source.get(t.id)
                return (
                  <th key={t.id} className="doc">
                    <button className="linklike" onClick={() => select({ type: 'doc', id: t.id })}>
                      {s ? shortTitle(s) : t.id}
                    </button>
                    <small>
                      {fmtDate(s?.date)} · {t.chars} 字
                    </small>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {ix.selfcrit.phrases.map((p) => (
              <tr key={p.id}>
                <th>{p.name}</th>
                {texts.map((t) => {
                  const { hit, r } = rate(p.id, t.id)
                  const on = cell?.[0] === p.id && cell?.[1] === t.id
                  return (
                    <td key={t.id} style={{ background: hit ? `color-mix(in srgb, var(--accent) ${Math.round(100 * color(r))}%, var(--paper))` : undefined, outline: on ? '2px solid var(--ink)' : undefined }}>
                      {hit && (
                        <button onClick={() => setCell(on ? null : [p.id, t.id])} title={`${hit.count} 次，每千字 ${r.toFixed(1)}`}>
                          {hit.count}
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {picked && (
        <section className="insight-detail">
          <h3>
            {ix.selfcrit.phrases.find((p) => p.id === cell![0])?.name} · {shortTitle(ix.source.get(cell![1])!)}
          </h3>
          <p style={{ fontFamily: 'var(--serif)', lineHeight: 1.8 }}>…{picked.context}…</p>
        </section>
      )}
    </Insight>
  )
}
