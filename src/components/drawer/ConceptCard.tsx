import { fmtDate } from '../../lib/dates'
import { page as pageDef } from '../../pages'
import { useApp } from '../../state'
import { Cite, Entity, Voices } from '../bits'
import { ConceptNear } from './InsightNotes'
import { ClaimLinks, EventList, highlight } from './lists'

// sub narrows the contexts to one source document
export function ConceptCard({ id, sub: doc }: { id: string; sub?: string }) {
  const { ix, go, page, select } = useApp()
  const c = ix.concept.get(id)
  if (!c) return null
  const events = ix.events.filter((e) => e.concepts.includes(id))
  const total = c.hits.reduce((s, h) => s + h.count, 0)
  const hits = doc ? c.hits.filter((h) => h.source === doc) : c.hits
  return (
    <>
      <header>
        <div className="kicker">概念</div>
        <h2>{c.name}</h2>
        <div className="meta">
          在 {c.hits.length} 份原始文献中出现 {total} 次
          {page !== 'concepts' && (
            <>
              {' · '}
              <button className="linklike" onClick={() => go('concepts')}>
                {pageDef('concepts').title} →
              </button>
            </>
          )}
        </div>
      </header>
      <section>
        <p>{c.summary}</p>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8 }}>匹配词：{c.terms.join('、')}</div>
        {c.notes.length > 0 && <Voices voices={c.notes} />}
      </section>
      {c.hits.length > 0 && (
        <section>
          <h3>
            原文语境（{doc ? `${hits.length} / ${c.hits.length}` : c.hits.length} 份文献）
            {doc && (
              <button className="linklike" style={{ marginLeft: 8, letterSpacing: 0, fontWeight: 400 }} onClick={() => select({ type: 'concept', id })}>
                显示全部
              </button>
            )}
          </h3>
          {hits.map((h, i) => (
            <div className="ctx" key={h.source} style={i ? undefined : { borderTop: 0 }}>
              <time>{fmtDate(h.date)}</time> · {h.count} 次{h.source === c.hits[0].source && ' · 首次出现'} <Cite cite={h.source} />
              <div className="q">…{highlight(h.context, c.terms)}…</div>
            </div>
          ))}
        </section>
      )}
      {c.related.length > 0 && (
        <section>
          <h3>相关概念</h3>
          <div className="chips">
            {c.related.map((r) => (
              <Entity key={r} refTo={{ type: 'concept', id: r }} />
            ))}
          </div>
        </section>
      )}
      {events.length > 0 && (
        <section>
          <h3>相关事件</h3>
          <EventList events={events} />
        </section>
      )}
      <ConceptNear id={id} />
      <ClaimLinks on="concept" id={id} />
    </>
  )
}
