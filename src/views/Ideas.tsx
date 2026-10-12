import * as d3 from 'd3'
import { useMemo, useRef, useState } from 'react'
import { useTheme } from '../lib/theme'
import { useSize } from '../lib/useSize'
import { useApp } from '../state'
import { Lineage } from './ideas/Lineage'
import { Press } from './ideas/Press'
import { Spectrum } from './ideas/Spectrum'
import { Stream } from './ideas/Stream'

const HEAD_H = 168
const ROW = 26

export const shortTitle = (s: { title: string; alias?: string }) =>
  (s.alias ?? s.title.replace(/[（(][^)）]*[)）]/g, '').replace(/^《|》$/g, '')).trim()

const TABS = {
  tree: {
    name: '主义谱系',
    desc: '1921–1989 年间的主义、路线、民间异端与罪名。横向是时间，色条是它作为现实主张存在的时期；实线连向它的源头，虚线连向它所针对的对象。点开看代表人物、源流和语料中的出现。',
  },
  spectrum: {
    name: '光谱漂移',
    desc: '两条轴：横轴经济（计划、公有 ↔ 市场、多种所有制），纵轴政治（阶级斗争、群众动员 ↔ 宽松、制度化、多元）。红线是中央实际路线到此刻为止的轨迹，圆点是此刻存在的各家主张。位置是编者的判断，只表示相对立场，不是测量；罪名的位置是批判者对被批判者的描述。',
  },
  stream: {
    name: '主义词频',
    desc: '各主义的匹配词在本站原始文献中每万字出现的次数。语料集中在 1966–1967 年；字数太少的年份不画，以免一两份文献决定整年的形状。',
  },
  press: {
    name: '报刊词频',
    desc: '一组口号与关键词在 1966–1976 年社论和新闻报道中逐年每万字出现的次数，黑框标出首现年份，行末是首现的日期与文本。按首现排序，可以看出口号如何一代接一代更替：“夺权”“大联合”在 1967 年，“最新指示”“清理阶级队伍”在 1968 年，“批修整风”在 1972–1973 年，“孔老二”“法家”在 1974 年，“资产阶级法权”在 1975 年。点关键词跳到对应的概念或主义。',
  },
  concepts: {
    name: '概念 × 文献',
    desc: '行＝概念，列＝原始文献（按日期排序），格子颜色＝该概念相关词在文中出现的次数。可以直接看出一个说法在哪份文件里第一次出现、在哪里突然变多。点格子看这份文献里的原文语境；按住 Shift 滚动滚轮可左右移动。',
  },
} as const
type Tab = keyof typeof TABS

export function Ideas() {
  const { doc, go } = useApp()
  const tab: Tab = doc && doc in TABS ? (doc as Tab) : 'tree'
  return (
    <div className="view">
      <div className="viewhead">
        <div>
          <h1>思想谱系</h1>
          <p>{TABS[tab].desc}</p>
        </div>
        <div className="spacer" />
        <div className="legend">
          {(Object.keys(TABS) as Tab[]).map((k) => (
            <button key={k} className="chip" aria-pressed={tab === k} onClick={() => go('ideas', k)}>
              {TABS[k].name}
            </button>
          ))}
        </div>
      </div>
      {tab === 'tree' && <Lineage />}
      {tab === 'spectrum' && <Spectrum />}
      {tab === 'stream' && <Stream />}
      {tab === 'press' && <Press />}
      {tab === 'concepts' && <ConceptGrid />}
    </div>
  )
}

