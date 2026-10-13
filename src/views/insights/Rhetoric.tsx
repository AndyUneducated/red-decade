import { useMemo, useState } from 'react'
import { factionAt } from '../../data/atlas'
import { fmtDate, toT } from '../../lib/dates'
import { useApp } from '../../state'
import { Insight } from './Insight'
import { cosine, HOSTILE, rhetoric, RHETORIC_MIN_TEXTS as MIN_TEXTS, type Profile } from './shared'

const share = (p: Profile, k: string) => (p.counts.get(k) ?? 0) / p.total

export function Rhetoric() {
  const { ix, select } = useApp()
  const [cell, setCell] = useState<[string, string] | null>(null)
  const { vocab, profiles, attributed } = rhetoric(ix)
  const hostile = useMemo(() => {
    const s = new Set<string>()
    for (const r of ix.relations) {
      const a = ix.person.get(r.a)
      const b = ix.person.get(r.b)
      if (!HOSTILE.has(r.type) || !r.from || !a || !b) continue
      const t = toT(r.from)
      const [x, y] = [factionAt(a, t), factionAt(b, t)]
      if (x !== y) s.add(`${x}|${y}`).add(`${y}|${x}`)
    }
    return s
  }, [ix])
  const pa = profiles.find((p) => p.f.id === cell?.[0])
  const pb = profiles.find((p) => p.f.id === cell?.[1])

  return (
    <Insight
      question="互相批判的两派，用的是不是同一套词？谁和谁说话最像，谁的说辞独树一帜？"
      method={`文本按作者归派：作者栏点到已建档人物的，取此人在成文日期所属的派系；作者是标了派系的机构的，取机构的派系（${attributed} 份有全文的文本能归派）。用词取本站追踪的 ${vocab.size} 个概念与主义的匹配词，每派合计各词出现次数；两派的重合度是两组次数的余弦相似度（0 到 1，1 表示用词比例完全相同）。只比较至少 ${MIN_TEXTS} 份文本的派系。框线标出两派之间有批判或迫害关系的格子。点格子看两派共用最多的词和各自独有的词。`}
      caveats="只数本站追踪的词，不是全文用词；概念与主义的匹配词有重叠时会重复计数。作者栏写的是署名，代笔、集体署名与转载都按署名归派；一份文本可同时归入几派。高重合不等于观点相同：对立双方往往用同一批词互相指控。"
    >
      <div className="flow-wrap">
        <table className="flow">
          <thead>
            <tr>
              <th className="corner">{profiles.length} 派</th>
              {profiles.map((p) => (
                <th key={p.f.id} className="col">
                  <span>{p.f.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profiles.map((a) => (
              <tr key={a.f.id}>
                <th>
                  <i style={{ background: a.f.color }} />
                  {a.f.name} <small className="muted-note">{a.texts.size}</small>
                </th>
                {profiles.map((b) => {
                  if (a === b) return <td key={b.f.id} />
                  const c = cosine(a, b)
                  const on = cell?.[0] === a.f.id && cell?.[1] === b.f.id
                  return (
                    <td key={b.f.id}>
                      <button
                        aria-pressed={on}
                        style={{ background: `color-mix(in srgb, var(--accent) ${Math.round(100 * c * c)}%, transparent)`, outline: hostile.has(`${a.f.id}|${b.f.id}`) ? '1.5px solid var(--ink)' : undefined }}
                        onClick={() => setCell(on ? null : [a.f.id, b.f.id])}
                        title={`${a.f.name} × ${b.f.name}：${c.toFixed(2)}`}
                      >
                        {c >= 0.995 ? '1' : c.toFixed(2).slice(1)}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pa && pb && <Compare a={pa} b={pb} names={vocab} onDoc={(id) => select({ type: 'doc', id })} hostile={hostile.has(`${pa.f.id}|${pb.f.id}`)} />}
    </Insight>
  )
}

function Compare({ a, b, names, onDoc, hostile }: { a: Profile; b: Profile; names: Map<string, { name: string }>; onDoc: (id: string) => void; hostile: boolean }) {
  const { ix, select } = useApp()
  const keys = [...new Set([...a.counts.keys(), ...b.counts.keys()])]
  const shared = keys
    .map((k) => ({ k, v: Math.min(share(a, k), share(b, k)) }))
    .filter((x) => x.v > 0)
    .sort((x, y) => y.v - x.v)
    .slice(0, 12)
  const only = (p: Profile, q: Profile) => keys.filter((k) => p.counts.has(k) && !q.counts.has(k)).sort((x, y) => p.counts.get(y)! - p.counts.get(x)!).slice(0, 10)
  const term = (k: string) => {
    const [type, id] = k.split(':') as ['concept' | 'ism', string]
    return (
      <button key={k} className="chip" onClick={() => select({ type, id })}>
        {names.get(k)?.name}
      </button>
    )
  }
  const texts = (p: Profile) =>
    [...p.texts]
      .map((id) => ix.source.get(id)!)
      .sort((x, y) => x.date.localeCompare(y.date))
      .slice(0, 10)
      .map((s, i) => (
        <span key={s.id}>
          {i > 0 && '；'}
          <button className="linklike" onClick={() => onDoc(s.id)}>
            {fmtDate(s.date)} {s.alias ?? s.title}
          </button>
        </span>
      ))
  return (
    <section className="insight-detail">
      <h3>
        {a.f.name} × {b.f.name} {hostile && <small className="muted-note">两派之间有批判或迫害关系</small>}
      </h3>
      <p className="muted-note">共用最多（取两派各自比重的较小值）：</p>
      <div className="chips">{shared.map((x) => term(x.k))}</div>
      {[
        [a, b],
        [b, a],
      ].map(([p, q]) => (
        <div key={p.f.id} style={{ marginTop: 10 }}>
          <p className="muted-note">只见于{p.f.name}：</p>
          <div className="chips">{only(p, q).map(term)}</div>
          <p className="sub-note">
            {p.f.name}的文本（{p.texts.size}）：{texts(p)}
            {p.texts.size > 10 && ' 等'}
          </p>
        </div>
      ))}
    </section>
  )
}
