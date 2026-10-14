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
const H = 236
const M = { l: 34, r: 12, t: 10, b: 68 }
// tick rows under the chart: label baseline, ticks drawn just above it
const ROWS = [H - 38, H - 22, H - 6]
// the rollout chart: months of 1967–1968, and the provinces with enough county dates to draw a line
const R0 = 1967
const R1 = 1969
const RH = 180
const RM = { l: 34, r: 12, t: 10, b: 22 }
const MIN_COUNTIES = 5

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
  // county revcoms from county gazetteers and 1980s chronicles, against their own province's revcom
  const counties = useMemo(
    () =>
      ix.counties
        .filter((u) => u.revcom)
        .map((u) => ({ u, rc: u.revcom!, t: toT(u.revcom!.date) }))
        .sort((a, b) => a.t - b.t),
    [ix],
  )
  const rollout = useMemo(() => {
    const line = (name: string, ts: number[], color: string, of?: { date: string; province: string }) => ({
      name,
      ts: [...ts].sort((a, b) => a - b),
      color,
      of,
    })
    const groups = d3.groups(counties, (c) => c.u.province).filter(([, l]) => l.length >= MIN_COUNTIES)
    return [
      line(`省级（${ix.revcoms.length}）`, ix.revcoms.map((r) => toT(r.date)), 'var(--accent)'),
      ...groups.map(([p, l], i) => {
        const own = ix.revcoms.find((r) => r.province.startsWith(p))
        return line(`${p}县市（${l.length}）`, l.map((c) => c.t), ['var(--org-state)', 'var(--org-popular)', 'var(--org-mass)'][i % 3], own)
      }),
    ]
  }, [counties, ix])

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
      method={`逐月统计机构档案中处于“停止活动”时期、且当时仍存在的机构数，按党、政、军、群团、群众组织、单位分色堆叠。下方第一行刻度是机构档案里有日期的“夺权 / 接管”（${takeovers.length} 次），第二行是省级革委会成立或夺权的日期（${ix.revcoms.length} 个，逐条附报道原文），第三行是县市一级革委会成立的日期（${counties.length} 个，出自县志和 1980 年代各县的文革大事记，逐条附原文）。下表的“同时期军职”只取本站人物档案中革委会成立当月在任的军队职务。`}
      caveats={`机构档案收的是本站涉及的机构（${ix.orgs.length} 个），基层单位和地方机构远不完整，曲线的高低只在本站范围内有意义。“停止活动”的起止多为月份或年份，按月初、年初计。${ix.revcoms.length} 位省级革委会主任中只有 ${known} 人在本站建档，“同时期军职”一栏空白不表示此人不是军人。县市革委会只有本站按县登记的 ${ix.counties.length} 个县市中找得到日期的那些，集中在广西、山东两省；有的记批准之日，有的记庆祝大会之日，各条注明。`}
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
          <text x={M.l} y={ROWS[0]} fontSize={10} fill="var(--muted)">
            接管
          </text>
          {takeovers.map((k, i) => (
            <line key={i} x1={x(toT(k.date))} x2={x(toT(k.date))} y1={ROWS[0] - 10} y2={ROWS[0] - 2} stroke="var(--ink-2)">
              <title>{`${fmtDate(k.date)} ${k.by.short ?? k.by.name} → ${k.of.short ?? k.of.name}`}</title>
            </line>
          ))}
          <text x={M.l} y={ROWS[1]} fontSize={10} fill="var(--muted)">
            省革委会
          </text>
          {ix.revcoms.map((r) => (
            <line key={r.org} x1={x(toT(r.date))} x2={x(toT(r.date))} y1={ROWS[1] - 10} y2={ROWS[1] - 2} stroke="var(--accent)">
              <title>{`${fmtDate(r.date)} ${r.province}`}</title>
            </line>
          ))}
          <text x={M.l} y={ROWS[2]} fontSize={10} fill="var(--muted)">
            县革委会
          </text>
          {counties.map(({ u, rc, t }) => (
            <line key={u.id} x1={x(t)} x2={x(t)} y1={ROWS[2] - 10} y2={ROWS[2] - 2} stroke="var(--org-party)" strokeOpacity={0.7}>
              <title>{`${fmtDate(rc.date)} ${u.province}${u.name}`}</title>
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
      <section className="insight-detail" style={{ maxWidth: 1000 }}>
        <h3>县市革委会：成立进度（{counties.length}）</h3>
        <p className="sub-note">
          各组已成立革委会的比例，按月累计。
          {rollout
            .filter((l) => l.of)
            .map((l) => `${l.name.replace(/（.*/, '')}的中位日期是 ${fmtT(d3.median(l.ts)!, 'month')}，${l.of!.province}革委会成立于 ${fmtDate(l.of!.date)}。`)
            .join('')}
        </p>
        <Rollout lines={rollout} width={Math.min(W, 1000)} />
        <details>
          <summary>逐条原文</summary>
          <table className="sources">
            <thead>
              <tr>
                <th>日期</th>
                <th>县市</th>
                <th>原文</th>
                <th>出处</th>
              </tr>
            </thead>
            <tbody>
              {counties.map(({ u, rc }) => (
                <tr key={u.id}>
                  <td className="num">{fmtDate(rc.date)}</td>
                  <td>
                    {u.province} {u.name}
                  </td>
                  <td>
                    “{rc.quote}”{rc.note && <small className="muted-note"> {rc.note}</small>}
                  </td>
                  <td>
                    <Cite cite={rc.cite} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
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

type Line = { name: string; ts: number[]; color: string }

function Rollout({ lines, width }: { lines: Line[]; width: number }) {
  const W = Math.max(320, width)
  const x = d3.scaleLinear().domain([R0, R1]).range([RM.l, W - RM.r])
  const y = d3.scaleLinear().domain([0, 1]).range([RH - RM.b, RM.t])
  const path = (ts: number[]) => {
    const pts: [number, number][] = [[R0, 0], ...ts.map((t, i) => [Math.max(R0, Math.min(R1, t)), (i + 1) / ts.length] as [number, number]), [R1, 1]]
    return d3.line().curve(d3.curveStepAfter)(pts.map(([t, v]) => [x(t), y(v)]))!
  }
  return (
    <>
      <svg width={W} height={RH} style={{ display: 'block' }}>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={RM.l} x2={W - RM.r} y1={y(v)} y2={y(v)} stroke="var(--rule)" />
            <text x={RM.l - 5} y={y(v) + 3} textAnchor="end" fontSize={10} fill="var(--muted)">
              {v * 100}%
            </text>
          </g>
        ))}
        {d3.range(R0 * 4, R1 * 4 + 1).map((q) => (
          <text key={q} x={x(q / 4)} y={RH - 6} textAnchor="middle" fontSize={10} fill="var(--muted)">
            {q % 4 ? `${(q % 4) * 3 + 1}月` : q / 4}
          </text>
        ))}
        {lines.map((l) => (
          <path key={l.name} d={path(l.ts)} fill="none" stroke={l.color} strokeWidth={2}>
            <title>{l.name}</title>
          </path>
        ))}
      </svg>
      <div className="chips" style={{ margin: '6px 0 8px 34px' }}>
        {lines.map((l) => (
          <span key={l.name} className="chip nolink">
            <i style={{ background: l.color }} />
            {l.name}
          </span>
        ))}
      </div>
    </>
  )
}
