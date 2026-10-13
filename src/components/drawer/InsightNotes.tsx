// One-line summaries of the insight pages inside the cards and entity pages, each with a link to the page.
// Each note renders nothing when its insight has nothing to say about the entity.
import type { ReactNode } from 'react'
import { factionAt, type Ref } from '../../data/atlas'
import { ORG_KINDS, SOURCE_KINDS, VOICES, type ConceptHit } from '../../data/schema'
import { fallsSince, nearest, survivalSubject } from '../../derive/fates'
import { PER_HEAD, perHead } from '../../derive/series'
import { fmtDate, toT } from '../../lib/dates'
import { existsAt, suspendedAt } from '../../lib/orgs'
import { page as pageDef, type PageId } from '../../pages'
import { useApp } from '../../state'
import {
  ATTRIBUTION_MIN_KINDS,
  AUTHORITY_MIN_CHARS,
  cosine,
  FALLS,
  firstsByKind,
  HOSTILE,
  lifeCodes,
  MAO,
  OVERLAP_T0,
  PARALYSIS_T0,
  PARALYSIS_T1,
  rhetoric,
  SURVIVAL_T0,
  SURVIVAL_T1,
} from '../../views/insights/shared'
import { PersonChip } from '../bits'

// on is the entity the note is about; the insight page opens with it selected where the page follows a selection
function Note({ to, on, children }: { to: PageId; on: Ref; children: ReactNode }) {
  const { go } = useApp()
  return (
    <section className="insight-note">
      <h3>
        洞察 · {pageDef(to).title}
        <button className="linklike" onClick={() => go(to, undefined, on)}>
          看全图 →
        </button>
      </h3>
      {children}
    </section>
  )
}

const nowrap = { whiteSpace: 'nowrap' } as const

// what the cards and entity pages place, one per kind of entity
export const PersonInsights = ({ id }: { id: string }) => (
  <>
    <PersonAuthority id={id} />
    <PersonActs id={id} />
    <NearLives id={id} />
  </>
)
export const FactionInsights = ({ id }: { id: string }) => (
  <>
    <FactionSurvival id={id} />
    <FactionFlows id={id} />
    <FactionRhetoric id={id} />
  </>
)
export const EventInsights = ({ id }: { id: string }) => (
  <>
    <EventVoices id={id} />
    <EventOutcomes id={id} />
  </>
)
export const DocInsights = ({ id }: { id: string }) => (
  <>
    <DocSelfCrit id={id} />
    <DocCitations id={id} />
  </>
)

// J
export function NearLives({ id }: { id: string }) {
  const { ix } = useApp()
  const near = nearest(lifeCodes(ix), id, 4)
  if (!near.length) return null
  return (
    <Note to="parallel" on={{ type: 'person', id }}>
      <p className="muted-note">1960–1985 年逐年处境最相近的人：</p>
      <div className="chips">
        {near.map((m) => (
          <span key={m.id} style={nowrap}>
            <PersonChip id={m.id} /> <small className="muted-note">{Math.round((1 - m.d) * 100)}%</small>
          </span>
        ))}
      </div>
    </Note>
  )
}

// H
export function PersonActs({ id }: { id: string }) {
  const { ix } = useApp()
  const p = ix.person.get(id)
  const acts = (ix.relationsByPerson.get(id) ?? []).filter((r) => r.a === id && HOSTILE.has(r.type) && r.from).sort((a, b) => toT(a.from) - toT(b.from))
  if (!p || !acts.length) return null
  const first = toT(acts[0].from)
  const falls = fallsSince(p, OVERLAP_T0, FALLS.strict)
  const after = falls.find((f) => toT(f.date) >= first)
  return (
    <Note to="overlap" on={{ type: 'person', id }}>
      <p>
        本站记录此人批判或诬陷他人 {acts.length} 次，第一次在 {fmtDate(acts[0].from)}。
        {after
          ? `此后 ${fmtDate(after.date)} 自己被打倒或关押。`
          : falls.length
            ? `被打倒在先（${fmtDate(falls[0].date)}）。`
            : `1949 年 10 月以后没有被打倒或关押的记录${p.died ? `；${fmtDate(p.died)}${p.death ? ` ${p.death}` : ' 去世'}` : ''}。`}
      </p>
    </Note>
  )
}