function ConceptGrid() {
  const { ix, sel, select } = useApp()
  const wrap = useRef<HTMLDivElement>(null)
  const { width } = useSize(wrap)
  const [hoverCol, setHoverCol] = useState<string | null>(null)

  const docs = useMemo(
    () => ix.sources.filter((s) => s.hasText && s.kind !== 'index').sort((a, b) => a.date.localeCompare(b.date)),
    [ix],
  )
  const concepts = useMemo(() => {
    const first = (c: (typeof ix.concepts)[number]) => c.hits[0]?.date ?? '9999'
    return [...ix.concepts].sort((a, b) => first(a).localeCompare(first(b)))
  }, [ix])

  const labelW = width && width < 640 ? 112 : 220
  const colW = Math.max(26, Math.min(44, (width - labelW - 50) / docs.length))
  const gridW = docs.length * colW + 40
  const bodyH = concepts.length * ROW + 12
  const max = d3.max(ix.concepts.flatMap((c) => c.hits.map((h) => h.count))) ?? 1
  const dark = useTheme() === 'dark'
  const color = d3.scaleSequentialSqrt(dark ? d3.interpolate('#3a2226', '#ef6a7c') : d3.interpolate('#f7e3e3', '#8e0f25')).domain([1, max])
  const hotText = dark ? '#1b1a18' : '#fff'

  const focus = sel?.type === 'concept' ? sel.id : undefined
  const pickedDoc = sel?.type === 'concept' ? sel.sub : undefined
  const yearBreaks = docs.map((d, i) => i > 0 && d.date.slice(0, 4) !== docs[i - 1].date.slice(0, 4))
  const colX = (j: number) => j * colW

  return (
    <div className="canvas heat" ref={wrap}>
      <div className="heat-grid" style={{ gridTemplateColumns: `${labelW}px ${gridW}px`, gridTemplateRows: `${HEAD_H}px ${bodyH}px` }}>
        <div className="heat-corner">
          黑框＝首次出现
          <br />
          虚线＝跨年
          <br />
          行末数字＝总次数
        </div>
        <svg className="heat-head" width={gridW} height={HEAD_H}>
          {docs.map((d, j) => {
            const cx = colX(j) + colW / 2
            return (
              <g key={d.id}>
                {hoverCol === d.id && <rect x={colX(j)} y={0} width={colW} height={HEAD_H} fill="var(--accent-soft)" opacity={0.5} />}
                {yearBreaks[j] && <line x1={colX(j)} x2={colX(j)} y1={HEAD_H - 24} y2={HEAD_H} stroke="var(--ink-2)" strokeDasharray="3 3" />}
                <text
                  transform={`translate(${cx + 4}, ${HEAD_H - 30}) rotate(-62)`}
                  fontSize={11.5}
                  fill={d.id === pickedDoc ? 'var(--focus)' : 'var(--ink)'}
                  fontWeight={d.id === pickedDoc ? 600 : 400}
                  style={{ cursor: 'pointer' }}
                  onClick={() => select({ type: 'doc', id: d.id })}
                  onMouseEnter={() => setHoverCol(d.id)}
                  onMouseLeave={() => setHoverCol(null)}
                >
                  {shortTitle(d).slice(0, 16)}
                </text>
                <text x={cx} y={HEAD_H - 10} textAnchor="middle" fontSize={9.5} fill="var(--muted)">
                  {d.date.slice(2, 7).replace('-', '.')}
                </text>
              </g>
            )
          })}
        </svg>
        <svg className="heat-labels" width={labelW} height={bodyH}>
          {concepts.map((c, i) => {
            const on = c.id === focus
            return (
              <g key={c.id} style={{ cursor: 'pointer' }} onClick={() => select({ type: 'concept', id: c.id })}>
                <rect x={0} y={i * ROW} width={labelW} height={ROW} fill={on ? 'var(--paper-2)' : 'transparent'} />
                <text x={labelW - 10} y={i * ROW + 17} textAnchor="end" fontSize={labelW < 200 ? 11.5 : 12.5} fontWeight={on ? 600 : 400}>
                  {labelW < 200 && c.name.length > 8 ? c.name.slice(0, 8) + '…' : c.name}
                </text>
              </g>
            )
          })}
        </svg>
        <svg width={gridW} height={bodyH}>
          {docs.map((d, j) => (
            <g key={d.id} pointerEvents="none">
              {hoverCol === d.id && <rect x={colX(j)} y={0} width={colW} height={bodyH} fill="var(--accent-soft)" opacity={0.5} />}
              {yearBreaks[j] && <line x1={colX(j)} x2={colX(j)} y1={0} y2={bodyH} stroke="var(--ink-2)" strokeDasharray="3 3" />}
            </g>
          ))}
          {concepts.map((c, i) => {
            const y = i * ROW
            const byDoc = new Map(c.hits.map((h) => [h.source, h]))
            const total = d3.sum(c.hits, (h) => h.count)
            return (
              <g key={c.id}>
                {c.id === focus && <rect x={0} y={y} width={docs.length * colW} height={ROW} fill="var(--paper-2)" />}
                <text x={docs.length * colW + 8} y={y + 17} fontSize={10} fill="var(--muted)" fontFamily="var(--mono)">
                  {total || ''}
                </text>
                {docs.map((d, j) => {
                  const h = byDoc.get(d.id)
                  const first = c.hits[0]?.source === d.id
                  const picked = focus === c.id && pickedDoc === d.id
                  return (
                    <g
                      key={d.id}
                      onMouseEnter={() => setHoverCol(d.id)}
                      onMouseLeave={() => setHoverCol(null)}
                      onClick={() => h && select({ type: 'concept', id: c.id, sub: d.id })}
                      style={{ cursor: h ? 'pointer' : 'default' }}
                    >
                      <rect
                        x={colX(j) + 1}
                        y={y + 2}
                        width={colW - 2}
                        height={ROW - 4}
                        rx={3}
                        fill={h ? color(h.count) : 'var(--paper-2)'}
                        opacity={h ? 1 : 0.6}
                        stroke={picked ? 'var(--focus)' : first ? 'var(--ink)' : 'none'}
                        strokeWidth={picked ? 2.5 : 1.2}
                      />
                      {h && colW > 24 && (
                        <text x={colX(j) + colW / 2} y={y + 17} textAnchor="middle" fontSize={10.5} fill={h.count > max * 0.18 ? hotText : 'var(--ink)'} pointerEvents="none">
                          {h.count}
                        </text>
                      )}
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
