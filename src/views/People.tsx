import { PageTitle } from '../components/PageTitle'
import * as d3 from 'd3'
import { Fragment, useMemo, useRef, type CSSProperties } from 'react'
import { Cite, Entity, StatusLegend, Verify, Voices } from '../components/bits'
import { AgeRuler, IdCard, ProfileTimeline } from '../components/Dossier'
import { ClaimLinks, EventList, FateLine, RelationList } from '../components/Drawer'
import { Footprint } from '../components/Footprint'
import { LifeStrip } from '../components/LifeStrip'
import { PersonFacts, PositionList } from '../components/PersonFacts'
import { Portrait } from '../components/Portrait'
import { LONG_MARKS, Scrubber } from '../components/Scrubber'
import { statusAt } from '../data/atlas'
import { ALIAS_KINDS, DEATH_KINDS, STATUSES, VOICES, type Person, type PersonQuote, type Status } from '../data/schema'
import { fmtDate, fmtRange, fmtT, lifespan, toT } from '../lib/dates'
import { useSize } from '../lib/useSize'
import { useApp, useHistoryState } from '../state'

const T0 = 1880
const T1 = 2010
const TICKS = [1900, 1920, 1949, 1966, 1976, 1989]

const GROUPS = { faction: '按派系', birth: '按出生年代', end: '按结局' } as const
type Group = keyof typeof GROUPS

// the scrubber covers the working lives in the register rather than the whole 1880–2010 strip
const S0 = 1900
const S1 = 1990

// a recorded death date counts even where the fate line has no 'dead' node
const statusNow = (p: Person, t: number): Status | undefined => (p.died && toT(p.died) <= t ? 'dead' : statusAt(p, t))

export function People() {
  const { param } = useApp()
  return param ? <Profile key={param} id={param} /> : <Directory />
}

// Where each quote goes on the profile. Dated ones join the life section that had begun by then; undated
// words of the person follow the lead, undated words about them open 评价. Without a full biography the
// dated ones fall back the same way.
function placeQuotes(p: Person) {
  const lead: PersonQuote[] = []
  const assess: PersonQuote[] = []
  const chapters = new Map<number, PersonQuote[]>()
  const sorted = [...p.quotes].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))
  for (const q of sorted) {
    if (!q.date || !p.life.length) {
      ;(q.by ? assess : lead).push(q)
      continue
    }
    const t = toT(q.date)
    let at = 0
    p.life.forEach((s, i) => s.from && toT(s.from) <= t + 1e-6 && (at = i))
    chapters.set(at, [...(chapters.get(at) ?? []), q])
  }
  return { lead, assess, chapters }
}

// spread k quotes through a section of n paragraphs: the quote at index i follows paragraph slot(i)
const slot = (i: number, k: number, n: number) => Math.max(0, Math.round(((i + 1) * n) / (k + 1)) - 1)

function PullQuote({ p, q }: { p: Person; q: PersonQuote }) {
  const { ix, select } = useApp()
  const who = q.by ? ix.person.get(q.by) : undefined
  const voice = q.voice ?? 'doc'
  return (
    <blockquote className="pull" data-by={q.by ? 'other' : 'self'} style={{ '--vc': `var(--v-${voice})` } as CSSProperties}>
      <p>{q.text}</p>
      <footer>
        {who ? (
          <button className="linklike" onClick={() => select({ type: 'person', id: who.id })}>
            {who.name}
          </button>
        ) : (
          (q.by ?? p.name)
        )}
        {q.date && ` · ${fmtDate(q.date)}`}
        {q.note && ` · ${q.note}`} <Cite cite={q.cite} />
      </footer>
    </blockquote>
  )
}

function chapterColor(p: Person, from?: string) {
  const s = from ? statusAt(p, toT(from)) : undefined
  return s ? `var(--s-${s})` : 'var(--s-normal)'
}

function endLabel(p: Person) {
  if (p.deathKind) return DEATH_KINDS[p.deathKind] + (p.deathContested ? '（有争议）' : '')
  if (p.died) return '已去世 · 死因未录'
  return '生卒未录'
}

// a folded group's status make-up at t, one segment per status in legend order
function StatusMix({ people, t }: { people: Person[]; t: number }) {
  const n = new Map<Status, number>()
  for (const p of people) {
    const s = statusNow(p, t)
    if (s) n.set(s, (n.get(s) ?? 0) + 1)
  }
  const total = [...n.values()].reduce((a, b) => a + b, 0)
  if (!total) return null
  return (
    <span className="status-mix" title={(Object.keys(STATUSES) as Status[]).filter((s) => n.has(s)).map((s) => `${STATUSES[s]} ${n.get(s)}`).join(' · ')}>
      {(Object.keys(STATUSES) as Status[])
        .filter((s) => n.has(s))
        .map((s) => (
          <i key={s} style={{ flexGrow: n.get(s), background: `var(--s-${s})` }} />
        ))}
    </span>
  )
}