// B
export function PersonAuthority({ id }: { id: string }) {
  const { ix } = useApp()
  const term = ix.authorities.terms.find((x) => x.id === id)
  if (!term?.total) return null
  const rates = term.counts.flatMap((c) => {
    const chars = ix.authorities.years.find((y) => y.year === c.year)?.chars ?? 0
    return chars >= AUTHORITY_MIN_CHARS ? [{ year: c.year, r: (c.n / chars) * 1e4 }] : []
  })
  const peak = rates.sort((a, b) => b.r - a.r)[0]
  return (
    <Note to="authority" on={{ type: 'person', id }}>
      <p>
        作为权威在官方文本中被称引 {term.total} 次（计“{term.terms.join('”“')}”）
        {peak && `，最密的一年是 ${peak.year} 年，每万字 ${peak.r.toFixed(1)} 次`}。
      </p>
    </Note>
  )
}

// A
export function ConceptNear({ id }: { id: string }) {
  const { ix } = useApp()
  const periods = (ix.concept.get(id)?.near ?? []).map((p) => ({ ...p, people: p.people.filter((x) => x.id !== MAO).slice(0, 3) })).filter((p) => p.people.length)
  if (!periods.length) return null
  return (
    <Note to="drift" on={{ type: 'concept', id }}>
      <p className="muted-note">各时期文献里，这个词附近最常出现的人（毛泽东除外）：</p>
      <ul className="minilist">
        {periods.map((p) => (
          <li key={p.period}>
            <time>{p.period}</time>{' '}
            {p.people.map((x) => (
              <span key={x.id} style={{ marginRight: 6, ...nowrap }}>
                <PersonChip id={x.id} /> <small className="muted-note">{x.n}</small>
              </span>
            ))}
          </li>
        ))}
      </ul>
    </Note>
  )
}

// D
export function FirstUse({ on, hits }: { on: Ref; hits: ConceptHit[] }) {
  const { ix, select } = useApp()
  const firsts = firstsByKind(ix, hits)
  if (firsts.length < 2) return null
  return (
    <Note to="spread" on={on}>
      <p className="muted-note">各类文本中最早出现：</p>
      <ul className="minilist">
        {firsts.map((f) => (
          <li key={f.kind}>
            <time>{fmtDate(f.hit.date)}</time> {SOURCE_KINDS[f.kind]}{' '}
            <button className="linklike" onClick={() => select({ type: 'doc', id: f.hit.source })}>
              {ix.source.get(f.hit.source)?.alias ?? ix.source.get(f.hit.source)?.title}
            </button>
          </li>
        ))}
      </ul>
    </Note>
  )
}

// G
export function FactionSurvival({ id }: { id: string }) {
  const { ix } = useApp()
  const subjects = ix.people.flatMap((p) => {
    const s = factionAt(p, SURVIVAL_T0) === id ? survivalSubject(p, SURVIVAL_T0, SURVIVAL_T1, FALLS.strict) : undefined
    return s ? [s] : []
  })
  if (!subjects.length) return null
  const fell = subjects.filter((s) => s.fell).length
  return (
    <Note to="survival" on={{ type: 'faction', id }}>
      <p>
        1965 年 11 月时属于这一派、本站已建档的 {subjects.length} 人中，到 1978 年底有 {fell} 人被打倒、关押或非正常死亡。
      </p>
    </Note>
  )
}

// K
export function FactionFlows({ id }: { id: string }) {
  const { ix } = useApp()
  let out = 0
  let inside = 0
  let into = 0
  for (const r of ix.relations) {
    const a = ix.person.get(r.a)
    const b = ix.person.get(r.b)
    if (!HOSTILE.has(r.type) || !r.from || !a || !b) continue
    const t = toT(r.from)
    const [x, y] = [factionAt(a, t), factionAt(b, t)]
    if (x === id && y === id) inside++
    else if (x === id) out++
    else if (y === id) into++
  }
  if (!out && !inside && !into) return null
  return (
    <Note to="flows" on={{ type: 'faction', id }}>
      <p>
        本站记录的批判与诬陷中，
        {[out && `这一派的人攻击他派 ${out} 次`, inside && `同派相攻 ${inside} 次`, into && `受他派攻击 ${into} 次`].filter(Boolean).join('，')}
        （按关系发生时各人所属的派系）。
      </p>
    </Note>
  )
}

// L
export function FactionRhetoric({ id }: { id: string }) {
  const { ix } = useApp()
  const { profiles } = rhetoric(ix)
  const me = profiles.find((p) => p.f.id === id)
  if (!me) return null
  const near = profiles
    .filter((p) => p !== me)
    .map((p) => ({ p, c: cosine(me, p) }))
    .sort((a, b) => b.c - a.c)
    .slice(0, 3)
  return (
    <Note to="rhetoric" on={{ type: 'faction', id }}>
      <p className="muted-note">按 {me.texts.size} 份署名文本的用词，说话最像这一派的：</p>
      <div className="chips">
        {near.map(({ p, c }) => (
          <span key={p.f.id} style={nowrap}>
            <i className="dot" style={{ background: p.f.color }} /> {p.f.name} <small className="muted-note">{c.toFixed(2)}</small>
          </span>
        ))}
      </div>
    </Note>
  )
}

