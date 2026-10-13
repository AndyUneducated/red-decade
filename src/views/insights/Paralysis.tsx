import * as d3 from 'd3'
import { useMemo, useRef } from 'react'
import { Cite, Entity, PersonChip } from '../../components/bits'
import { ORG_KINDS, REVCOM_DATES, type Org } from '../../data/schema'
import { fmtDate, fmtT, toT } from '../../lib/dates'
import { existsAt, KIND_ORDER, suspendedAt } from '../../lib/orgs'
import { heldAt, systemOf } from '../../lib/positions'
import { useSize } from '../../lib/useSize'
import { useApp } from '../../state'
import { Insight } from './Insight'
import { PARALYSIS_T0 as T0, PARALYSIS_T1 as T1 } from './shared'
const MONTHS = d3.range(T0 * 12, T1 * 12).map((m) => m / 12)
const H = 220
const M = { l: 34, r: 12, t: 10, b: 52 }

export function Paralysis() {
  const { ix, select } = useApp()
  const wrap = useRef<HTMLDivElement>(null)
  const { width } = useSize(wrap)
  const { stacked, max, peak, takeovers } = useMemo(() => {
    const rows = MONTHS.map((t) => {
      const r: Record<string, number> = { t }
      for (const k of KIND_ORDER) r[k] = 0
      for (const o of ix.orgs) if (existsAt(o, t) && suspendedAt(o, t)) r[o.kind]++
      return r
    })
    const stacked = d3.stack<Record<string, number>>().keys(KIND_ORDER)(rows)
    const totals = rows.map((r) => KIND_ORDER.reduce((n, k) => n + r[k], 0))
    const max = d3.max(totals) ?? 1
    // provincial party committees: how many existed and how many of them had stopped working, at the worst month
    const prov = ix.orgs.filter((o) => o.kind === 'party' && o.level === 'provincial')
    const peak = d3.greatest(
      MONTHS.map((t) => ({ t, n: prov.filter((o) => existsAt(o, t) && suspendedAt(o, t)).length, of: prov.filter((o) => existsAt(o, t)).length })),
      (x) => x.n,
    )!
    const takeovers = ix.orgs
      .flatMap((o) => o.links.filter((l) => l.kind === 'takeover' && l.date).map((l) => ({ by: o, of: ix.org.get(l.org), date: l.date!, cite: l.cite })))
      .filter((x): x is { by: Org; of: Org; date: string; cite: string | undefined } => !!x.of)
      .sort((a, b) => toT(a.date) - toT(b.date))
    return { stacked, max, peak, takeovers }
  }, [ix])
  const chairs = useMemo(
    () =>
      ix.revcoms.map((r) => {
        const o = ix.org.get(r.org)
        const t = toT(r.date)
        const chairsOf = o?.leaders.filter((l) => /主任/.test(l.title) && !/副/.test(l.title)) ?? []
        const head = chairsOf.find((l) => heldAt(l, t + 1 / 24)) ?? chairsOf[0]
        const p = head?.person ? ix.person.get(head.person) : undefined
        const army = p?.positions.filter((x) => heldAt(x, t + 1 / 24) && (systemOf(x) === 'army' || (x.org && ix.org.get(x.org)?.kind === 'army')))
        return { r, o, head, p, army }
      }),
    [ix],
  )
  const withArmy = chairs.filter((c) => c.army?.length).length
  const known = chairs.filter((c) => c.p).length

  const W = Math.max(320, width)
  const x = d3.scaleLinear().domain([T0, T1]).range([M.l, W - M.r])
  const y = d3.scaleLinear().domain([0, max]).nice().range([H - M.b, M.t])
  const area = d3
    .area<d3.SeriesPoint<Record<string, number>>>()
    .x((d) => x(d.data.t))
    .y0((d) => y(d[0]))
    .y1((d) => y(d[1]))
    .curve(d3.curveStepAfter)

  return (
    <Insight
      question="党政机构是在什么时候、以什么顺序停止运转的？谁接管了它们？革委会的第一把手同时是不是军人？"
      method={`逐月统计机构档案中处于“停止活动”时期、且当时仍存在的机构数，按党、政、军、群团、群众组织、单位分色堆叠。下方第一行刻度是机构档案里有日期的“夺权 / 接管”（${takeovers.length} 次），第二行是省级革委会成立或夺权的日期（${ix.revcoms.length} 个，逐条附报道原文）。下表的“同时期军职”只取本站人物档案中革委会成立当月在任的军队职务。`}
      caveats={`机构档案收的是本站涉及的机构（${ix.orgs.length} 个），基层单位和地方机构远不完整，曲线的高低只在本站范围内有意义。“停止活动”的起止多为月份或年份，按月初、年初计。${ix.revcoms.length} 位省级革委会主任中只有 ${known} 人在本站建档，“同时期军职”一栏空白不表示此人不是军人。`}
    >
      <p className="sub-note" style={{ marginTop: 0 }}>
        省级党委停止运转最多时：{fmtT(peak.t, 'month')}，{peak.of} 个中 {peak.n} 个。省级革委会主任中，本站档案记有同时期军职的至少 {withArmy} 人。
      </p>
      <div ref={wrap} style={{ maxWidth: 1200 }}>
        <svg width={W} height={H} style={{ display: 'block' }}>
          {y.ticks(5).map((v) => (
            <g key={v}>
              <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--rule)" />
              <text x={M.l - 5} y={y(v) + 3} textAnchor="end" fontSize={10} fill="var(--muted)">
                {v}
              </text>
            </g>
          ))}
          {stacked.map((s) => (
            <path key={s.key} d={area(s)!} fill={`var(--org-${s.key})`} fillOpacity={0.85}>
              <title>{ORG_KINDS[s.key as keyof typeof ORG_KINDS]}</title>
            </path>
          ))}
          {d3.range(T0, T1 + 1, 2).map((yr) => (
            <text key={yr} x={x(yr)} y={H - M.b + 13} textAnchor="middle" fontSize={10} fill="var(--muted)">
              {yr}
            </text>
          ))}
          <text x={M.l} y={H - 22} fontSize={10} fill="var(--muted)">
            接管
          </text>
          {takeovers.map((k, i) => (
            <line key={i} x1={x(toT(k.date))} x2={x(toT(k.date))} y1={H - 32} y2={H - 24} stroke="var(--ink-2)">
              <title>{`${fmtDate(k.date)} ${k.by.short ?? k.by.name} → ${k.of.short ?? k.of.name}`}</title>
            </line>
          ))}
          <text x={M.l} y={H - 6} fontSize={10} fill="var(--muted)">
            革委会
          </text>
          {ix.revcoms.map((r) => (
            <line key={r.org} x1={x(toT(r.date))} x2={x(toT(r.date))} y1={H - 16} y2={H - 8} stroke="var(--accent)">
              <title>{`${fmtDate(r.date)} ${r.province}`}</title>
            </line>
          ))}
        </svg>
        <div className="chips" style={{ margin: '6px 0 0 34px' }}>
          {KIND_ORDER.map((k) => (
            <span key={k} className="chip nolink">
              <i style={{ background: `var(--org-${k})` }} />
              {ORG_KINDS[k]}
            </span>
          ))}
        </div>
      </div>
      <section className="insight-detail" style={{ maxWidth: 1000 }}>
        <h3>省级革委会：成立日期与第一把手</h3>
        <table className="sources">
          <thead>
            <tr>
              <th>日期</th>
              <th>省份</th>
              <th>主任</th>
              <th>同时期军职（本站记录）</th>
              <th>出处</th>
            </tr>
          </thead>
          <tbody>
            {chairs.map(({ r, o, head, p, army }) => (
              <tr key={r.org}>
                <td className="num">
                  {fmtDate(r.date)} <small>{REVCOM_DATES[r.kind]}</small>
                </td>
                <td>{o ? <Entity refTo={{ type: 'org', id: o.id }}>{r.province}</Entity> : r.province}</td>
                <td>{p ? <PersonChip id={p.id} /> : (head?.name ?? '—')}</td>
                <td>{army?.length ? army.map((x) => x.title).join('、') : p ? '' : <span className="muted-note">未建档</span>}</td>
                <td>
                  <Cite cite={r.cite} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="insight-detail">
        <h3>夺权与接管（{takeovers.length}）</h3>
        <ul className="minilist">
          {takeovers.map((k, i) => (
            <li key={i}>
              <time>{fmtDate(k.date)}</time>
              <button className="linklike" onClick={() => select({ type: 'org', id: k.by.id })}>
                {k.by.short ?? k.by.name}
              </button>{' '}
              → <button className="linklike" onClick={() => select({ type: 'org', id: k.of.id })}>{k.of.short ?? k.of.name}</button> <Cite cite={k.cite} />
            </li>
          ))}
        </ul>
      </section>
    </Insight>
  )
}
