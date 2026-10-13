// Lists shared by the drawer cards and the full pages (people, orgs).
import { relationActive, type ClaimTarget } from '../../data/atlas'
import { RELATION_TYPES, STATUSES, type Person } from '../../data/schema'
import { fmtDate, toT } from '../../lib/dates'
import { useApp } from '../../state'
import { Cite, PersonChip, StatusDot, Verify } from '../bits'

export function FateLine({ p }: { p: Person }) {
  return (
    <ul className="fateline">
      {p.fate.map((f, i) => (
        <li key={i}>
          <time>{fmtDate(f.date)}</time>
          <StatusDot s={f.s} />
          <span>
            <b style={{ fontWeight: 500 }}>{STATUSES[f.s]}</b>
            {f.note && ` · ${f.note}`} <Cite cite={f.cite} />
            {f.verify && <Verify />}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function RelationList({ id }: { id: string }) {
  const { ix, t } = useApp()
  const rels = ix.relationsByPerson.get(id) ?? []
  return (
    <ul className="minilist">
      {rels.map((r, i) => {
        const other = r.a === id ? r.b : r.a
        const dir = r.a === id ? '→' : '←'
        return (
          <li key={i} style={{ opacity: relationActive(r, t) ? 1 : 0.55 }}>
            <span style={{ color: 'var(--muted)', fontSize: 11.5, marginRight: 6 }}>
              {RELATION_TYPES[r.type]} {dir}
            </span>
            <PersonChip id={other} />
            {r.from && <time style={{ marginLeft: 6 }}>{fmtDate(r.from)}</time>}
            {r.note && <div style={{ color: 'var(--ink-2)', marginTop: 2 }}>{r.note}</div>}
            <Cite cite={r.cite} />
            {r.verify && <Verify />}
          </li>
        )
      })}
    </ul>
  )
}

export function EventList({ events }: { events: { id: string; date: string; title: string }[] }) {
  const { select, setT } = useApp()
  return (
    <ul className="minilist">
      {events.map((e) => (
        <li key={e.id}>
          <time>{fmtDate(e.date)}</time>
          <button
            className="linklike"
            onClick={() => {
              select({ type: 'event', id: e.id })
              setT(toT(e.date))
            }}
          >
            {e.title}
          </button>
        </li>
      ))}
    </ul>
  )
}

export function ClaimLinks({ on, id }: { on: ClaimTarget; id: string }) {
  const { ix, select } = useApp()
  const claims = ix.claimsBy[on].get(id) ?? []
  if (!claims.length) return null
  return (
    <section>
      <h3>本站研究结论</h3>
      <ul className="minilist">
        {claims.map((c) => (
          <li key={c.id}>
            <button className="linklike" onClick={() => select({ type: 'claim', id: c.id })}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', marginRight: 6 }}>{c.id}</span>
              {c.statement.slice(0, 64)}…
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

// marks every occurrence of the terms in a corpus context
export function highlight(text: string, terms: string[]) {
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))
}
