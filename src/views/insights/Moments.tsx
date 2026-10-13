import * as d3 from 'd3'
import { useMemo, useState } from 'react'
import { Cite, PersonChip } from '../../components/bits'
import { VOICES, type Person, type PersonQuote } from '../../data/schema'
import { fmtDate, toT } from '../../lib/dates'
import { useApp } from '../../state'
import { Insight } from './Insight'

// editorial periods, each ending where the next begins; quotes are sorted into them by date
const PERIODS: { from: string; title: string }[] = [
  { from: '1900', title: '文革之前' },
  { from: '1966-03', title: '发动：从五人小组被撤销到“红八月”' },
  { from: '1966-10', title: '批判“资产阶级反动路线”与夺权' },
  { from: '1967-03', title: '全面内战与“揪军内一小撮”' },
  { from: '1968-01', title: '清理阶级队伍到九大' },
  { from: '1969-05', title: '九大到十大：林彪事件前后' },
  { from: '1974-01', title: '批林批孔到毛泽东去世' },
  { from: '1976-10', title: '粉碎“四人帮”到历史决议' },
  { from: '1981-07', title: '八十年代' },
]

type Said = { p: Person; q: PersonQuote; t: number }

export function Moments() {
  const { ix, sel } = useApp()
  const said = useMemo(
    () =>
      ix.people
        .flatMap((p) => p.quotes.filter((q) => q.date && !q.by).map((q): Said => ({ p, q, t: toT(q.date) })))
        .sort((a, b) => a.t - b.t),
    [ix],
  )
  // opened from a person's card: start with that person
  const [who, setWho] = useState<string | null>(() => (sel?.type === 'person' && said.some((s) => s.p.id === sel.id) ? sel.id : null))
  const repeat = useMemo(() => {
    const periodOf = (t: number) => d3.bisectRight(PERIODS.map((x) => toT(x.from)), t)
    return [...d3.rollup(said, (v) => new Set(v.map((s) => periodOf(s.t))).size, (s) => s.p.id)]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
  }, [said])
  const shown = who ? said.filter((s) => s.p.id === who) : said
  const periods = PERIODS.map((x, i) => {
    const a = toT(x.from)
    const b = PERIODS[i + 1] ? toT(PERIODS[i + 1].from) : Infinity
    return { ...x, items: shown.filter((s) => s.t >= a && s.t < b) }
  }).filter((x) => x.items.length)

  return (
    <Insight
      question="在每一个转折关头，谁先开口、说了什么？同一个人在不同时期说的话放在一起，前后是否一致？"
      method={`收集人物档案中本人所说、带日期的引语（${said.length} 条），全部为出处原文，构建时逐字核对。按日期排进编者划分的九个时期；同一时期内按先后排列，可以看出谁先表态、谁跟进。上方“跨时期”列出在两个以上时期都有引语的人，点名字只看此人。`}
      caveats="引语是本站为人物档案挑选的，不是每人在每个时期的全部发言，没有引语不等于沉默。只到年份或月份的日期排在该年、该月之初。时期的划分是编者的判断。"
    >
      <div className="chips" style={{ marginBottom: 14, alignItems: 'center' }}>
        <span className="muted-note" style={{ margin: 0 }}>
          跨时期：
        </span>
        {who && (
          <button className="chip" onClick={() => setWho(null)}>
            全部
          </button>
        )}
        {repeat.map(([id, n]) => (
          <button key={id} className="chip" aria-pressed={who === id} onClick={() => setWho(who === id ? null : id)}>
            {ix.person.get(id)!.name} <small>{n}</small>
          </button>
        ))}
      </div>
      {periods.map((x) => (
        <section key={x.from} className="insight-detail moments">
          <h3>
            {x.title} <small className="muted-note">{new Set(x.items.map((s) => s.p.id)).size} 人 · {x.items.length} 条</small>
          </h3>
          {x.items.map(({ p, q }, i) => (
            <blockquote key={i} className="said">
              <div className="said-head">
                <time>{fmtDate(q.date)}</time> <PersonChip id={p.id} />
                <span className="muted-note"> {[q.voice && VOICES[q.voice], q.note].filter(Boolean).join(' · ')}</span>
              </div>
              <p>“{q.text}” <Cite cite={q.cite} /></p>
            </blockquote>
          ))}
        </section>
      ))}
    </Insight>
  )
}
