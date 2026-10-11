import { useEffect, useMemo, useRef, useState } from 'react'
import type { Ref } from '../data/atlas'
import { ISM_KINDS } from '../data/schema'
import { fmtDate, toT } from '../lib/dates'
import { useApp } from '../state'

type Item = { ref: Ref; type: string; title: string; sub: string; hay: string; date?: string }

const TYPE_LABEL = { person: '人物', event: '事件', concept: '概念', doc: '文献', faction: '派系', claim: '结论', org: '机构', ism: '主义' }

export function Search({ onClose }: { onClose: () => void }) {
  const { ix, select, setT } = useApp()
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])

  const items = useMemo<Item[]>(
    () => [
      ...ix.people.map((p) => ({
        ref: { type: 'person' as const, id: p.id },
        type: TYPE_LABEL.person,
        title: p.name,
        sub: p.role1966,
        hay: [p.name, ...(p.aka ?? []).map((a) => a.name), p.pinyin ?? '', p.role1966, p.bio].join(' '),
      })),
      ...ix.events.map((e) => ({
        ref: { type: 'event' as const, id: e.id },
        type: TYPE_LABEL.event,
        title: e.title,
        sub: fmtDate(e.date),
        hay: [e.title, e.summary, e.place ?? ''].join(' '),
        date: e.date,
      })),
      ...ix.concepts.map((c) => ({
        ref: { type: 'concept' as const, id: c.id },
        type: TYPE_LABEL.concept,
        title: c.name,
        sub: `${c.hits.length} 份文献`,
        hay: [c.name, ...c.terms, c.summary].join(' '),
      })),
      ...ix.sources
        .filter((s) => s.hasText)
        .map((s) => ({
          ref: { type: 'doc' as const, id: s.id },
          type: TYPE_LABEL.doc,
          title: s.alias ? `《${s.alias}》${s.title.length < 24 ? ' ' + s.title : ''}` : s.title,
          sub: fmtDate(s.date),
          hay: [s.title, s.alias ?? '', s.author ?? ''].join(' '),
        })),
      ...ix.factions.map((f) => ({
        ref: { type: 'faction' as const, id: f.id },
        type: TYPE_LABEL.faction,
        title: f.name,
        sub: '',
        hay: [f.name, f.summary].join(' '),
      })),
      ...ix.orgs.map((o) => ({
        ref: { type: 'org' as const, id: o.id },
        type: TYPE_LABEL.org,
        title: o.name,
        sub: o.short ?? '',
        hay: [o.name, o.short ?? '', ...o.aliases, o.summary].join(' '),
      })),
      ...ix.isms.map((m) => ({
        ref: { type: 'ism' as const, id: m.id },
        type: TYPE_LABEL.ism,
        title: m.name,
        sub: `${ISM_KINDS[m.kind]} · ${m.from.slice(0, 4)}${m.to ? `–${m.to.slice(0, 4)}` : ' 起'}`,
        hay: [m.name, m.short ?? '', ...m.terms, ...m.carriers.map((c) => c.name), m.summary].join(' '),
        date: m.from,
      })),
      ...ix.claims.map((c) => ({
        ref: { type: 'claim' as const, id: c.id },
        type: TYPE_LABEL.claim,
        title: c.statement.slice(0, 42) + '…',
        sub: c.id,
        hay: c.statement,
      })),
    ],
    [ix],
  )

  const results = useMemo(() => {
    const needle = q.trim()
    if (!needle) return items.filter((i) => i.ref.type === 'person').slice(0, 12)
    return items
      .map((i) => {
        const inTitle = i.title.indexOf(needle)
        const score = inTitle === 0 ? 0 : inTitle > 0 ? 1 : i.hay.includes(needle) ? 2 : 9
        return { i, score }
      })
      .filter((r) => r.score < 9)
      .sort((a, b) => a.score - b.score)
      .slice(0, 40)
      .map((r) => r.i)
  }, [q, items])

  const choose = (item: Item) => {
    select(item.ref, true)
    if (item.date) setT(toT(item.date))
    onClose()
  }

  const highlight = (s: string) => {
    const needle = q.trim()
    const i = needle ? s.indexOf(needle) : -1
    if (i < 0) return s
    return (
      <>
        {s.slice(0, i)}
        <mark>{needle}</mark>
        {s.slice(i + needle.length)}
      </>
    )
  }

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div className="palette" role="dialog" aria-label="搜索" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={input}
          value={q}
          placeholder="搜索人物、事件、概念、文献、机构…  如：彭真、五十多天、工总司"
          onChange={(e) => {
            setQ(e.target.value)
            setCursor(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setCursor((c) => Math.min(c + 1, results.length - 1))
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setCursor((c) => Math.max(c - 1, 0))
            }
            if (e.key === 'Enter' && results[cursor]) choose(results[cursor])
          }}
        />
        <ul role="listbox">
          {results.map((r, i) => (
            <li key={`${r.ref.type}:${r.ref.id}`} aria-selected={i === cursor} onMouseEnter={() => setCursor(i)}>
              <button onClick={() => choose(r)}>
                <span className="type">{r.type}</span>
                <span>{highlight(r.title)}</span>
                <span className="sub">{r.sub}</span>
              </button>
            </li>
          ))}
          {!results.length && <li style={{ padding: 16, color: 'var(--muted)' }}>没有匹配结果</li>}
        </ul>
      </div>
    </div>
  )
}
