import { GroupCrumb } from '../components/GroupCrumb'
import * as d3 from 'd3'
import { useMemo, useRef } from 'react'
import { Cite, useTip } from '../components/bits'
import { VOICES, type Event, type Voice } from '../data/schema'
import { fmtDate, toT } from '../lib/dates'
import { useSize } from '../lib/useSize'
import { useApp, useHistoryState } from '../state'

// Ordered by when the voice was written: at the time → witnesses → the verdicts → later study.
const COLS: Voice[] = ['doc', 'official1966', 'foreign', 'witness', 'judicial1980', 'official1981', 'officialLater', 'scholar', 'editor']
export const VOICE_COLOR: Record<Voice, string> = {
  doc: 'var(--v-doc)',
  official1966: 'var(--v-official1966)',
  foreign: 'var(--v-foreign)',
  witness: 'var(--v-witness)',
  judicial1980: 'var(--v-judicial1980)',
  official1981: 'var(--v-official1981)',
  officialLater: 'var(--v-officialLater)',
  scholar: 'var(--v-scholar)',
  editor: 'var(--v-editor)',
}
const VERDICT: Voice[] = ['judicial1980', 'official1981', 'officialLater']
const THEN: Voice[] = ['doc', 'official1966']

const FILTERS = {
  all: { label: '全部', test: (_: Set<Voice>) => true },
  multi: { label: '多种声音', test: (s: Set<Voice>) => [...s].filter((v) => v !== 'editor').length >= 2 },
  verdict: { label: '定论有说法', test: (s: Set<Voice>) => VERDICT.some((v) => s.has(v)) },
  silent: { label: '当时有声、定论无声', test: (s: Set<Voice>) => THEN.some((v) => s.has(v)) && !VERDICT.some((v) => s.has(v)) },
} as const
type Filter = keyof typeof FILTERS

const MAP_ROW = 15
const MAP_LABEL = 92

