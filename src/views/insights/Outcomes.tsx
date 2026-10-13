import * as d3 from 'd3'
import { useMemo, useRef, useState } from 'react'
import { Cite } from '../../components/bits'
import { POINT_KINDS, type SeriesPoint } from '../../data/schema'
import { PER_HEAD, perHead } from '../../derive/series'
import { fmtDate, toT } from '../../lib/dates'
import { useSize } from '../../lib/useSize'
import { useApp } from '../../state'
import { Insight } from './Insight'

const COLOR: Record<SeriesPoint['kind'], string> = { reported: 'var(--ink)', revised: 'var(--accent)', variant: 'var(--muted)' }
const H = 240
const M = { l: 44, r: 12, t: 12, b: 22 }
const LANE = 26

export function Outcomes() {
  const { ix, select, setT } = useApp()
  const wrap = useRef<HTMLDivElement>(null)
  const { width } = useSize(wrap)
  const pop = ix.series.find((s) => s.id === 'population')
  const options = ix.series.filter((s) => s.id !== 'population' && PER_HEAD[s.unit])
  const [id, setId] = useState('grain')
  const s = options.find((o) => o.id === id) ?? options[0]
  const rows = useMemo(() => (s && pop ? perHead(s, pop) : []), [s, pop])
  const events = useMemo(
    () =>
      [...new Set([...(s?.events ?? []), ...(pop?.events ?? [])])]
        .flatMap((e) => ix.event.get(e) ?? [])
        .sort((a, b) => a.date.localeCompare(b.date)),
    [s, pop, ix],
  )
  if (!s || !pop) return null
  const unit = PER_HEAD[s.unit].unit

  const W = Math.max(320, width)
  const x = d3.scaleLinear().domain([1949, 1990]).range([M.l, W - M.r])
  const y = d3
    .scaleLinear()
    .domain([0, (d3.max(rows, (r) => r.value) ?? 1) * 1.1])
    .nice()
    .range([H - M.b, M.t])
  const line = rows.filter((r) => r.point.kind === 'reported').sort((a, b) => a.year - b.year)

  return (
    <Insight
      question="大跃进、调整、文革与改革各时期，平均到每个人头上的粮食和布有多少？公布的数字后来被改了多少？"
      method={`人均＝该年总产量 ÷ 该年人口。人口用公报数（${pop.points.filter((p) => p.kind === 'reported').length} 个年份）；没有公报数的年份在前后两个公报年份之间线性插值，图中画成空心点，不向两端外推。同一年有“当时公布”和“后来修正”两个产量时分别计算，红点为修正数。下方是与该序列相关的事件。`}
      caveats="本站收录的产量与人口序列在 1960–1976 年基本空缺（公报停发），所以图上大段空白不是零，而是没有数字；1953–1964 年间的插值是一条直线，不反映其间人口的起伏，这些年份的人均只能看作近似。人均数只是总量的平均，不反映城乡和地区之间的分配。"
    >
      <div className="chips" style={{ marginBottom: 12 }}>
        {options.map((o) => (
          <button key={o.id} className="chip" aria-pressed={o.id === s.id} onClick={() => setId(o.id)}>
            人均{o.title.replace(/总?产量$/, '')}
          </button>
        ))}
      </div>
      <div ref={wrap} style={{ maxWidth: 1100 }}>
        <svg width={W} height={H + LANE} style={{ display: 'block' }} role="img" aria-label={`人均${s.title}`}>
          {y.ticks(5).map((v) => (
            <g key={v}>
              <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--rule)" />
              <text x={M.l - 5} y={y(v) + 3} textAnchor="end" fontSize={10} fill="var(--muted)">
                {v}
              </text>
            </g>
          ))}
          <text x={M.l} y={M.t - 2} fontSize={10} fill="var(--muted)">
            {unit} / 人
          </text>
          {d3.range(1950, 1991, 5).map((yr) => (
            <text key={yr} x={x(yr)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--muted)">
              {yr}
            </text>
          ))}
          {line.slice(1).map((r, i) =>
            r.year - line[i].year === 1 ? <line key={r.year} x1={x(line[i].year)} y1={y(line[i].value)} x2={x(r.year)} y2={y(r.value)} stroke="var(--ink-2)" /> : null,
          )}
          {rows.map((r, i) => (
            <circle key={i} cx={x(r.year)} cy={y(r.value)} r={3.5} fill={r.popFrom.length > 1 ? 'var(--paper)' : COLOR[r.point.kind]} stroke={COLOR[r.point.kind]} strokeWidth={1.5}>
              <title>{`${r.year} 年 ${r.value.toFixed(1)} ${unit}/人（${POINT_KINDS[r.point.kind]}${r.popFrom.length > 1 ? '，人口为插值' : ''}）`}</title>
            </circle>
          ))}
          {events.map((e) => (
            <g
              key={e.id}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                select({ type: 'event', id: e.id })
                setT(toT(e.date))
              }}
            >
              <line x1={x(toT(e.date))} x2={x(toT(e.date))} y1={H} y2={H + LANE - 8} stroke="var(--accent)" strokeWidth={2} />
              <title>{`${fmtDate(e.date)} ${e.title}`}</title>
            </g>
          ))}
        </svg>
      </div>
      <section className="insight-detail" style={{ maxWidth: 1000 }}>
        <h3>逐年</h3>
        <table className="sources">
          <thead>
            <tr>
              <th>年份</th>
              <th>
                {s.title}（{s.unit}）
              </th>
              <th>人口（万人）</th>
              <th>
                人均（{unit}）
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="num">{r.year}</td>
                <td className="num">
                  {r.point.value} {r.point.kind !== 'reported' && <small style={{ color: COLOR[r.point.kind] }}>{POINT_KINDS[r.point.kind]}</small>} <Cite cite={r.point.cite} />
                </td>
                <td className="num">
                  {r.pop.toFixed(0)}{' '}
                  {r.popFrom.length > 1 ? (
                    <small className="muted-note">
                      插值（{r.popFrom[0].year}、{r.popFrom[1].year}）
                    </small>
                  ) : (
                    <Cite cite={r.popFrom[0].cite} />
                  )}
                </td>
                <td className="num">{r.value.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {events.length > 0 && (
        <section className="insight-detail">
          <h3>相关事件</h3>
          <ul className="minilist">
            {events.map((e) => (
              <li key={e.id}>
                <time>{fmtDate(e.date)}</time>
                <button className="linklike" onClick={() => select({ type: 'event', id: e.id })}>
                  {e.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Insight>
  )
}
