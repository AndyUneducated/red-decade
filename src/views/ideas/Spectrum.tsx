import * as d3 from 'd3'
import { useMemo, useRef } from 'react'
import { useTip } from '../../components/bits'
import { Scrubber } from '../../components/Scrubber'
import type { Ism } from '../../data/atlas'
import { ISM_KINDS } from '../../data/schema'
import { fmtDate, fmtT, toT } from '../../lib/dates'
import { AXES, describe, ismColor, KIND_ORDER, lineUntil, posAt, track } from '../../lib/isms'
import { useSize } from '../../lib/useSize'
import { useApp } from '../../state'

const MARKS: [number, string][] = [
  [1949.75, '建国'],
  [1958.4, '大跃进'],
  [1966.4, '五一六'],
  [1976.75, '粉碎四人帮'],
  [1978.97, '三中全会'],
  [1989.4, '六四'],
]
const PAD = 34
// the line's latest turns carry labels; older ones only on hover
const LABELLED = 4

export function Spectrum() {
  const { ix, sel, select, t } = useApp()
  const wrap = useRef<HTMLDivElement>(null)
  const { width, height } = useSize(wrap)
  const { tip, setTip } = useTip()
  const side = width < 860 ? 0 : 260
  const S = Math.max(320, Math.min(width - side - 24, height - 24, 720))
  const sc = useMemo(() => d3.scaleLinear().domain([-1, 1]).range([PAD, S - PAD]), [S])
  const X = (v: number) => sc(v)
  const Y = (v: number) => S - sc(v)

  const focus = sel?.type === 'ism' ? ix.ism.get(sel.id) : undefined
  const past = lineUntil(ix.line, t)
  const now = track(ix.line, t)
  const lastTurn = ix.line.findLastIndex((p) => toT(p.at) <= t)
  const turn = ix.line[lastTurn]
  const alive = useMemo(
    () =>
      ix.isms
        .map((m) => ({ m, p: posAt(m, t) }))
        .filter((r): r is { m: Ism; p: { x: number; y: number } } => !!r.p)
        .sort((a, b) => KIND_ORDER.indexOf(a.m.kind) - KIND_ORDER.indexOf(b.m.kind)),
    [ix, t],
  )
  const inLine = t >= toT(ix.line[0].at)

  const tipAt = (e: React.MouseEvent, content: React.ReactNode) => {
    const r = wrap.current!.getBoundingClientRect()
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, content })
  }

  return (
    <>
      <Scrubber min={1949} max={1990} marks={MARKS} />
      <div className="canvas spectrum" ref={wrap} onMouseLeave={() => setTip(null)}>
        <svg width={S} height={S} style={{ display: 'block', flex: 'none' }}>
          <rect x={PAD} y={PAD} width={S - 2 * PAD} height={S - 2 * PAD} fill="var(--card)" stroke="var(--rule-2)" />
          {[-0.5, 0, 0.5].map((v) => (
            <g key={v} stroke={v ? 'var(--rule)' : 'var(--rule-2)'} strokeDasharray={v ? '2 3' : undefined}>
              <line x1={X(v)} x2={X(v)} y1={PAD} y2={S - PAD} />
              <line y1={Y(v)} y2={Y(v)} x1={PAD} x2={S - PAD} />
            </g>
          ))}
          <g fontSize={11} fill="var(--muted)">
            <text x={PAD} y={S - PAD + 16}>
              ← {AXES.x[0]}
            </text>
            <text x={S - PAD} y={S - PAD + 16} textAnchor="end">
              {AXES.x[1]} →
            </text>
            <text transform={`translate(${PAD - 10}, ${S - PAD}) rotate(-90)`}>← {AXES.y[0]}</text>
            <text transform={`translate(${PAD - 10}, ${PAD}) rotate(-90)`} textAnchor="end">
              {AXES.y[1]} →
            </text>
          </g>

          <polyline points={ix.line.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')} fill="none" stroke="var(--accent)" strokeOpacity={0.12} strokeWidth={1} />
          {past.length > 1 && (
            <polyline points={past.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')} fill="none" stroke="var(--accent)" strokeOpacity={0.75} strokeWidth={1.8} strokeLinejoin="round" />
          )}
          {ix.line.map((p, i) => {
            const done = toT(p.at) <= t
            const recent = done && i > lastTurn - LABELLED
            return (
              <g
                key={p.at}
                opacity={done ? 1 : 0.25}
                onMouseMove={(e) =>
                  tipAt(
                    e,
                    <>
                      <b>中央路线 · {p.label}</b>
                      <small>
                        {fmtDate(p.at)} · {describe(p)}
                      </small>
                      {p.note && <div style={{ marginTop: 4 }}>{p.note}</div>}
                    </>,
                  )
                }
                onMouseLeave={() => setTip(null)}
              >
                <circle cx={X(p.x)} cy={Y(p.y)} r={2.6} fill="var(--accent)" />
                {recent && (
                  <text
                    x={X(p.x) + 5}
                    y={Y(p.y) + (i % 2 ? 11 : -4)}
                    fontSize={i === lastTurn ? 11 : 9.5}
                    fontWeight={i === lastTurn ? 600 : 400}
                    fill={i === lastTurn ? 'var(--accent)' : 'var(--muted)'}
                    style={{ paintOrder: 'stroke', stroke: 'var(--card)', strokeWidth: 3 }}
                  >
                    {p.at.slice(0, 4)} {p.label}
                  </text>
                )}
              </g>
            )
          })}

          {focus && focus.pos.length > 1 && (
            <polyline points={focus.pos.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')} fill="none" stroke={ismColor(focus.kind)} strokeWidth={1.5} strokeDasharray="3 2" />
          )}
          {alive.map(({ m, p }) => {
            const on = focus?.id === m.id
            return (
              <g
                key={m.id}
                style={{ cursor: 'pointer' }}
                onClick={() => select({ type: 'ism', id: m.id })}
                onMouseMove={(e) =>
                  tipAt(
                    e,
                    <>
                      <b>{m.name}</b>
                      <small>
                        {ISM_KINDS[m.kind]} · {describe(p)}
                      </small>
                      {m.kind === 'label' && <div style={{ marginTop: 4 }}>罪名：位置是批判者对被批判者的描述</div>}
                    </>,
                  )
                }
                onMouseLeave={() => setTip(null)}
              >
                <circle
                  cx={X(p.x)}
                  cy={Y(p.y)}
                  r={on ? 8 : 6}
                  fill={m.kind === 'label' ? 'var(--card)' : ismColor(m.kind)}
                  stroke={ismColor(m.kind)}
                  strokeWidth={m.kind === 'label' ? 2 : 1}
                  strokeDasharray={m.kind === 'label' ? '2 1.5' : undefined}
                  fillOpacity={0.85}
                />
                <text
                  x={X(p.x) + 9}
                  y={Y(p.y) + 4}
                  fontSize={11.5}
                  fontWeight={on ? 700 : 500}
                  fill="var(--ink)"
                  style={{ paintOrder: 'stroke', stroke: 'var(--card)', strokeWidth: 3 }}
                >
                  {m.short ?? m.name}
                </text>
              </g>
            )
          })}

          {now && inLine && (
            <g pointerEvents="none">
              <circle cx={X(now.x)} cy={Y(now.y)} r={9} fill="none" stroke="var(--accent)" strokeWidth={2} />
              <circle cx={X(now.x)} cy={Y(now.y)} r={4} fill="var(--accent)" />
            </g>
          )}
        </svg>
        {side > 0 && (
          <aside className="spectrum-side">
            <h3>{fmtT(t, 'month')}</h3>
            {inLine && now && turn ? (
              <p>
                <b style={{ color: 'var(--accent)' }}>中央路线</b>：{turn.label}之后，{describe(now)}。
              </p>
            ) : (
              <p className="muted-note">把时间轴移到 1949 年 10 月之后。</p>
            )}
            <h4>此刻存在的主张（{alive.length}）</h4>
            <ul>
              {alive.map(({ m, p }) => (
                <li key={m.id}>
                  <button className="linklike" onClick={() => select({ type: 'ism', id: m.id })} aria-pressed={focus?.id === m.id}>
                    <i className="status-dot" style={{ background: ismColor(m.kind) }} />
                    {m.short ?? m.name}
                  </button>
                  <small>{describe(p)}</small>
                </li>
              ))}
            </ul>
            <p className="sub-note">没有光谱位置的条目（如合二而一、天才论）只出现在谱系与词频里。</p>
          </aside>
        )}
        {tip}
      </div>
    </>
  )
}