function Directory() {
  const { ix, openPerson, t } = useApp()
  const wrap = useRef<HTMLDivElement>(null)
  const { width } = useSize(wrap)
  const [group, setGroup] = useHistoryState<Group>('people.group', 'faction')
  const [q, setQ] = useHistoryState('people.q', '')
  const [alive, setAlive] = useHistoryState('people.alive', false)
  const [st, setSt] = useHistoryState<Status | undefined>('people.status', undefined)
  // groups start folded; a name search or a status filter shows every match
  const [unfolded, setUnfolded] = useHistoryState<string[]>(`people.open.${group}`, [])
  const filtering = !!q || !!st

  const narrow = width > 0 && width < 760
  const nameW = narrow ? 116 : 150
  const roleW = narrow ? 0 : Math.min(300, Math.max(160, width * 0.22))
  // list padding 2×20, row padding-left 8, two grid gaps of 14, and a margin for the death tick
  const stripW = Math.max(160, width - nameW - roleW - 84)
  const x = useMemo(() => d3.scaleLinear().domain([T0, T1]).range([0, stripW]), [stripW])

  const counts = useMemo(() => {
    const m = new Map<Status, number>()
    for (const p of ix.people) {
      const s = statusNow(p, t)
      if (s) m.set(s, (m.get(s) ?? 0) + 1)
    }
    return m
  }, [ix, t])
  const living = ix.people.filter((p) => {
    const s = statusNow(p, t)
    return s && s !== 'dead'
  }).length

  const groups = useMemo(() => {
    const list = ix.people.filter((p) => {
      if (q && ![p.name, p.pinyin ?? '', p.role1966, ...(p.aka ?? []).map((a) => a.name)].some((s) => s.includes(q))) return false
      const s = statusNow(p, t)
      if (alive && (!s || s === 'dead')) return false
      return !st || s === st
    })
    const key = (p: Person): [string, string] => {
      if (group === 'faction') {
        const f = ix.primaryFaction(p)
        return [String(ix.factions.indexOf(f!)).padStart(3, '0'), f?.name ?? '']
      }
      if (group === 'birth') {
        const d = p.born ? `${p.born.slice(0, 3)}0` : '9999'
        return [d, p.born ? `${d} 年代出生` : '生年未录']
      }
      return [endLabel(p), endLabel(p)]
    }
    const out = new Map<string, { label: string; people: Person[] }>()
    for (const p of list) {
      const [k, label] = key(p)
      if (!out.has(k)) out.set(k, { label, people: [] })
      out.get(k)!.people.push(p)
    }
    for (const g of out.values()) g.people.sort((a, b) => a.tier - b.tier || (a.born ?? '').localeCompare(b.born ?? ''))
    return [...out.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, g]) => g)
  }, [ix, group, q, alive, st, t])
  const shown = groups.reduce((n, g) => n + g.people.length, 0)
  const isOpen = (label: string) => filtering || unfolded.includes(label)
  const allOpen = groups.every((g) => isOpen(g.label))

  const full = ix.people.filter((p) => p.life.length >= 3).length

  return (
    <div className="view">
      <div className="viewhead">
        <div>
          <PageTitle />
          <p>
            每行一人，色带是一生的状态（{T0}–{T1} 同一时间轴），红线是时间轴上的此刻。点名字看完整传记。已完成完整传记 {full} / {ix.people.length} 人；{fmtT(t, 'month')}在世 {living} 人。底部按此刻的状态计数，点一种状态只看这些人。
          </p>
        </div>
        <div className="spacer" />
        <div className="legend">
          <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="筛选姓名、职务…" />
          <button className="chip" aria-pressed={alive} onClick={() => setAlive((v) => !v)}>
            只看此刻在世
          </button>
          {(Object.keys(GROUPS) as Group[]).map((k) => (
            <button key={k} className="chip" aria-pressed={group === k} onClick={() => setGroup(k)}>
              {GROUPS[k]}
            </button>
          ))}
          {!filtering && (
            <button className="chip" onClick={() => setUnfolded(allOpen ? [] : groups.map((g) => g.label))}>
              {allOpen ? '全部收起' : '全部展开'}
            </button>
          )}
        </div>
      </div>
      <Scrubber min={S0} max={S1} marks={LONG_MARKS} />
      <div className="canvas people-list" ref={wrap}>
        <div className="people-axis" style={{ paddingLeft: nameW + roleW + 36 }}>
          <svg width={stripW} height={16} style={{ display: 'block', overflow: 'visible' }}>
            {(stripW < 300 ? [1900, 1949, 1989] : TICKS).map((yr) => (
              <text key={yr} x={x(yr)} y={12} textAnchor="middle" fontSize={10.5} fill="var(--muted)">
                {yr}
              </text>
            ))}
            <path d={`M${x(t)},16l-4,-5h8z`} fill="var(--accent)" />
          </svg>
        </div>
        {shown === 0 && <p className="muted-note">{fmtT(t, 'month')}没有符合条件的人物。</p>}
        {groups.map((g) => (
          <section key={g.label}>
            <h2 className="people-group">
              <button
                aria-expanded={isOpen(g.label)}
                disabled={filtering}
                onClick={() => setUnfolded((u) => (u.includes(g.label) ? u.filter((l) => l !== g.label) : [...u, g.label]))}
              >
                <span className="fold" aria-hidden />
                <b>
                  {g.label} <span>{g.people.length}</span>
                </b>
                {!isOpen(g.label) && <StatusMix people={g.people} t={t} />}
              </button>
            </h2>
            {isOpen(g.label) && g.people.map((p) => {
              const now = statusNow(p, t)
              return (
                <button
                  key={p.id}
                  className="people-row"
                  title={now ? `${fmtT(t, 'month')}：${STATUSES[now]}` : undefined}
                  onClick={() => openPerson(p.id)}
                  style={{ gridTemplateColumns: `${nameW}px ${roleW}px ${stripW}px` }}
                >
                  <span className="nm">
                    <b>{p.name}</b>
                    <small>{lifespan(p.born, p.died)}</small>
                  </span>
                  {roleW > 0 ? <span className="role">{p.role1966}</span> : <span />}
                  <span className="strip">
                    <LifeStrip p={p} x={x} T1={T1} width={stripW} height={10} t={t} />
                  </span>
                </button>
              )
            })}
          </section>
        ))}
      </div>
      <div style={{ padding: '6px 20px 8px', borderTop: '1px solid var(--rule)' }}>
        <StatusLegend counts={counts} on={st} onPick={setSt} />
      </div>
    </div>
  )
}

