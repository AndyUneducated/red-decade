import { fmtDate } from '../../lib/dates'
import { useApp } from '../../state'
import { Cite, Entity, PersonChip } from '../bits'

const CLAIM_STATUS = { supported: '证据支持', partial: '部分支持', contested: '有争议', open: '待研究' }

// inline: a self-contained card for lists (研究 page) instead of the drawer layout
export function ClaimCard({ id, inline }: { id: string; inline?: boolean }) {
  const { ix } = useApp()
  const c = ix.claim.get(id)
  if (!c) return null
  const body = (
    <>
      <p>{c.statement}</p>
      {c.evidence.map((e, i) => (
        <blockquote key={i}>
          {e.quote ? `“${e.quote}”` : e.note} <Cite cite={e.cite} />
        </blockquote>
      ))}
      <div className="method">方法：{c.method}</div>
      {c.caveats && <div className="caveat">局限：{c.caveats}</div>}
      {c.history.length > 0 && (
        <div className="method">
          {c.history.map((h, i) => (
            <div key={i}>
              修订 {fmtDate(h.date)}：{h.note}
            </div>
          ))}
        </div>
      )}
      <div className="chips" style={{ marginTop: 8 }}>
        {c.people.map((p) => (
          <PersonChip key={p} id={p} />
        ))}
        {c.concepts.map((k) => (
          <Entity key={k} refTo={{ type: 'concept', id: k }} />
        ))}
      </div>
    </>
  )
  if (inline)
    return (
      <article className="claim">
        <header>
          <span className="cid">{c.id}</span>
          <span className={`st st-${c.status}`}>{CLAIM_STATUS[c.status]}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>记录于 {fmtDate(c.logged)}</span>
        </header>
        {body}
      </article>
    )
  return (
    <>
      <header>
        <div className="kicker">
          研究结论 · {c.id} · <span className={`st st-${c.status}`}>{CLAIM_STATUS[c.status]}</span>
        </div>
      </header>
      <section className="claim" style={{ border: 0, borderRadius: 0, margin: 0 }}>
        {body}
      </section>
    </>
  )
}
