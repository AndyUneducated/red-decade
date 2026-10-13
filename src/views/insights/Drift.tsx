import { useState } from 'react'
import { PersonChip } from '../../components/bits'
import { useApp } from '../../state'
import { Insight } from './Insight'
import { MAO } from './shared'

export function Drift() {
  const { ix, sel, select } = useApp()
  const [withMao, setWithMao] = useState(false)
  const concepts = ix.concepts.filter((c) => c.near.length >= 2)
  const picked = sel?.type === 'concept' ? sel.id : undefined
  const c = concepts.find((x) => x.id === picked) ?? concepts.find((x) => x.id === 'revisionism') ?? concepts[0]
  if (!c) return null

  return (
    <Insight
      question="同一个罪名，在不同年代指的是谁？“修正主义”“走资派”“政变”这些词旁边出现的人名，随时间怎样换了一批？"
      method="在本站全部原始文本中找出概念的每一个匹配词，取前后各 60 字为一段（相邻的段合并），统计段中出现的已建档人物姓名，每段每人只计一次。按文本日期分四个时期，每期列出现段数最多的人。毛泽东的名字几乎出现在每个词旁边，多半是作为引述的权威而不是所指的对象，默认不列，可以打开。"
      caveats="人名出现在罪名旁边，可能是被扣罪名的人，也可能是扣罪名的人或旁观者，需要回到原文判断（选中概念时右侧卡片列出各文献中的语境）；1966–1968 年许多被批判者不直接点名（“中国的赫鲁晓夫”“党内最大的走资本主义道路当权派”），这些指代不计入。只认全名，不认别名和简称。语料的年代分布不均，各期段数不宜直接相比。"
    >
      <div className="chips" style={{ marginBottom: 8 }}>
        {concepts.map((x) => (
          <button key={x.id} className="chip" aria-pressed={x.id === c.id} onClick={() => select({ type: 'concept', id: x.id })}>
            {x.name}
          </button>
        ))}
      </div>
      <label className="muted-note" style={{ display: 'block', marginBottom: 14 }}>
        <input type="checkbox" checked={withMao} onChange={(e) => setWithMao(e.target.checked)} /> 列出毛泽东
      </label>
      <div className="drift">
        {c.near.map((p) => {
          const people = p.people.filter((x) => withMao || x.id !== MAO).slice(0, 8)
          const max = Math.max(1, ...people.map((x) => x.n))
          return (
            <section key={p.period} className="drift-col">
              <h3>{p.period}</h3>
              <ol>
                {people.map((x) => (
                  <li key={x.id}>
                    <PersonChip id={x.id} />
                    <span className="bar" style={{ width: `${(60 * x.n) / max}%` }} />
                    <small>{x.n}</small>
                  </li>
                ))}
              </ol>
            </section>
          )
        })}
      </div>
    </Insight>
  )
}
