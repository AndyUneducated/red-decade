// One-line summaries of the insight pages inside the cards and entity pages, each with a link to the page.
// The constants here are also the insight pages' own, so a card and its page always agree.
import type { ReactNode } from 'react'
import { factionAt, type Index, type Ref } from '../../data/atlas'
import { VOICES, type Status } from '../../data/schema'
import { nearest, survivalSubject, yearCodes, type Code } from '../../derive/fates'
import { toT } from '../../lib/dates'
import { page as pageDef, type PageId } from '../../pages'
import { useApp } from '../../state'
import { PersonChip } from '../bits'

export const MAO = 'mao-zedong'

export const SURVIVAL_T0 = toT('1965-11')
export const SURVIVAL_T1 = toT('1978-12', true)
export const FALLS: Record<'strict' | 'wide', ReadonlySet<Status>> = {
  strict: new Set(['purged', 'detained']),
  wide: new Set(['attacked', 'sidelined', 'purged', 'detained']),
}

export const LIFE_YEARS = Array.from({ length: 26 }, (_, i) => 1960 + i)
const codesCache = new WeakMap<Index, Map<string, Code[]>>()
// yearly codes of everyone with at least two fate nodes, computed once per atlas
export function lifeCodes(ix: Index): Map<string, Code[]> {
  let m = codesCache.get(ix)
  if (!m) codesCache.set(ix, (m = new Map(ix.people.filter((p) => p.fate.length >= 2).map((p) => [p.id, yearCodes(p, LIFE_YEARS)]))))
  return m
}

export const ATTRIBUTION_MIN_KINDS = 3

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

export function NearLives({ id }: { id: string }) {
  const { ix } = useApp()
  const near = nearest(lifeCodes(ix), id, 4)
  if (!near.length) return null
  return (
    <Note to="parallel" on={{ type: 'person', id }}>
      <p className="muted-note">1960–1985 年逐年处境最相近的人：</p>
      <div className="chips">
        {near.map((m) => (
          <span key={m.id} style={{ whiteSpace: 'nowrap' }}>
            <PersonChip id={m.id} /> <small className="muted-note">{Math.round((1 - m.d) * 100)}%</small>
          </span>
        ))}
      </div>
    </Note>
  )
}

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
              <span key={x.id} style={{ marginRight: 6, whiteSpace: 'nowrap' }}>
                <PersonChip id={x.id} /> <small className="muted-note">{x.n}</small>
              </span>
            ))}
          </li>
        ))}
      </ul>
    </Note>
  )
}

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
      {by.length > 0 && <p>被 {by.length} 份文本以书名号点名：{list(by.map((c) => c.from).slice(0, 8))}{by.length > 8 && ' 等'}</p>}
      {of.length > 0 && <p>点名了：{list(of.map((c) => c.to))}</p>}
    </Note>
  )
}
