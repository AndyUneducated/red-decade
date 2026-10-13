import * as d3 from 'd3'
import { useMemo, useRef } from 'react'
import { LifeStrip } from '../../components/LifeStrip'
import { lifeDistance, yearCodes } from '../../derive/fates'
import { useSize } from '../../lib/useSize'
import { useApp } from '../../state'
import { Insight } from './Insight'

const YEARS = d3.range(1960, 1986)
// 1960–1966: the years before the Cultural Revolution that two lives must share to count as one starting point
const EARLY = 7
const DEFAULT = 'liu-shaoqi'

type Match = { id: string; d: number }

export function Parallel() {
  const { ix, sel, select } = useApp()
  const wrap = useRef<HTMLDivElement>(null)
  const { width } = useSize(wrap)
  const codes = useMemo(() => new Map(ix.people.filter((p) => p.fate.length >= 2).map((p) => [p.id, yearCodes(p, YEARS)])), [ix])
  const id = sel?.type === 'person' && codes.has(sel.id) ? sel.id : DEFAULT
  const { near, split } = useMemo(() => {
    const me = codes.get(id)
    if (!me) return { near: [], split: [] }
    const others = [...codes].filter(([o]) => o !== id)
    const near = others
      .flatMap(([o, c]): Match[] => {
        const d = lifeDistance(me, c)
        return d === undefined ? [] : [{ id: o, d }]
      })
      .sort((a, b) => a.d - b.d)
      .slice(0, 8)
    const split = others
      .flatMap(([o, c]): Match[] => {
        const early = lifeDistance(me.slice(0, EARLY), c.slice(0, EARLY), 5)
        const late = lifeDistance(me.slice(EARLY), c.slice(EARLY), 8)
        return early === 0 && late !== undefined && late >= 0.5 ? [{ id: o, d: late }] : []
      })
      .sort((a, b) => b.d - a.d)
      .slice(0, 8)
    return { near, split }
  }, [codes, id])
  const options = useMemo(() => [...codes.keys()].map((k) => ix.person.get(k)!).sort((a, b) => a.name.localeCompare(b.name, 'zh')), [codes, ix])

  const nameW = width < 600 ? 70 : 120
  const tagW = 64
  const stripW = Math.max(140, width - nameW - tagW - 8)
  const x = d3.scaleLinear().domain([1960, 1986]).range([0, stripW])
  const row = (m: Match | { id: string; d?: undefined }, label?: string) => {
    const p = ix.person.get(m.id)!
    return (
      <button key={m.id} className="overlap-head" style={{ gridTemplateColumns: `${nameW}px minmax(0, 1fr) ${tagW}px` }} onClick={() => select({ type: 'person', id: m.id })}>
        <b>{p.name}</b>
        <span className="strip">
          <LifeStrip p={p} x={x} T1={1986} height={10} width={stripW} />
        </span>
        <small className="muted-note" style={{ margin: 0, textAlign: 'right' }}>
          {label ?? `${Math.round((1 - m.d!) * 100)}% 相同`}
        </small>
      </button>
    )
  }

  return (
    <Insight
      question="谁的命运和这个人最像？同样在 1966 年前处境相同的人，后来谁走上了完全不同的路？"
      method={`每人每年取年中的状态，归为五类：掌权（崛起、掌权）、常态（常态、复出）、受冲击（受批判、靠边）、倒下（被打倒、关押）、死亡。两人之间的差异＝ 1960–1985 年中状态不同的年数 ÷ 至少一人在世且两人状态都已知的年数（至少 10 年）。“同起点、不同结局”：1960–1966 年五类状态逐年相同（至少 5 年可比），1967–1985 年至少一半年份不同。点任何一行改看此人。`}
      caveats="只比较状态的类别和时间，不比较职位高低、受冲击的程度或原因；同属“倒下”的一年，可能一个在秦城、一个在干校。只收至少有两个命运节点的人。"
    >
      <div className="chips" style={{ marginBottom: 12, alignItems: 'center' }}>
        <label className="muted-note" style={{ margin: 0 }}>
          人物{' '}
          <select className="field" value={id} onChange={(e) => select({ type: 'person', id: e.target.value })}>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div ref={wrap} style={{ maxWidth: 1100 }}>
        <div className="overlap-axis" style={{ marginLeft: nameW }}>
          <svg width={stripW} height={14} aria-hidden>
            {[1960, 1966, 1970, 1976, 1980, 1985].map((yr) => (
              <text key={yr} x={x(yr + 0.5)} y={11} textAnchor="middle" fontSize={10} fill="var(--muted)">
                {yr}
              </text>
            ))}
          </svg>
        </div>
        {codes.has(id) && row({ id }, '本人')}
        <section className="insight-detail" style={{ maxWidth: 'none' }}>
          <h3>命运最相近</h3>
          {near.map((m) => row(m))}
        </section>
        <section className="insight-detail" style={{ maxWidth: 'none' }}>
          <h3>
            同起点、不同结局 <small className="muted-note">1960–1966 年处境相同，此后至少一半年份不同</small>
          </h3>
          {split.length ? split.map((m) => row(m, `${Math.round(m.d * 100)}% 不同`)) : <p className="muted-note">本站人物中没有符合条件的人。</p>}
        </section>
      </div>
    </Insight>
  )
}
