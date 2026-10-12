import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { label, relationActive, statusAt, type Ref } from '../data/atlas'
import { ISM_KINDS, LANES, ORG_KINDS, ORG_LEVELS, RELATION_TYPES, SOURCE_KINDS, STATUSES, type Person } from '../data/schema'
import { fmtDate, fmtRange, fmtT, lifespan, toT } from '../lib/dates'
import { AXES, describe, ismColor } from '../lib/isms'
import { existsAt, isHead, parentAt, suspendedAt, within } from '../lib/orgs'
import { scrollWhenReady } from '../lib/history'
import { useApp } from '../state'
import { Cite, Entity, PersonChip, StatusDot, Verify, Voices } from './bits'
import { PersonFacts, PositionList } from './PersonFacts'
import { Portrait } from './Portrait'

const same = (a: Ref, b: Ref) => a.type === b.type && a.id === b.id && a.sub === b.sub

export function Drawer() {
  const { ix, sel, select } = useApp()
  // cards opened from inside the drawer stack up, so a citation followed from a person can lead back,
  // to the place in the card where the reader left it
  const [stack, setStack] = useState<{ ref: Ref; top: number }[]>([])
  const prev = useRef<Ref>(undefined)
  const backTo = useRef<number>(undefined)
  const aside = useRef<HTMLElement>(null)
  // last offset seen before the card changes; reading scrollTop after the swap would give the new card's clamp
  const top = useRef(0)
  useLayoutEffect(() => {
    const p = prev.current
    prev.current = sel
    const el = aside.current
    if (!sel) setStack([])
    else if (backTo.current !== undefined) {
      if (el) scrollWhenReady(el, backTo.current)
      backTo.current = undefined
    } else if (p && !same(p, sel)) {
      setStack((s) => [...s.slice(-9), { ref: p, top: top.current }])
      if (el) el.scrollTop = 0
    }
    top.current = el?.scrollTop ?? 0
  }, [sel])
  if (!sel) return null
  const back = stack[stack.length - 1]
  return (
    <aside className="drawer" aria-label="详情" ref={aside} onScroll={(e) => (top.current = e.currentTarget.scrollTop)}>
      <button className="close" onClick={() => select(undefined)} aria-label="关闭" title="关闭（Esc）">
        ×
      </button>
      {back && (
        <button
          className="drawer-back"
          onClick={() => {
            backTo.current = back.top
            setStack((s) => s.slice(0, -1))
            select(back.ref, true)
          }}
        >
          ← {label(ix, back.ref)}
        </button>
      )}
      {sel.type === 'person' && <PersonCard id={sel.id} />}
      {sel.type === 'event' && <EventCard id={sel.id} />}
      {sel.type === 'concept' && <ConceptCard id={sel.id} doc={sel.sub} />}
      {sel.type === 'faction' && <FactionCard id={sel.id} />}
      {sel.type === 'doc' && <DocCard id={sel.id} loc={sel.sub} />}
      {sel.type === 'org' && <OrgCard id={sel.id} />}
      {sel.type === 'ism' && <IsmCard id={sel.id} />}
      {sel.type === 'claim' && ix.claim.get(sel.id) && <ClaimCard id={sel.id} />}
    </aside>
  )
}

