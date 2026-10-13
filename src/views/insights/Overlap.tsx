import * as d3 from 'd3'
import { useMemo, useRef, useState } from 'react'
import { Cite, PersonChip, StatusDot } from '../../components/bits'
import { LifeStrip } from '../../components/LifeStrip'
import { DEATH_KINDS, RELATION_TYPES, STATUSES, type Person, type Relation, type Status } from '../../data/schema'
import { fallsSince } from '../../derive/fates'
import { fmtDate, toT } from '../../lib/dates'
import { useSize } from '../../lib/useSize'
import { useApp } from '../../state'
import { Insight } from './Insight'

const T0 = toT('1949-10')
const T1 = toT('1989-12', true)
const FALLS: ReadonlySet<Status> = new Set(['purged', 'detained'])
const HOSTILE: ReadonlySet<Relation['type']> = new Set(['attack', 'persecute'])

type Kind = 'then-fell' | 'fell-first' | 'stood'
const KINDS: Record<Kind, { title: string; note: string }> = {
  'then-fell': { title: '加害之后被打倒', note: '第一次批判或诬陷他人之后，自己被打倒、关押或非正常死亡' },
  'fell-first': { title: '受害在先', note: '被打倒发生在第一次加害之前，此后再没有倒下' },
  stood: { title: '始终未倒', note: '1949 年 10 月以后没有被打倒或关押的记录' },
}

type Row = { p: Person; acts: Relation[]; falls: Person['fate']; kind: Kind; targeted: number }

export function Overlap() {
  const { ix } = useApp()
  const [open, setOpen] = useState<string | null>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const { width } = useSize(wrap)
  const rows = useMemo(() => {
    const hostile = ix.relations.filter((r) => HOSTILE.has(r.type) && r.from)
    const byActor = d3.group(hostile, (r) => r.a)
    const targeted = d3.rollup(hostile, (v) => v.length, (r) => r.b)
    return [...byActor]
      .flatMap(([id, acts]): Row[] => {
        const p = ix.person.get(id)
        if (!p) return []
        const sorted = [...acts].sort((a, b) => a.from!.localeCompare(b.from!))
        const falls = fallsSince(p, T0, FALLS)
        const first = toT(sorted[0].from)
        const kind: Kind = falls.some((f) => toT(f.date) >= first) ? 'then-fell' : falls.length ? 'fell-first' : 'stood'
        return [{ p, acts: sorted, falls, kind, targeted: targeted.get(id) ?? 0 }]
      })
      .sort((a, b) => a.acts[0].from!.localeCompare(b.acts[0].from!))
  }, [ix])
  const groups = (Object.keys(KINDS) as Kind[]).map((k) => ({ k, rows: rows.filter((r) => r.kind === k) }))
  const nameW = width < 600 ? 70 : 130
  const stripW = Math.max(160, width - nameW - 4)
  const x = d3.scaleLinear().domain([T0, T1]).range([0, stripW])

  return (
    <Insight
      question={`本站记录了 ${rows.length} 个人对他人的批判或诬陷。动手的人后来自己有多少被打倒？加害与受害在同一个人身上是什么顺序？`}
      method="取人物关系中类型为“批判/攻击”和“诬陷/迫害”、有日期的记录，按发起者归人。被打倒指 1949 年 10 月以后命运节点为“被打倒”或“关押”，或非正常死亡（被迫害致死、自杀、被杀、处决）。色带是本人一生的状态，三角是每一次加害（位置为该关系的起始日期），点开一行看每次加害的对象和出处。"
      caveats="关系表只收有出处的、本站已建档人物之间的关系，许多加害（尤其对普通人的）不在其中；“始终未倒”的人数因此只说明本站记录，不说明此人没有受过冲击。加害与受害并列，不表示二者分量相当。"
    >
      <p className="sub-note" style={{ marginTop: 0 }}>
        {groups.map((g) => `${KINDS[g.k].title} ${g.rows.length} 人`).join(' · ')}
      </p>
      <div ref={wrap}>
        <div className="overlap-axis" style={{ marginLeft: nameW }}>
          <svg width={stripW} height={14} aria-hidden>
            {[1953, 1960, 1966, 1970, 1976, 1980, 1986].map((yr) => (
              <text key={yr} x={x(yr)} y={11} textAnchor="middle" fontSize={10} fill="var(--muted)">
                {yr}
              </text>
            ))}
          </svg>
        </div>
        {groups.map(
          (g) =>
            g.rows.length > 0 && (
              <section key={g.k} className="insight-detail" style={{ maxWidth: 'none' }}>
                <h3>
                  {KINDS[g.k].title}（{g.rows.length}）<small className="muted-note"> {KINDS[g.k].note}</small>
                </h3>
                {g.rows.map((r) => (
                  <div key={r.p.id} className="overlap-row">
                    <button className="overlap-head" style={{ gridTemplateColumns: `${nameW}px minmax(0, 1fr)` }} aria-expanded={open === r.p.id} onClick={() => setOpen(open === r.p.id ? null : r.p.id)}>
                      <b>{r.p.name}</b>
                      <span className="strip">
                        <LifeStrip p={r.p} x={x} T1={T1} height={8} width={stripW} />
                        <svg width={stripW} height={8} style={{ display: 'block', overflow: 'visible' }} aria-hidden>
                          {r.acts.map((a, i) => (
                            <path key={i} d={`M${x(toT(a.from))},0 l-3.5,7 h7 z`} fill={a.type === 'persecute' ? 'var(--accent)' : 'var(--ink-2)'} />
                          ))}
                        </svg>
                      </span>
                    </button>
                    {open === r.p.id && <Detail r={r} />}
                  </div>
                ))}
              </section>
            ),
        )}
      </div>
    </Insight>
  )
}

type Item = { date: string; a?: Relation; f?: Person['fate'][number] }

function Detail({ r }: { r: Row }) {
  return (
    <div className="overlap-detail">
      <div>
        <PersonChip id={r.p.id} />
        {r.targeted > 0 && <span className="muted-note"> 本人也是 {r.targeted} 条批判或诬陷关系的对象</span>}
      </div>
      <ul className="minilist">
        {[...r.acts.map((a): Item => ({ date: a.from!, a })), ...r.falls.map((f): Item => ({ date: f.date, f }))]
          .sort((m, n) => toT(m.date) - toT(n.date))
          .map(({ date, a, f }, i) => (
            <li key={i}>
              <time>{fmtDate(date)}</time>
              {a && (
                <>
                  <span style={{ color: a.type === 'persecute' ? 'var(--accent)' : 'var(--ink-2)' }}>▲ {RELATION_TYPES[a.type]}</span> <PersonChip id={a.b} />
                  {a.note && <span> {a.note}</span>} <Cite cite={a.cite} />
                </>
              )}
              {f && (
                <>
                  <StatusDot s={f.s} /> {STATUSES[f.s]}
                  {f.s === 'dead' && r.p.deathKind && `（${DEATH_KINDS[r.p.deathKind]}）`}
                  {f.note && ` · ${f.note}`} <Cite cite={f.cite} />
                </>
              )}
            </li>
          ))}
      </ul>
    </div>
  )
}
