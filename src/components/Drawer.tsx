import { relationActive, statusAt } from '../data/atlas'
import { LANES, RELATION_TYPES, STATUSES } from '../data/schema'
import { fmtDate, fmtRange, lifespan, toT } from '../lib/dates'
import { useApp } from '../state'
import { Cite, Entity, PersonChip, StatusDot, Verify, Voices } from './bits'

export function Drawer() {
  const { ix, sel, select } = useApp()
  if (!sel) return null
  return (
    <aside className="drawer" aria-label="详情">
      <button className="close" onClick={() => select(undefined)} aria-label="关闭">
        ×
      </button>
      {sel.type === 'person' && <PersonCard id={sel.id} />}
      {sel.type === 'event' && <EventCard id={sel.id} />}
      {sel.type === 'concept' && <ConceptCard id={sel.id} doc={sel.sub} />}
      {sel.type === 'faction' && <FactionCard id={sel.id} />}
      {sel.type === 'doc' && <DocCard id={sel.id} />}
      {sel.type === 'claim' && ix.claim.get(sel.id) && <ClaimCard id={sel.id} />}
    </aside>
  )
}

function PersonCard({ id }: { id: string }) {
  const { ix, t } = useApp()
  const p = ix.person.get(id)
  if (!p) return null
  const events = ix.eventsByPerson.get(id) ?? []
  const rels = ix.relationsByPerson.get(id) ?? []
  const claims = ix.claims.filter((c) => c.people.includes(id))
  const now = statusAt(p, t)
  return (
    <>
      <header>
        <div className="kicker">人物 · {p.role1966}</div>
        <h2>
          {p.name} {p.verify && <Verify />}
        </h2>
        <div className="meta">
          {lifespan(p.born, p.died)}
          {p.death && ` · ${p.death}`}
          {now && (
            <>
              {' · 此刻 '}
              <StatusDot s={now} /> {STATUSES[now]}
            </>
          )}
        </div>
        <div className="chips" style={{ marginTop: 8 }}>
          {p.factions.map((f) => (
            <Entity key={f} refTo={{ type: 'faction', id: f }} dot={ix.faction.get(f)?.color} />
          ))}
        </div>
      </header>
      <section>
        <p>{p.bio}</p>
        <div className="chips">
          {p.cites.map((c) => (
            <Cite key={c} cite={c} />
          ))}
        </div>
      </section>
      {p.fate.length > 0 && (
        <section>
          <h3>命运轨迹</h3>
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
        </section>
      )}
      {rels.length > 0 && (
        <section>
          <h3>关系（{rels.filter((r) => relationActive(r, t)).length} 条在当前时刻有效）</h3>
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
        </section>
      )}
      {events.length > 0 && (
        <section>
          <h3>相关事件</h3>
          <EventList events={events} />
        </section>
      )}
      {claims.length > 0 && <ClaimLinks ids={claims.map((c) => c.id)} />}
    </>
  )
}

function EventList({ events }: { events: { id: string; date: string; title: string }[] }) {
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

function EventCard({ id }: { id: string }) {
  const { ix } = useApp()
  const e = ix.event.get(id)
  if (!e) return null
  const claims = ix.claims.filter((c) => c.events.includes(id))
  return (
    <>
      <header>
        <div className="kicker">
          事件 · {LANES[e.lane]}
          {e.place && ` · ${e.place}`}
        </div>
        <h2>{e.title}</h2>
        <div className="meta">
          {fmtRange(e.date, e.end)} {e.verify && <Verify />}
        </div>
      </header>
      <section>
        <p>{e.summary}</p>
        <div className="chips">
          {e.cites.map((c) => (
            <Cite key={c} cite={c} />
          ))}
        </div>
      </section>
      {e.voices.length > 0 && (
        <section>
          <h3>多声部</h3>
          <Voices voices={e.voices} />
        </section>
      )}
      {e.people.length > 0 && (
        <section>
          <h3>人物</h3>
          <div className="chips">
            {e.people.map((p) => (
              <PersonChip key={p} id={p} />
            ))}
          </div>
        </section>
      )}
      {(e.concepts.length > 0 || e.docs.length > 0) && (
        <section>
          <h3>概念与文献</h3>
          <div className="chips">
            {e.concepts.map((c) => (
              <Entity key={c} refTo={{ type: 'concept', id: c }} />
            ))}
            {e.docs.map((d) => (
              <Cite key={d} cite={d} />
            ))}
          </div>
        </section>
      )}
      {claims.length > 0 && <ClaimLinks ids={claims.map((c) => c.id)} />}
    </>
  )
}

function highlight(text: string, terms: string[]) {
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))
}