// C
export function EventVoices({ id }: { id: string }) {
  const { ix } = useApp()
  const e = ix.event.get(id)
  const kinds = new Set(e?.voices.map((v) => v.voice))
  if (kinds.size < ATTRIBUTION_MIN_KINDS) return null
  return (
    <Note to="attribution" on={{ type: 'event', id }}>
      <p className="muted-note">
        这件事有 {kinds.size} 种叙述：{[...kinds].map((k) => VOICES[k]).join('、')}。对照看各自点了谁的名。
      </p>
    </Note>
  )
}

// O
export function EventOutcomes({ id }: { id: string }) {
  const { ix } = useApp()
  const e = ix.event.get(id)
  const pop = ix.series.find((s) => s.id === 'population')
  if (!e || !pop) return null
  const year = Number(e.date.slice(0, 4))
  const rows = ix.series
    .filter((s) => s.events?.includes(id) && s.id !== 'population' && PER_HEAD[s.unit])
    .flatMap((s) => {
      const r = perHead(s, pop).find((x) => x.year === year)
      return r ? [{ s, r }] : []
    })
  if (!rows.length) return null
  return (
    <Note to="outcomes" on={{ type: 'event', id }}>
      <ul className="minilist">
        {rows.map(({ s, r }) => (
          <li key={s.id}>
            {year} 年{s.title}按人口折合每人 {r.value.toFixed(r.value < 10 ? 1 : 0)} {PER_HEAD[s.unit].unit}
            {r.point.kind === 'revised' ? '（修订数）' : ''}
            {r.popFrom.length > 1 ? '，人口为前后两次统计之间的插值' : ''}
          </li>
        ))}
      </ul>
    </Note>
  )
}

// N
export function OrgParalysis({ id }: { id: string }) {
  const { ix } = useApp()
  const o = ix.org.get(id)
  const s = o?.suspended.find((x) => toT(x.from) >= PARALYSIS_T0 && toT(x.from) < PARALYSIS_T1)
  if (!o || !s) return null
  const t = toT(s.from)
  const same = ix.orgs.filter((x) => x.kind === o.kind && existsAt(x, t) && suspendedAt(x, t)).length
  return (
    <Note to="paralysis" on={{ type: 'org', id }}>
      <p>
        {fmtDate(s.from)} 起停止活动{s.to ? `，${fmtDate(s.to)} 恢复` : ''}。当时本站档案中同类机构（{ORG_KINDS[o.kind]}）有 {same} 个处于停止状态，含本机构。
      </p>
    </Note>
  )
}

// E
export function DocSelfCrit({ id }: { id: string }) {
  const { ix } = useApp()
  const text = ix.selfcrit.texts.find((x) => x.id === id)
  if (!text) return null
  const top = ix.selfcrit.phrases
    .map((p) => ({ name: p.name, n: p.hits.find((h) => h.source === id)?.count ?? 0 }))
    .filter((p) => p.n)
    .sort((a, b) => b.n - a.n)
    .slice(0, 6)
  return (
    <Note to="selfcrit" on={{ type: 'doc', id }}>
      <p className="muted-note">
        全文 {text.chars} 字。用得最多的检讨用语：{top.map((p) => `${p.name} ${p.n}`).join('、')}。
      </p>
    </Note>
  )
}

// F
export function DocCitations({ id }: { id: string }) {
  const { ix, select } = useApp()
  const by = ix.citations.filter((c) => c.to === id)
  const of = ix.citations.filter((c) => c.from === id)
  if (!by.length && !of.length) return null
  const list = (ids: string[]) =>
    ids.map((d, i) => (
      <span key={d}>
        {i > 0 && '；'}
        <button className="linklike" onClick={() => select({ type: 'doc', id: d })}>
          {ix.source.get(d)?.alias ?? ix.source.get(d)?.title ?? d}
        </button>
      </span>
    ))
  return (
    <Note to="citations" on={{ type: 'doc', id }}>
      {by.length > 0 && (
        <p>
          被 {by.length} 份文本以书名号点名：{list(by.map((c) => c.from).slice(0, 8))}
          {by.length > 8 && ' 等'}
        </p>
      )}
      {of.length > 0 && <p>点名了：{list(of.map((c) => c.to))}</p>}
    </Note>
  )
}