export function Narratives() {
  const { ix, sel, select } = useApp()
  const [filter, setFilter] = useHistoryState<Filter>('narratives.filter', 'multi')
  const mapRef = useRef<HTMLDivElement>(null)
  const { width } = useSize(mapRef)
  const { tip, setTip } = useTip()

  const voiced = useMemo(
    () =>
      ix.events
        .filter((e) => e.voices.length)
        .map((e) => ({ e, set: new Set(e.voices.map((v) => v.voice)) }))
        .sort((a, b) => a.e.date.localeCompare(b.e.date)),
    [ix],
  )
  const rows = voiced.filter((r) => FILTERS[filter].test(r.set))
  const counts = Object.fromEntries(COLS.map((v) => [v, voiced.filter((r) => r.set.has(v)).length])) as Record<Voice, number>

  const x = useMemo(() => {
    const ts = voiced.map((r) => toT(r.e.date))
    return d3
      .scaleLinear()
      .domain([d3.min(ts)! - 0.02, d3.max(ts)! + 0.02])
      .range([MAP_LABEL, Math.max(MAP_LABEL + 200, width - 16)])
  }, [voiced, width])

  const jump = (e: Event) => {
    select({ type: 'event', id: e.id })
    if (!rows.some((r) => r.e.id === e.id)) setFilter('all')
    requestAnimationFrame(() => document.getElementById(`nar-${e.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  }

  const grid = { gridTemplateColumns: `190px ${COLS.map((v) => (counts[v] ? 'minmax(150px, 1fr)' : '64px')).join(' ')}` }
  const selEvent = sel?.type === 'event' ? sel.id : undefined
  const mapH = COLS.length * MAP_ROW + 26

  return (
    <div className="view">
      <div className="viewhead">
        <div>
          <h1><GroupCrumb />叙事对照</h1>
          <p>
            同一事件，不同时间、不同立场的文本怎么说。列按写作时间排列：当时的原始文件与官方报刊 → 亲历者 → 1980 年起诉书与 1981 年决议 → 学术研究 → 本站。
            <q>引号</q>内为逐字引文（构建时与原文核对），其余为转述。空格表示本站尚未收录该类说法，不一定是原文沉默。
          </p>
        </div>
        <div className="spacer" />
        <div className="legend">
          {(Object.keys(FILTERS) as Filter[]).map((k) => (
            <button
              key={k}
              className="chip"
              aria-pressed={filter === k}
              style={filter === k ? { background: 'var(--ink)', color: 'var(--paper)' } : undefined}
              onClick={() => setFilter(k)}
            >
              {FILTERS[k].label} {voiced.filter((r) => FILTERS[k].test(r.set)).length}
            </button>
          ))}
        </div>
      </div>

      <div className="nar-map" ref={mapRef} onMouseLeave={() => setTip(null)}>
        <svg width="100%" height={mapH} style={{ display: 'block' }}>
          {d3.range(1965, 1968).flatMap((y) =>
            d3.range(0, 12, 3).map((m) => {
              const t = y + m / 12
              if (t < x.domain()[0] || t > x.domain()[1]) return null
              return (
                <g key={t}>
                  <line x1={x(t)} x2={x(t)} y1={4} y2={mapH - 18} stroke="var(--rule)" />
                  <text x={x(t) + 3} y={mapH - 6} fontSize={10} fill="var(--muted)">
                    {m ? `${m + 1}月` : `${y}年`}
                  </text>
                </g>
              )
            }),
          )}
          {COLS.map((v, i) => (
            <g key={v} transform={`translate(0, ${6 + i * MAP_ROW})`}>
              <text x={MAP_LABEL - 8} y={MAP_ROW / 2 + 3.5} textAnchor="end" fontSize={10.5} fill={VOICE_COLOR[v]} fontWeight={600}>
                {VOICES[v]}
              </text>
              {voiced
                .filter((r) => r.set.has(v))
                .map((r) => (
                  <circle
                    key={r.e.id}
                    cx={x(toT(r.e.date))}
                    cy={MAP_ROW / 2}
                    r={selEvent === r.e.id ? 5 : 3.6}
                    fill={VOICE_COLOR[v]}
                    fillOpacity={FILTERS[filter].test(r.set) ? 0.9 : 0.2}
                    stroke={selEvent === r.e.id ? 'var(--ink)' : 'var(--paper)'}
                    strokeWidth={selEvent === r.e.id ? 1.5 : 0.8}
                    style={{ cursor: 'pointer' }}
                    onClick={() => jump(r.e)}
                    onMouseMove={(ev) => {
                      const rect = mapRef.current!.getBoundingClientRect()
                      setTip({
                        x: ev.clientX - rect.left,
                        y: ev.clientY - rect.top,
                        content: (
                          <>
                            <b>{r.e.title}</b>
                            <small>
                              {fmtDate(r.e.date)} · {VOICES[v]}
                            </small>
                            <div style={{ marginTop: 4 }}>{r.e.voices.find((vo) => vo.voice === v)!.text.slice(0, 90)}</div>
                          </>
                        ),
                      })
                    }}
                  />
                ))}
            </g>
          ))}
        </svg>
        {tip}
      </div>

      <div className="nar-list">
        <div className="nar-row nar-head" style={grid}>
          <div>事件</div>
          {COLS.map((v) => (
            <div key={v} style={{ color: VOICE_COLOR[v], opacity: counts[v] ? 1 : 0.5 }}>
              {VOICES[v]} <span>{counts[v] || '未收录'}</span>
            </div>
          ))}
        </div>
        {rows.map(({ e }) => (
          <div key={e.id} id={`nar-${e.id}`} className="nar-row" style={grid} aria-selected={selEvent === e.id}>
            <div className="nar-event">
              <time>{fmtDate(e.date)}</time>
              <button onClick={() => select({ type: 'event', id: e.id })}>{e.title}</button>
              {e.verify && <span className="verify">待核</span>}
            </div>
            {COLS.map((v) => {
              const vs = e.voices.filter((x) => x.voice === v)
              return (
                <div key={v} className="nar-cell" style={{ borderTopColor: vs.length ? VOICE_COLOR[v] : undefined }}>
                  {vs.length ? (
                    vs.map((vo, i) => {
                      const [, body, by] = vo.text.match(/^(.*?)(（[^）]*）)?$/s)!
                      return (
                        <p key={i}>
                          {vo.quote ? (
                            <>
                              <q>{body}</q>
                              {by && <span className="by">{by}</span>}
                            </>
                          ) : (
                            <span className="para">{vo.text}</span>
                          )}{' '}
                          <Cite cite={vo.cite} />
                        </p>
                      )
                    })
                  ) : (
                    <span className="empty">·</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
