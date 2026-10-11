import * as d3 from 'd3'
import { useMemo, useRef } from 'react'
import { useTip } from '../../components/bits'
import type { Ism } from '../../data/atlas'
import { ISM_KINDS } from '../../data/schema'
import { fmtDate, toT } from '../../lib/dates'
import { ismColor, KIND_ORDER } from '../../lib/isms'
import { useSize } from '../../lib/useSize'
import { useApp } from '../../state'

const T0 = 1919
const T1 = 1990
const LANE = 30
const BAND_HEAD = 24
const BAR_Y = 19
const AXIS_H = 26
const TICKS = [1921, 1940, 1949, 1956, 1966, 1976, 1978, 1989]

type Node = { m: Ism; lane: number; top: number; a: number; b: number }

export function Lineage() {
  const { ix, sel, select, t, setT } = useApp()
  const wrap = useRef<HTMLDivElement>(null)
  const { width } = useSize(wrap)
  const { tip, setTip } = useTip()
  const W = Math.max(640, width - 8)
  const x = useMemo(() => d3.scaleLinear().domain([T0, T1]).range([18, W - 18]), [W])
  const font = W < 900 ? 11 : 12

  const layout = useMemo(() => {
    const nodes = new Map<string, Node>()
    const bands: { kind: (typeof KIND_ORDER)[number]; top: number; h: number }[] = []
    let top = AXIS_H + 6
    for (const kind of KIND_ORDER) {
      const list = ix.isms.filter((m) => m.kind === kind).sort((u, v) => u.from.localeCompare(v.from))
      if (!list.length) continue
      const ends: number[] = []
      for (const m of list) {
        const a = x(toT(m.from))
        const b = x(m.to ? toT(m.to, true) : T1)
        const textEnd = a + (m.short ?? m.name).length * (font + 0.5) + 14
        let lane = ends.findIndex((e) => e < a - 6)
        if (lane < 0) lane = ends.push(0) - 1
        ends[lane] = Math.max(b, textEnd)
        nodes.set(m.id, { m, lane, top: top + BAND_HEAD + lane * LANE, a, b })
      }
      const h = BAND_HEAD + ends.length * LANE + 8
      bands.push({ kind, top, h })
      top += h
    }
    return { nodes, bands, height: top + 8 }
  }, [ix, x, font])

  const focus = sel?.type === 'ism' ? sel.id : undefined
  const near = useMemo(() => {
    if (!focus) return undefined
    const m = ix.ism.get(focus)
    if (!m) return undefined
    return new Set([focus, ...m.parents, ...m.against, ...(ix.ismChildren.get(focus) ?? []).map((c) => c.id), ...(ix.ismOpposed.get(focus) ?? []).map((c) => c.id)])
  }, [ix, focus])

  const barY = (n: Node) => n.top + BAR_Y
  // where a child branches off its parent: at the child's start, clamped to the parent's span
  const edges = useMemo(() => {
    const out: { key: string; d: string; against: boolean; on: boolean }[] = []
    for (const n of layout.nodes.values()) {
      for (const [list, against] of [
        [n.m.parents, false],
        [n.m.against, true],
      ] as const)
        for (const pid of list) {
          const p = layout.nodes.get(pid)
          if (!p) continue
          const px = Math.max(p.a, Math.min(p.b, n.a))
          const py = barY(p)
          const cx = n.a
          const cy = barY(n)
          const dx = Math.max(10, (cx - px) / 2)
          out.push({
            key: `${pid}>${n.m.id}${against ? '!' : ''}`,
            d: `M${px},${py} C${px + dx},${py} ${cx - dx},${cy} ${cx},${cy}`,
            against,
            on: !!focus && (focus === pid || focus === n.m.id),
          })
        }
    }
    return out
  }, [layout, focus])

  const showTip = (e: React.MouseEvent, m: Ism) => {
    const r = wrap.current!.getBoundingClientRect()
    setTip({
      x: e.clientX - r.left,
      y: e.clientY - r.top + wrap.current!.scrollTop,
      content: (
        <>
          <b>{m.name}</b>
          <small>
            {ISM_KINDS[m.kind]} · {fmtDate(m.from)}
            {m.to ? `–${fmtDate(m.to)}` : ' 起'}
          </small>
          {m.carriers.length > 0 && <div style={{ marginTop: 4 }}>{m.carriers.map((c) => c.name).join('、')}</div>}
        </>
      ),
    })
  }

  return (
    <div className="canvas" ref={wrap} style={{ overflow: 'auto' }} onMouseLeave={() => setTip(null)}>
      <svg width={W} height={layout.height} style={{ display: 'block' }}>
        <rect
          width={W}
          height={layout.height}
          fill="transparent"
          onClick={(e) => {
            const r = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect()
            setT(Math.max(T0, Math.min(T1, x.invert(e.clientX - r.left))))
          }}
        />
        <g pointerEvents="none">
          {TICKS.map((yr) => (
            <g key={yr}>
              <line x1={x(yr)} x2={x(yr)} y1={AXIS_H - 6} y2={layout.height} stroke="var(--rule)" />
              <text x={x(yr)} y={AXIS_H - 10} textAnchor="middle" fontSize={10.5} fill="var(--muted)">
                {yr}
              </text>
            </g>
          ))}
        </g>
        {layout.bands.map((b, i) => (
          <g key={b.kind} pointerEvents="none">
            {i > 0 && <line x1={0} x2={W} y1={b.top} y2={b.top} stroke="var(--rule-2)" />}
            <rect x={8} y={b.top + 8} width={4} height={11} rx={1} fill={ismColor(b.kind)} />
            <text x={18} y={b.top + 17} fontSize={11.5} fontWeight={600} fill="var(--ink-2)">
              {ISM_KINDS[b.kind]}
            </text>
          </g>
        ))}
        <g fill="none" pointerEvents="none">
          {edges.map((e) => (
            <path
              key={e.key}
              d={e.d}
              stroke={e.against ? 'var(--accent)' : 'var(--ink-2)'}
              strokeWidth={e.on ? 1.8 : 1}
              strokeDasharray={e.against ? '4 3' : undefined}
              opacity={focus ? (e.on ? 0.95 : 0.12) : e.against ? 0.45 : 0.35}
            />
          ))}
        </g>
        {[...layout.nodes.values()].map((n) => {
          const on = n.m.id === focus
          const dim = near && !near.has(n.m.id)
          const c = ismColor(n.m.kind)
          return (
            <g
              key={n.m.id}
              opacity={dim ? 0.3 : 1}
              style={{ cursor: 'pointer' }}
              onClick={() => select({ type: 'ism', id: n.m.id })}
              onMouseMove={(e) => showTip(e, n.m)}
              onMouseLeave={() => setTip(null)}
            >
              <rect x={n.a - 4} y={n.top} width={Math.max(n.b - n.a, (n.m.short ?? n.m.name).length * font) + 8} height={LANE - 4} fill={on ? 'var(--accent-soft)' : 'transparent'} rx={3} />
              <rect x={n.a} y={barY(n) - 2.5} width={Math.max(3, n.b - n.a)} height={5} rx={2.5} fill={c} opacity={0.85} />
              {!n.m.to && <path d={`M${n.b},${barY(n) - 4} l6,4 l-6,4z`} fill={c} opacity={0.85} />}
              <circle cx={n.a} cy={barY(n)} r={3.5} fill="var(--paper)" stroke={c} strokeWidth={1.6} />
              <text x={n.a + 1} y={n.top + 11} fontSize={font} fontWeight={on ? 700 : 500} fill={on ? 'var(--accent)' : 'var(--ink)'}>
                {n.m.short ?? n.m.name}
              </text>
            </g>
          )
        })}
        {t >= T0 && t <= T1 && <line x1={x(t)} x2={x(t)} y1={AXIS_H - 6} y2={layout.height} stroke="var(--accent)" strokeWidth={1.2} pointerEvents="none" />}
      </svg>
      {tip}
    </div>
  )
}