function ConceptCard({ id, doc }: { id: string; doc?: string }) {
  const { ix, go, view, select } = useApp()
  const c = ix.concept.get(id)
  if (!c) return null
  const events = ix.events.filter((e) => e.concepts.includes(id))
  const claims = ix.claims.filter((cl) => cl.concepts.includes(id))
  const total = c.hits.reduce((s, h) => s + h.count, 0)
  const hits = doc ? c.hits.filter((h) => h.source === doc) : c.hits
  return (
    <>
      <header>
        <div className="kicker">概念</div>
        <h2>{c.name}</h2>
        <div className="meta">
          在 {c.hits.length} 份原始文献中出现 {total} 次
          {view !== 'ideas' && (
            <>
              {' · '}
              <button className="linklike" onClick={() => go('ideas')}>
                查看谱系 →
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
      {claims.length > 0 && <ClaimLinks ids={claims.map((c) => c.id)} />}
    </>
  )
}

function FactionCard({ id }: { id: string }) {
  const { ix, t } = useApp()
  const f = ix.faction.get(id)
  if (!f) return null
  const members = ix.people.filter((p) => p.factions.includes(id))
  return (
    <>
      <header>
        <div className="kicker">派系 / 群体</div>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <i style={{ width: 14, height: 14, borderRadius: 3, background: f.color, display: 'inline-block' }} />
          {f.name}
        </h2>
        <div className="meta">{f.from || f.to ? fmtRange(f.from ?? '', f.to) : ''}</div>
      </header>
      <section>
        <p>{f.summary}</p>
        <div className="chips">
          {f.cites.map((c) => (
            <Cite key={c} cite={c} />
          ))}
        </div>
      </section>
      <section>
        <h3>成员（{members.length}）· 此刻状态</h3>
        <ul className="minilist">
          {members.map((p) => (
            <li key={p.id}>
              <StatusDot s={statusAt(p, t)} /> <PersonChip id={p.id} />
              <span style={{ color: 'var(--muted)', marginLeft: 6, fontSize: 11.5 }}>{p.role1966}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function DocCard({ id }: { id: string }) {
  const { ix, openDoc } = useApp()
  const s = ix.source.get(id)
  const d = ix.doc.get(id)
  if (!s) return null
  return (
    <>
      <header>
        <div className="kicker">原始文献</div>
        <h2>{s.alias ? `《${s.alias}》` : s.title}</h2>
        <div className="meta">
          {fmtDate(s.date)} · {s.author}
        </div>
      </header>
      <section>
        {d && <p>{d.summary}</p>}
        {s.hasText && (
          <button className="chip" onClick={() => openDoc(id)}>
            打开全文 →
          </button>
        )}
      </section>
    </>
  )
}

function ClaimLinks({ ids }: { ids: string[] }) {
  const { ix, select } = useApp()
  return (
    <section>
      <h3>本站研究结论</h3>
      <ul className="minilist">
        {ids.map((id) => (
          <li key={id}>
            <button className="linklike" onClick={() => select({ type: 'claim', id })}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', marginRight: 6 }}>
                {id}
              </span>
              {ix.claim.get(id)!.statement.slice(0, 64)}…
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

const CLAIM_STATUS = { supported: '证据支持', partial: '部分支持', contested: '有争议', open: '待研究' }

export function ClaimCard({ id, inline }: { id: string; inline?: boolean }) {
  const { ix } = useApp()
  const c = ix.claim.get(id)!
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