function Profile({ id }: { id: string }) {
  const { ix, t, back } = useApp()
  const p = ix.person.get(id)
  const wrap = useRef<HTMLDivElement>(null)
  const { width } = useSize(wrap)
  if (!p) return <Directory />
  const mainW = Math.min(720, Math.max(280, (width > 1100 ? width - 420 : width) - 78))
  const start = p.born ? Number(p.born.slice(0, 4)) - 2 : 1940
  const end = p.died ? Number(p.died.slice(0, 4)) + 2 : 1990
  const x = d3.scaleLinear().domain([start, end]).range([0, mainW])
  const ticks = x.ticks(Math.max(3, Math.floor(mainW / 90))).filter((y) => Number.isInteger(y))
  const events = ix.eventsByPerson.get(id) ?? []
  const claims = ix.claims.filter((c) => c.people.includes(id))
  const names = (p.aka ?? []).map((a) => `${ALIAS_KINDS[a.kind]}${a.name}`)
  const place = p.birthplace ?? p.origin
  const rels = ix.relationsByPerson.get(id) ?? []
  const now = statusAt(p, t)
  const age = (d?: string) => (p.born && d ? Math.floor(toT(d) - toT(p.born) + 1e-6) : undefined)
  const stats = [
    { l: '享年', n: age(p.died), u: '岁' },
    { l: '1966 年时', n: !p.died || toT(p.died) > 1966.37 ? age('1966-05-16') : undefined, u: '岁' },
    { l: '职务', n: p.positions.length },
    { l: '相关事件', n: events.length },
    { l: '关系', n: rels.length },
  ].filter((s) => s.n !== undefined && s.n > 0)
  const pull = p.assess.find((v) => v.quote && v.text.length <= 150 && !p.quotes.some((q) => v.text.startsWith(q.text)))
  const placed = placeQuotes(p)
  const ret = back('people')

  return (
    <div className="view">
      <div className="profile" ref={wrap}>
        <div className="profile-inner">
          <nav className="crumbs">
            <button className="linklike" onClick={ret.run}>
              ← {ret.label}
            </button>
          </nav>
          <header className="profile-head hero" style={{ '--fc': ix.primaryFaction(p)?.color ?? 'var(--accent)' } as CSSProperties}>
            <div className="hero-mark" aria-hidden>
              {p.name.slice(0, 1)}
            </div>
            <div className="profile-id">
              <div>
                <div className="kicker">人物 · {p.role1966}</div>
                <h1>
                  {p.name} {p.verify && <Verify />}
                </h1>
                {p.pinyin && <div className="pinyin">{p.pinyin}</div>}
                <div className="meta">
                  {[
                    fmtRange(p.born ?? '?', p.died),
                    place && `${place}人`,
                    p.died && p.deathKind && DEATH_KINDS[p.deathKind],
                    names.length ? names.join('，') : undefined,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                <div className="chips" style={{ marginTop: 10 }}>
                  {p.factions.map((f) => (
                    <Entity key={f} refTo={{ type: 'faction', id: f }} dot={ix.faction.get(f)?.color} />
                  ))}
                </div>
                {stats.length > 0 && (
                  <dl className="hero-stats">
                    {stats.map((s) => (
                      <div key={s.l}>
                        <dd>
                          {s.n}
                          {s.u && <small>{s.u}</small>}
                        </dd>
                        <dt>{s.l}</dt>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
              <div className="hero-photo" style={{ '--pw': `${mainW < 420 ? 92 : 148}px` } as CSSProperties}>
                <Portrait p={p} width={mainW < 420 ? 92 : 148} credit />
                {now && (
                  <div className="stamp" style={{ '--st': now === 'normal' ? 'var(--ink-2)' : `var(--s-${now})` } as CSSProperties} title="当前时刻的状态，随时间轴变化">
                    <small>{fmtT(t, 'month')}</small>
                    {STATUSES[now]}
                  </div>
                )}
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <ProfileTimeline p={p} x={x} width={mainW} end={end} ticks={ticks} />
            </div>
          </header>
          <div className="profile-grid">
            <article className="bio">
              <p className="lead">{p.bio}</p>
              <div className="chips">
                {p.cites.map((c) => (
                  <Cite key={c} cite={c} />
                ))}
              </div>
              {pull && (
                <blockquote className="pull" style={{ '--vc': `var(--v-${pull.voice})` } as CSSProperties}>
                  <p>{pull.text.replace(/（[^）]*）$/, '')}</p>
                  <footer>
                    {VOICES[pull.voice]}
                    {pull.text.match(/（([^）]*)）$/)?.[1] && ` · ${pull.text.match(/（([^）]*)）$/)![1]}`} <Cite cite={pull.cite} />
                  </footer>
                </blockquote>
              )}
              {placed.lead.map((q) => (
                <PullQuote key={q.text} p={p} q={q} />
              ))}
              {p.life.length === 0 && <p className="pending">完整传记尚未撰写（里程碑 MP-2）。现在只有概述、命运轨迹和 1966 年前后的事件。</p>}
              {p.life.map((s, i) => (
                <section
                  key={i}
                  className="chapter"
                  style={{ '--cc': chapterColor(p, s.from) } as CSSProperties}
                >
                  <h2>
                    {s.h}
                    {(s.from || s.to) && <time>{fmtRange(s.from ?? '', s.to)}</time>}
                    {s.verify && <Verify />}
                  </h2>
                  {s.text.split(/\n{2,}/).map((para, j, paras) => (
                    <Fragment key={j}>
                      <p>{para}</p>
                      {(placed.chapters.get(i) ?? [])
                        .filter((_, k, qs) => slot(k, qs.length, paras.length) === j)
                        .map((q) => (
                          <PullQuote key={q.text} p={p} q={q} />
                        ))}
                    </Fragment>
                  ))}
                  <div className="chips">
                    {s.cites.map((c) => (
                      <Cite key={c} cite={c} />
                    ))}
                  </div>
                </section>
              ))}
              {(p.assess.length > 0 || placed.assess.length > 0) && (
                <section>
                  <h2>评价</h2>
                  {placed.assess.map((q) => (
                    <PullQuote key={q.text} p={p} q={q} />
                  ))}
                  <Voices voices={p.assess} />
                </section>
              )}
              {p.works.length > 0 && (
                <section>
                  <h2>著述</h2>
                  <ul className="minilist">
                    {p.works.map((w, i) => (
                      <li key={i}>
                        {w.date && <time>{fmtDate(w.date)}</time>}《{w.title}》 <Cite cite={w.cite} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </article>
            <aside className="profile-side">
              <section>
                <h3>档案</h3>
                <IdCard p={p} />
                <PersonFacts p={p} />
              </section>
              <section>
                <h3>年龄标尺</h3>
                <AgeRuler p={p} />
              </section>
              {(p.birthAt || p.deathAt || p.positions.some((x) => x.org)) && (
                <section>
                  <h3>足迹地图</h3>
                  <Footprint p={p} />
                </section>
              )}
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
                  <h3>关系</h3>
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
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