function PersonCard({ id }: { id: string }) {
  const { ix, t, openPerson } = useApp()
  const p = ix.person.get(id)
  if (!p) return null
  const events = ix.eventsByPerson.get(id) ?? []
  const rels = ix.relationsByPerson.get(id) ?? []
  const claims = ix.claims.filter((c) => c.people.includes(id))
  const now = statusAt(p, t)
  return (
    <>
      <header className="with-photo">
        <Portrait p={p} width={72} />
        <div>
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
            {' · '}
            <button className="linklike" onClick={() => openPerson(id)}>
              完整传记 →
            </button>
          </div>
          <div className="chips" style={{ marginTop: 8 }}>
            {p.factions.map((f) => (
              <Entity key={f} refTo={{ type: 'faction', id: f }} dot={ix.faction.get(f)?.color} />
            ))}
          </div>
        </div>
      </header>
      <section>
        <p>{p.bio}</p>
        <div className="chips">
          {p.cites.map((c) => (
            <Cite key={c} cite={c} />
          ))}
        </div>
        <PersonFacts p={p} />
      </section>
      {p.positions.length > 0 && (
        <section>
          <h3>职务</h3>
          <PositionList p={p} t={t} />
        </section>
      )}
      {p.fate.length > 0 && (
        <section>
          <h3>命运轨迹</h3>
          <FateLine p={p} />
        </section>
      )}
      {rels.length > 0 && (
        <section>
          <h3>关系（{rels.filter((r) => relationActive(r, t)).length} 条在当前时刻有效）</h3>
          <RelationList id={id} />
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
              <button className="linklike" onClick={() => go('ideas', 'concepts')}>
                概念 × 文献 →
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

function IsmChips({ title, list }: { title: string; list: string[] }) {
  const { ix } = useApp()
  if (!list.length) return null
  return (
    <div className="ism-rel">
      <span>{title}</span>
      <div className="chips">
        {list.map((id) => {
          const m = ix.ism.get(id)
          return m && <Entity key={id} refTo={{ type: 'ism', id }} dot={ismColor(m.kind)} />
        })}
      </div>
    </div>
  )
}

function MiniSpectrum({ points }: { points: { x: number; y: number }[] }) {
  const S = 96
  const p = (v: number) => ((v + 1) / 2) * (S - 12) + 6
  return (
    <svg width={S} height={S} className="mini-spectrum" aria-hidden>
      <rect x={0.5} y={0.5} width={S - 1} height={S - 1} fill="none" stroke="var(--rule-2)" />
      <line x1={S / 2} x2={S / 2} y1={0} y2={S} stroke="var(--rule)" />
      <line y1={S / 2} y2={S / 2} x1={0} x2={S} stroke="var(--rule)" />
      <polyline points={points.map((q) => `${p(q.x)},${p(-q.y)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth={1.2} />
      {points.map((q, i) => (
        <circle key={i} cx={p(q.x)} cy={p(-q.y)} r={i === points.length - 1 ? 3.5 : 2} fill="var(--accent)" />
      ))}
    </svg>
  )
}

function IsmCard({ id }: { id: string }) {
  const { ix, go, view } = useApp()
  const m = ix.ism.get(id)
  if (!m) return null
  const total = m.hits.reduce((s, h) => s + h.count, 0)
  const children = (ix.ismChildren.get(id) ?? []).map((c) => c.id)
  const opposed = (ix.ismOpposed.get(id) ?? []).map((c) => c.id)
  return (
    <>
      <header>
        <div className="kicker">
          主义 · {ISM_KINDS[m.kind]}
        </div>
        <h2>{m.name}</h2>
        <div className="meta">
          {fmtDate(m.from)}
          {m.to ? `–${fmtDate(m.to)}` : ' 起'}
          {view !== 'ideas' && (
            <>
              {' · '}
              <button className="linklike" onClick={() => go('ideas', 'tree')}>
                主义谱系 →
              </button>
            </>
          )}
        </div>
      </header>
      <section>
        <p>{m.summary}</p>
        {m.carriers.length > 0 && (
          <div className="ism-rel">
            <span>代表人物</span>
            <div className="chips">
              {m.carriers.map((c) => (c.person ? <PersonChip key={c.name} id={c.person} /> : <span key={c.name} className="chip nolink">{c.name}</span>))}
            </div>
          </div>
        )}
        <IsmChips title="源出" list={m.parents} />
        <IsmChips title="衍生" list={children} />
        <IsmChips title="针对" list={m.against} />
        <IsmChips title="被针对" list={opposed} />
        {m.notes.length > 0 && <Voices voices={m.notes} />}
        <div className="chips">
          {m.cites.map((c) => (
            <Cite key={c} cite={c} />
          ))}
        </div>
      </section>
      {m.pos.length > 0 && (
        <section>
          <h3>光谱位置（编者判断）</h3>
          <div className="ism-pos">
            <MiniSpectrum points={m.pos} />
            <ol>
              {m.pos.map((p) => (
                <li key={p.at}>
                  <time>{fmtDate(p.at)}</time> {describe(p)}
                  {p.note && <small>{p.note}</small>}
                </li>
              ))}
            </ol>
          </div>
          <p className="sub-note">
            横轴：{AXES.x[0]} ↔ {AXES.x[1]}；纵轴：{AXES.y[0]} ↔ {AXES.y[1]}。位置只表示相对立场，{m.kind === 'label' ? '罪名的位置是批判者对被批判者的描述，' : ''}不是测量。
          </p>
        </section>
      )}
      {m.terms.length > 0 && (
        <section>
          <h3>
            语料中（{m.hits.length} 份文献，{total} 次）
          </h3>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8 }}>匹配词：{m.terms.join('、')}</div>
          {m.hits.slice(0, 6).map((h, i) => (
            <div className="ctx" key={h.source} style={i ? undefined : { borderTop: 0 }}>
              <time>{fmtDate(h.date)}</time> · {h.count} 次{i === 0 && ' · 首次出现'} <Cite cite={h.source} />
              <div className="q">…{highlight(h.context, m.terms)}…</div>
            </div>
          ))}
          {m.hits.length > 6 && <p className="sub-note">另有 {m.hits.length - 6} 份文献。</p>}
          {!m.hits.length && <p className="sub-note">本站已收文献中未出现。</p>}
        </section>
      )}
      {m.concepts.length > 0 && (
        <section>
          <h3>相关概念</h3>
          <div className="chips">
            {m.concepts.map((c) => (
              <Entity key={c} refTo={{ type: 'concept', id: c }} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

function FactionCard({ id }: { id: string }) {
  const { ix, t } = useApp()
  const f = ix.faction.get(id)
  if (!f) return null
  const members = ix.people.filter((p) => p.factions.includes(id))
  const orgs = ix.orgsByFaction.get(id) ?? []
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
      {orgs.length > 0 && (
        <section>
          <h3>相关机构</h3>
          <div className="chips">
            {orgs.map((o) => (
              <Entity key={o.id} refTo={{ type: 'org', id: o.id }} dot={`var(--org-${o.kind})`} />
            ))}
          </div>
        </section>
      )}
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

const TIER_LABEL: Record<number, string> = { 1: '一手文献', 2: '官方整理', 3: '亲历者', 4: '研究与资料库' }
const ACCESS = { unread: '未读', partial: '读了一部分', read: '已读' }

// Preview of a source: bibliographic facts, the summary, and the opening of the text; the full text
// is a page of its own (文献 view).
function DocCard({ id, loc }: { id: string; loc?: string }) {
  const { ix, openDoc } = useApp()
  const s = ix.source.get(id)
  const d = ix.doc.get(id)
  const [head, setHead] = useState<string>()
  useEffect(() => {
    setHead(undefined)
    if (!s?.hasText) return
    let live = true
    fetch(`${import.meta.env.BASE_URL}data/texts/${id}.txt`)
      .then((r) => (r.ok ? r.text() : ''))
      .then((t) => live && setHead(t.replace(/\s+/g, ' ').trim().slice(0, 200) || undefined))
    return () => {
      live = false
    }
  }, [id, s?.hasText])
  if (!s) return null
  return (
    <>
      <header>
        <div className="kicker">
          {TIER_LABEL[s.tier] ?? '文献'} · {SOURCE_KINDS[s.kind as keyof typeof SOURCE_KINDS] ?? s.kind}
        </div>
        <h2>{s.alias ? `《${s.alias}》` : s.title}</h2>
        <div className="meta">{[fmtDate(s.date), s.author, s.publisher, loc && `引用位置 ${loc}`].filter(Boolean).join(' · ')}</div>
      </header>
      <section>
        {s.alias && <p className="sub-note">{s.title}</p>}
        {d && <p>{d.summary}</p>}
        {head && <p className="excerpt-head">{head}……</p>}
        {s.note && <p className="sub-note">{s.note}</p>}
        <div className="chips">
          {s.hasText && (
            <button className="chip" onClick={() => openDoc(id)}>
              打开全文 →
            </button>
          )}
          {s.url && (
            <a className="chip" href={s.url} target="_blank" rel="noreferrer">
              来源网页 ↗
            </a>
          )}
        </div>
        {!s.hasText && <p className="sub-note">本站未收全文{s.access ? `（阅读状态：${ACCESS[s.access]}）` : ''}。</p>}
      </section>
    </>
  )
}

function OrgCard({ id }: { id: string }) {
  const { ix, t, openOrg } = useApp()
  const o = ix.org.get(id)
  if (!o) return null
  const leaders = o.leaders.filter((l) => within(l, t))
  const held = (ix.tenuresByOrg.get(id) ?? []).filter((x) => within(x.pos, t) && isHead(x.pos.title, o))
  const parent = parentAt(o, t)
  const state = !existsAt(o, t) ? (o.from && t < toT(o.from) ? '尚未成立' : '已撤销或改组') : suspendedAt(o, t) ? '停止活动' : '存在'
  return (
    <>
      <header>
        <div className="kicker">
          机构 · {ORG_KINDS[o.kind]} · {ORG_LEVELS[o.level]}
        </div>
        <h2>
          {o.name} {o.verify && <Verify />}
        </h2>
        <div className="meta">
          {[o.from && o.to ? fmtRange(o.from, o.to) : o.from ? `${fmtDate(o.from)}起` : '', `${fmtT(t, 'month')}${state}`].filter(Boolean).join(' · ')}
          {' · '}
          <button className="linklike" onClick={() => openOrg(id)}>
            机构页 →
          </button>
        </div>
      </header>
      <section>
        <p>{o.summary}</p>
        <div className="chips">
          {o.cites.map((c) => (
            <Cite key={c} cite={c} />
          ))}
        </div>
      </section>
      {(leaders.length > 0 || held.length > 0) && (
        <section>
          <h3>此刻负责人</h3>
          <ul className="minilist">
            {leaders.map((l, i) => (
              <li key={`l${i}`}>
                {l.person ? <PersonChip id={l.person} /> : <b style={{ fontWeight: 500 }}>{l.name}</b>} <span style={{ color: 'var(--ink-2)' }}>{l.title}</span>
              </li>
            ))}
            {held
              .filter((x) => !leaders.some((l) => l.person === x.person.id))
              .map((x, i) => (
                <li key={`h${i}`}>
                  <PersonChip id={x.person.id} /> <span style={{ color: 'var(--ink-2)' }}>{x.pos.title}</span>
                </li>
              ))}
          </ul>
        </section>
      )}
      {parent && (
        <section>
          <h3>上级</h3>
          <Entity refTo={{ type: 'org', id: parent }} />
        </section>
      )}
    </>
  )
}

export function ClaimLinks({ ids }: { ids: string[] }) {
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
