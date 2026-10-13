import * as d3 from 'd3'
import { useMemo, useState } from 'react'
import { PersonChip, StatusDot } from '../../components/bits'
import { factionAt } from '../../data/atlas'
import { STATUSES, type Faction, type Person } from '../../data/schema'
import { kaplanMeier, survivalSubject, type Subject } from '../../derive/fates'
import { fmtT, toT } from '../../lib/dates'
import { useApp } from '../../state'
import { Insight } from './Insight'
import { FALLS, SURVIVAL_T0 as T0, SURVIVAL_T1 as T1 } from './shared'

const MIN_N = 5
const W = 220
const H = 112
const M = { l: 26, r: 6, t: 6, b: 16 }
const x = d3.scaleLinear().domain([T0, T1]).range([M.l, W - M.r])
const y = d3.scaleLinear().domain([0, 1]).range([H - M.b, M.t])

type Row = { p: Person; s: Subject }
type Curve = ReturnType<typeof kaplanMeier>

const path = (km: Curve) =>
  d3
    .line<{ t: number; s: number }>()
    .x((d) => x(d.t))
    .y((d) => y(d.s))
    .curve(d3.curveStepAfter)([...km, { t: T1, s: km.at(-1)!.s }])!

const median = (km: Curve) => km.find((k) => k.s <= 0.5)?.t

export function Survival() {
  const { ix } = useApp()
  const [mode, setMode] = useState<'strict' | 'wide'>('strict')
  const [open, setOpen] = useState<string | null>(null)
  const { all, groups } = useMemo(() => {
    const rows = ix.people.flatMap((p) => {
      const s = survivalSubject(p, T0, T1, FALLS[mode])
      return s ? [{ p, s, f: factionAt(p, T0) }] : []
    })
    const groups = [...d3.group(rows, (r) => r.f)]
      .filter(([f, rs]) => rs.length >= MIN_N && ix.faction.has(f))
      .map(([f, rs]) => ({ faction: ix.faction.get(f)!, rows: rs as Row[], km: kaplanMeier(rs.map((r) => r.s), T0) }))
      .sort((a, b) => a.km.at(-1)!.s - b.km.at(-1)!.s || (median(a.km) ?? T1) - (median(b.km) ?? T1))
    return { all: { rows: rows as Row[], km: kaplanMeier(rows.map((r) => r.s), T0) }, groups }
  }, [ix, mode])
  const opened = groups.find((g) => g.faction.id === open)

  return (
    <Insight
      question="1965 年 11 月《评新编历史剧〈海瑞罢官〉》发表时，各派的人还有多少站着？他们在什么时候倒下，哪一派倒得最快、最彻底？"
      method={
        <>
          每人取 1965 年 11 月时所属的派系（人物档案的 memberships；没有则取第一派系）。从这时起，第一次出现“被打倒”或“关押”（宽口径另加“受批判”“靠边”）的命运节点、或非正常死亡（被迫害致死、自杀、被杀、处决），记为倒下。病故或到 1978 年底仍未倒下的人，在死亡或 1978 年底退出观察（删失）。曲线用 Kaplan–Meier 方法：每次有人倒下时，用当时仍在观察中的人数作分母。灰线是全部 {all.rows.length} 人。只画此刻至少 {MIN_N} 人的派系。
        </>
      }
      caveats="样本是本站已建档的人物，偏向高层和受冲击者，不是任何群体的随机样本；曲线说的是“本站收录的这一派人”，不能外推到全派。1965 年 11 月前已被打倒或关押的人（如彭德怀）、没有命运记录的人不计入。日期只到月的节点按月初计。"
    >
      <div className="chips" role="group" aria-label="口径" style={{ marginBottom: 14 }}>
        {(['strict', 'wide'] as const).map((m) => (
          <button key={m} className="chip" aria-pressed={mode === m} onClick={() => setMode(m)}>
            {m === 'strict' ? '严格：被打倒、关押、非正常死亡' : '宽：另含受批判、靠边'}
          </button>
        ))}
      </div>
      <div className="multiples">
        {groups.map((g) => (
          <Panel key={g.faction.id} f={g.faction} n={g.rows.length} km={g.km} ref_={all.km} on={open === g.faction.id} toggle={() => setOpen(open === g.faction.id ? null : g.faction.id)} />
        ))}
      </div>
      {opened && <Members f={opened.faction} rows={opened.rows} />}
    </Insight>
  )
}

function Panel({ f, n, km, ref_, on, toggle }: { f: Faction; n: number; km: Curve; ref_: Curve; on: boolean; toggle: () => void }) {
  const mid = median(km)
  const last = km.at(-1)!.s
  return (
    <button className="panel" aria-pressed={on} onClick={toggle}>
      <div className="panel-title">
        <i style={{ background: f.color }} />
        {f.name} <small>{n} 人</small>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-hidden>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--rule)" />
            <text x={M.l - 4} y={y(v) + 3} textAnchor="end" className="tick">
              {v * 100}%
            </text>
          </g>
        ))}
        {[1966, 1970, 1974, 1978].map((yr) => (
          <text key={yr} x={x(yr)} y={H - 3} textAnchor="middle" className="tick">
            {yr}
          </text>
        ))}
        <path d={path(ref_)} fill="none" stroke="var(--muted)" strokeWidth={1} strokeDasharray="2 2" />
        <path d={path(km)} fill="none" stroke={f.color} strokeWidth={1.8} />
      </svg>
      <div className="panel-foot">
        {mid ? `半数倒下：${fmtT(mid, 'month')}` : '未到半数'} · 1978 年底仍站着 {Math.round(last * 100)}%
      </div>
    </button>
  )
}

function Members({ f, rows }: { f: Faction; rows: Row[] }) {
  const sorted = [...rows].sort((a, b) => Number(b.s.fell) - Number(a.s.fell) || a.s.t - b.s.t)
  return (
    <section className="insight-detail">
      <h3>{f.name}：逐人</h3>
      <ul className="minilist">
        {sorted.map(({ p, s }) => {
          const node = s.fell ? p.fate.find((x) => toT(x.date) === s.t) : undefined
          return (
            <li key={p.id}>
              <time>{s.fell ? fmtT(s.t, 'month') : '—'}</time>
              <StatusDot s={node?.s ?? (s.fell ? 'dead' : undefined)} /> <PersonChip id={p.id} />
              <span style={{ color: 'var(--muted)', marginLeft: 6, fontSize: 11.5 }}>
                {node ? `${STATUSES[node.s]}${node.note ? ' · ' + node.note : ''}` : s.fell ? '非正常死亡' : p.died && s.t < T1 ? '病故，此后不再观察' : '到 1978 年底未倒下'}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
