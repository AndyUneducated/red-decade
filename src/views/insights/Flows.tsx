import * as d3 from 'd3'
import { useMemo, useState } from 'react'
import { Cite, PersonChip } from '../../components/bits'
import { HOSTILE } from '../../components/drawer/InsightNotes'
import { factionAt } from '../../data/atlas'
import { RELATION_TYPES, type Relation } from '../../data/schema'
import { fmtDate, toT } from '../../lib/dates'
import { useApp } from '../../state'
import { Insight } from './Insight'

const PERIODS = [
  { id: 'all', label: '全部', a: -Infinity, b: Infinity },
  { id: 'pre', label: '1949–1965', a: 1949, b: 1966 },
  { id: 'cr1', label: '1966–1969', a: 1966, b: 1970 },
  { id: 'cr2', label: '1970–1976', a: 1970, b: 1977 },
  { id: 'post', label: '1977–1989', a: 1977, b: 1990 },
] as const

type Hit = { r: Relation; from: string; to: string }

export function Flows() {
  const { ix, select } = useApp()
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>('all')
  const [cell, setCell] = useState<[string, string] | null>(null)
  const hits = useMemo(
    () =>
      ix.relations.flatMap((r): Hit[] => {
        const a = ix.person.get(r.a)
        const b = ix.person.get(r.b)
        if (!HOSTILE.has(r.type) || !r.from || !a || !b) return []
        const t = toT(r.from)
        return [{ r, from: factionAt(a, t), to: factionAt(b, t) }]
      }),
    [ix],
  )
  const P = PERIODS.find((p) => p.id === period)!
  const shown = hits.filter((h) => toT(h.r.from) >= P.a && toT(h.r.from) < P.b)
  const count = d3.rollup(
    shown,
    (v) => v.length,
    (h) => h.from,
    (h) => h.to,
  )
  const factions = ix.factions.filter((f) => shown.some((h) => h.from === f.id || h.to === f.id))
  const actors = factions.filter((f) => count.has(f.id))
  const targets = factions.filter((f) => shown.some((h) => h.to === f.id))
  const max = d3.max(shown.length ? [...count.values()].flatMap((m) => [...m.values()]) : [1]) ?? 1
  const inside = shown.filter((h) => h.from === h.to).length
  const picked = cell ? shown.filter((h) => h.from === cell[0] && h.to === cell[1]) : []
  const cross = useMemo(() => ix.people.filter((p) => p.factions.length > 1), [ix])
  const pairs = useMemo(
    () =>
      [...d3.group(cross, (p) => [...p.factions].sort().join('|'))]
        .map(([k, ps]) => ({ fs: k.split('|'), ps }))
        .sort((a, b) => b.ps.length - a.ps.length),
    [cross],
  )

  return (
    <Insight
      question="批判和诬陷从哪一派指向哪一派？一派之内的互相攻击有多少？哪些人同时属于两个派系？"
      method={`取人物关系中有日期的“批判/攻击”“诬陷/迫害”（${hits.length} 条），按双方在该日期所属的派系归入矩阵：行是发起方，列是被攻击方，格中是条数。对角线（同派相攻）另行统计。下方列出档案中属于两个以上派系的人。`}
      caveats="派系是本站为叙述划分的群体，不是当事人自认的组织；一人多派时，未注明时段的取第一派系。关系表只收已建档人物之间、有出处的关系，攻击普通人的大量事实不在其中。"
    >
      <div className="chips" style={{ marginBottom: 12 }}>
        {PERIODS.map((p) => (
          <button
            key={p.id}
            className="chip"
            aria-pressed={p.id === period}
            onClick={() => {
              setPeriod(p.id)
              setCell(null)
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="sub-note" style={{ marginTop: 0 }}>
        {shown.length} 条，其中同派相攻 {inside} 条。
      </p>
      <div className="flow-wrap">
        <table className="flow">
          <thead>
            <tr>
              <th className="corner">发起 ↓ 　对象 →</th>
              {targets.map((f) => (
                <th key={f.id} className="col">
                  <span>{f.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {actors.map((a) => (
              <tr key={a.id}>
                <th>
                  <i style={{ background: a.color }} />
                  {a.name}
                </th>
                {targets.map((b) => {
                  const n = count.get(a.id)?.get(b.id) ?? 0
                  const on = cell?.[0] === a.id && cell?.[1] === b.id
                  return (
                    <td key={b.id}>
                      {n > 0 && (
                        <button
                          aria-pressed={on}
                          style={{ background: `color-mix(in srgb, var(--accent) ${Math.round(15 + (85 * n) / max)}%, transparent)`, outline: a.id === b.id ? '1px dashed var(--ink-2)' : undefined }}
                          onClick={() => setCell(on ? null : [a.id, b.id])}
                          title={`${a.name} → ${b.name}：${n} 条`}
                        >
                          {n}
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
      {cell && (
        <section className="insight-detail">
          <h3>
            {ix.faction.get(cell[0])?.name} → {ix.faction.get(cell[1])?.name}
          </h3>
          <ul className="minilist">
            {picked
              .sort((m, n) => toT(m.r.from) - toT(n.r.from))
              .map((h, i) => (
                <li key={i}>
                  <time>{fmtDate(h.r.from)}</time>
                  <PersonChip id={h.r.a} /> {RELATION_TYPES[h.r.type]} → <PersonChip id={h.r.b} />
                  {h.r.note && <span> {h.r.note}</span>} <Cite cite={h.r.cite} />
                </li>
              ))}
          </ul>
        </section>
      )}
      <section className="insight-detail">
        <h3>跨派系的人（{cross.length}）</h3>
        <ul className="minilist">
          {pairs.map(({ fs, ps }) => (
            <li key={fs.join()}>
              <span style={{ marginRight: 8 }}>
                {fs.map((f) => (
                  <button key={f} className="linklike" style={{ marginRight: 6 }} onClick={() => select({ type: 'faction', id: f })}>
                    <i className="dot" style={{ background: ix.faction.get(f)?.color }} /> {ix.faction.get(f)?.name ?? f}
                  </button>
                ))}
              </span>
              <span className="chips" style={{ display: 'inline-flex' }}>
                {ps.map((p) => (
                  <PersonChip key={p.id} id={p.id} />
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </Insight>
  )
}
