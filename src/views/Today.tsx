import { useMemo } from 'react'
import { PageTitle } from '../components/PageTitle'
import { StatusDot } from '../components/bits'
import type { Index } from '../data/atlas'
import { LANES, SOURCE_KINDS, STATUSES } from '../data/schema'
import type { Lens } from '../derive/lens'
import { DAYS, dayIndex, FIRST_YEAR, isDay, LAST_YEAR, shiftDay, todayKey, type DayItem } from '../derive/today'
import { fmtDate } from '../lib/dates'
import { useApp } from '../state'
import { ArchiveCard } from './Archive'

const ORDER: Record<DayItem['kind'], number> = { event: 0, fate: 1, died: 2, born: 3, doc: 4, archive: 5 }
const TAG: Record<DayItem['kind'], string> = { event: '事件', fate: '命运', died: '逝世', born: '出生', doc: '文本', archive: '档案' }
const label = (d: string) => `${+d.slice(0, 2)}月${+d.slice(3)}日`

function inLens(it: DayItem, l: Lens) {
  if (it.kind === 'event') return l.events.has(it.id)
  if (it.kind === 'doc') return l.sources.has(it.id)
  if (it.kind === 'archive') return l.archive.has(it.id)
  return it.id === l.person.id
}

function Line({ it, ix }: { it: DayItem; ix: Index }) {
  const { select, openDoc, sel } = useApp()
  if (it.kind === 'event') {
    const e = ix.event.get(it.id)!
    return (
      <button className="today-item" aria-pressed={sel?.type === 'event' && sel.id === e.id} onClick={() => select({ type: 'event', id: e.id })}>
        <em>{TAG.event}</em>
        <span>
          <b>{e.title}</b>
          <small>
            {LANES[e.lane]}
            {e.verify ? ' · 待核' : ''} · {e.summary.length > 90 ? e.summary.slice(0, 90) + '…' : e.summary}
          </small>
        </span>
      </button>
    )
  }
  if (it.kind === 'doc') {
    const s = ix.source.get(it.id)!
    return (
      <button className="today-item" onClick={() => openDoc(s.id)}>
        <em>{TAG.doc}</em>
        <span>
          <b>{s.alias ?? s.title}</b>
          <small>{[s.author, SOURCE_KINDS[s.kind], s.via].filter(Boolean).join(' · ')}</small>
        </span>
      </button>
    )
  }
  if (it.kind === 'archive') return null
  const p = ix.person.get(it.id)!
  const on = sel?.type === 'person' && sel.id === p.id
  return (
    <button className="today-item" aria-pressed={on} onClick={() => select({ type: 'person', id: p.id })}>
      <em>{TAG[it.kind]}</em>
      <span>
        <b>
          {it.kind === 'fate' && <StatusDot s={it.s} />} {p.name}
          {it.kind === 'fate' && ` · ${STATUSES[it.s]}`}
        </b>
        <small>{it.kind === 'fate' ? it.note : it.kind === 'died' ? p.death : p.role1966}</small>
      </span>
    </button>
  )
}

export function Today() {
  const { ix, param, open, lens } = useApp()
  const day = isDay(param) ? param : todayKey()
  const index = dayIndex(ix)
  const all = index.get(day) ?? []
  const items = lens ? all.filter((it) => inLens(it, lens)) : all
  const byYear = new Map<string, DayItem[]>()
  for (const it of items) byYear.set(it.date.slice(0, 4), [...(byYear.get(it.date.slice(0, 4)) ?? []), it])
  for (const xs of byYear.values()) xs.sort((a, b) => ORDER[a.kind] - ORDER[b.kind])
  const years = [...byYear]
  const count = (k: DayItem['kind']) => items.filter((it) => it.kind === k).length
  // in the personal view, the person's other days, so an empty day still leads somewhere
  const lensDays = useMemo(() => (lens ? DAYS.filter((d) => index.get(d)?.some((it) => inLens(it, lens))) : []), [lens, index])
  const nextLensDays = lensDays.filter((d) => d > day).concat(lensDays.filter((d) => d <= day)).filter((d) => d !== day).slice(0, 12)
  const go = (d: string) => open('day', d)

  return (
    <div className="view">
      <div className="research today">
        <div className="viewhead" style={{ padding: '0 0 10px', border: 0 }}>
          <div>
            <PageTitle />
            <p>
              {FIRST_YEAR}–{LAST_YEAR} 年同一天：日期写到日的事件、库内原文、人物生卒与命运转折、视觉档案。只写到月的不算在内。点事件或人物看详情，点文本读原文。
            </p>
          </div>
        </div>
        <div className="today-head">
          <button className="chip" onClick={() => go(shiftDay(day, -1))} aria-label="前一天">
            ‹ {label(shiftDay(day, -1))}
          </button>
          <h2 className="today-date">{label(day)}</h2>
          <button className="chip" onClick={() => go(shiftDay(day, 1))} aria-label="后一天">
            {label(shiftDay(day, 1))} ›
          </button>
          <input
            className="field"
            type="date"
            aria-label="选一天"
            min="2000-01-01"
            max="2000-12-31"
            value={`2000-${day}`}
            onChange={(e) => e.target.value && go(e.target.value.slice(5))}
          />
          {day !== todayKey() && (
            <button className="chip" onClick={() => go(todayKey())}>
              回到今天
            </button>
          )}
        </div>
        <p className="today-sum">
          {items.length
            ? `${years.length} 个年份：事件 ${count('event')}，文本 ${count('doc')}，命运转折 ${count('fate')}，逝世 ${count('died')}，出生 ${count('born')}，档案 ${count('archive')}`
            : lens
              ? `${lens.person.name}在这一天没有记录。`
              : '这一天没有记录。'}
        </p>
        {lens && !items.length && nextLensDays.length > 0 && (
          <div className="chips" style={{ marginBottom: 12 }}>
            {nextLensDays.map((d) => (
              <button key={d} className="chip" onClick={() => go(d)}>
                {label(d)}
              </button>
            ))}
          </div>
        )}
        {years.map(([y, xs]) => {
          const pics = xs.filter((it) => it.kind === 'archive')
          return (
            <section key={y} className="today-year">
              <h3>
                {fmtDate(`${y}-${day}`)} <span>{xs.length}</span>
              </h3>
              {xs.map((it) => (
                <Line key={`${it.kind}:${it.id}`} it={it} ix={ix} />
              ))}
              {pics.length > 0 && (
                <div className="archive-grid today-pics">
                  {pics.map((it) => {
                    const a = ix.archive.find((x) => x.id === it.id)
                    return a && <ArchiveCard key={a.id} a={a} />
                  })}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
