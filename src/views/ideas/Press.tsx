import * as d3 from 'd3'
import { useMemo, useRef } from 'react'
import { useTip } from '../../components/bits'
import { useTheme } from '../../lib/theme'
import { useSize } from '../../lib/useSize'
import { useApp, useHistoryState } from '../../state'
import { shortTitle } from '../../lib/sources'

const ROW = 24
const HEAD_H = 58
const FIRST_W = 260
// a year-only date sorts after every full date in that year
const firstKey = (d = '9999') => (d.length === 4 ? `${d}-13` : d)

export function Press() {
  const { ix, sel, select } = useApp()
  const wrap = useRef<HTMLDivElement>(null)
  const { width } = useSize(wrap)
  const { tip, setTip } = useTip()
  const [order, setOrder] = useHistoryState<'first' | 'peak'>('ideas.pressOrder', 'first')
  const dark = useTheme() === 'dark'

  const years = ix.press.years
  const rate = (t: (typeof ix.press.terms)[number], year: number) => {
    const n = t.counts.find((c) => c.year === year)?.n ?? 0
    const chars = years.find((y) => y.year === year)?.chars ?? 0
    return { n, r: chars ? (n / chars) * 10000 : 0 }
  }
  const terms = useMemo(() => {
    const peak = (t: (typeof ix.press.terms)[number]) => d3.maxIndex(years, (y) => rate(t, y.year).r)
    return [...ix.press.terms].sort((a, b) =>
      order === 'peak' ? peak(a) - peak(b) || firstKey(a.first?.date).localeCompare(firstKey(b.first?.date)) : firstKey(a.first?.date).localeCompare(firstKey(b.first?.date)),
    )
  }, [ix, order]) // eslint-disable-line react-hooks/exhaustive-deps

  const labelW = width && width < 640 ? 96 : 140
  const firstW = width && width < 900 ? 0 : FIRST_W
  const colW = Math.max(34, Math.min(72, (width - labelW - firstW - 24) / years.length))
  const gridW = labelW + years.length * colW + firstW
  const max = d3.max(ix.press.terms.flatMap((t) => years.map((y) => rate(t, y.year).r))) ?? 1
  const color = d3.scaleSequentialSqrt(dark ? d3.interpolate('#3a2226', '#ef6a7c') : d3.interpolate('#f7e3e3', '#8e0f25')).domain([0, max])
  const hotText = dark ? '#1b1a18' : '#fff'

  const open = (t: (typeof ix.press.terms)[number]) => {
    if (t.concept) select({ type: 'concept', id: t.concept, sub: t.first?.source })
    else if (t.ism) select({ type: 'ism', id: t.ism })
    else if (t.first) select({ type: 'doc', id: t.first.source })
  }
  const picked = (t: (typeof ix.press.terms)[number]) =>
    (sel?.type === 'concept' && sel.id === t.concept) || (sel?.type === 'ism' && sel.id === t.ism)

  return (
    <>
      <div className="control-bar">
        <button className="chip" aria-pressed={order === 'first'} onClick={() => setOrder('first')}>
          按首现排序
        </button>
        <button className="chip" aria-pressed={order === 'peak'} onClick={() => setOrder('peak')}>
          按高峰年份排序
        </button>
        <span className="muted-note">
          语料为本站已收的 1966–1976 年社论与新闻报道共 {d3.sum(years, (y) => y.docs)} 篇；1972、1973 年各只有几篇，这两年的数字只作参考。
          “首现”指在这批报刊文本中第一次出现，不等于这个说法的真正起源。
        </span>
      </div>
      <div className="canvas" ref={wrap} style={{ overflow: 'auto' }} onMouseLeave={() => setTip(null)}>
        <svg width={gridW} height={HEAD_H + terms.length * ROW + 8} style={{ display: 'block' }}>
          {years.map((y, j) => {
            const cx = labelW + j * colW + colW / 2
            return (
              <g key={y.year} pointerEvents="none">
                <text x={cx} y={20} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--ink)">
                  {y.year}
                </text>
                <text x={cx} y={34} textAnchor="middle" fontSize={9.5} fill="var(--muted)">
                  {y.docs} 篇
                </text>
                <text x={cx} y={46} textAnchor="middle" fontSize={9.5} fill="var(--muted)">
                  {(y.chars / 10000).toFixed(1)} 万字
                </text>
              </g>
            )
          })}
          {firstW > 0 && (
            <text x={labelW + years.length * colW + 12} y={20} fontSize={11} fill="var(--muted)">
              首现（本站报刊语料）
            </text>
          )}
          {terms.map((t, i) => {
            const y0 = HEAD_H + i * ROW
            const firstYear = t.first ? Number(t.first.date.slice(0, 4)) : 0
            const on = picked(t)
            const src = t.first ? ix.source.get(t.first.source) : undefined
            return (
              <g key={t.id}>
                {on && <rect x={0} y={y0} width={gridW} height={ROW} fill="var(--paper-2)" />}
                <text
                  x={labelW - 10}
                  y={y0 + 16}
                  textAnchor="end"
                  fontSize={12.5}
                  fontWeight={on ? 600 : 400}
                  fill={t.concept || t.ism ? 'var(--ink)' : 'var(--ink-2)'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => open(t)}
                >
                  {t.name}
                </text>
                {years.map((y, j) => {
                  const { n, r } = rate(t, y.year)
                  const x0 = labelW + j * colW
                  return (
                    <g
                      key={y.year}
                      onMouseMove={(e) => {
                        const box = wrap.current!.getBoundingClientRect()
                        setTip({
                          x: e.clientX - box.left + wrap.current!.scrollLeft,
                          y: e.clientY - box.top + wrap.current!.scrollTop,
                          content: (
                            <>
                              <b>{t.name}</b>
                              <small>
                                {y.year} 年 · {y.docs} 篇
                              </small>
                              <div style={{ marginTop: 4 }}>{n ? `${n} 次，每万字 ${r.toFixed(1)} 次` : '未出现'}</div>
                            </>
                          ),
                        })
                      }}
                    >
                      <rect
                        x={x0 + 1}
                        y={y0 + 2}
                        width={colW - 2}
                        height={ROW - 4}
                        rx={3}
                        fill={n ? color(r) : 'var(--paper-2)'}
                        opacity={n ? 1 : 0.6}
                        stroke={y.year === firstYear ? 'var(--ink)' : 'none'}
                        strokeWidth={1.2}
                      />
                      {n > 0 && colW > 40 && (
                        <text x={x0 + colW / 2} y={y0 + 16} textAnchor="middle" fontSize={10.5} fill={r > max * 0.18 ? hotText : 'var(--ink)'} pointerEvents="none">
                          {r >= 10 ? r.toFixed(0) : r.toFixed(1)}
                        </text>
                      )}
                    </g>
                  )
                })}
                {firstW > 0 && t.first && src && (
                  <text
                    x={labelW + years.length * colW + 12}
                    y={y0 + 16}
                    fontSize={11}
                    fill="var(--ink-2)"
                    style={{ cursor: 'pointer' }}
                    onClick={() => select({ type: 'doc', id: src.id })}
                    onMouseMove={(e) => {
                      const box = wrap.current!.getBoundingClientRect()
                      setTip({
                        x: e.clientX - box.left + wrap.current!.scrollLeft,
                        y: e.clientY - box.top + wrap.current!.scrollTop,
                        content: (
                          <>
                            <b>{shortTitle(src)}</b>
                            <small>{t.first!.date}</small>
                            <div style={{ marginTop: 4 }}>……{t.first!.context}……</div>
                          </>
                        ),
                      })
                    }}
                  >
                    <tspan fontFamily="var(--mono)" fill="var(--muted)">
                      {t.first.date.length === 4 ? `${t.first.date}　　　` : t.first.date.replace(/-/g, '.')}
                    </tspan>
                    {'  '}
                    {shortTitle(src).slice(0, 15)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
        {tip}
      </div>
    </>
  )
}
