import * as d3 from 'd3'
import { useMemo, useRef, useState } from 'react'
import { Cite, Entity, StatusLegend, Verify, Voices } from '../components/bits'
import { AgeRuler, IdCard, ProfileTimeline } from '../components/Dossier'
import { ClaimLinks, EventList, FateLine, RelationList } from '../components/Drawer'
import { Footprint } from '../components/Footprint'
import { LifeStrip } from '../components/LifeStrip'
import { PersonFacts, PositionList } from '../components/PersonFacts'
import { Portrait } from '../components/Portrait'
import { statusAt } from '../data/atlas'
import { ALIAS_KINDS, DEATH_KINDS, STATUSES, type Person } from '../data/schema'
import { fmtDate, fmtRange, fmtT, lifespan } from '../lib/dates'
import { useSize } from '../lib/useSize'
import { useApp } from '../state'

const T0 = 1880
const T1 = 2010
const TICKS = [1900, 1920, 1949, 1966, 1976, 1989]

const GROUPS = { faction: '按派系', birth: '按出生年代', end: '按结局' } as const
type Group = keyof typeof GROUPS

export function People() {
  const { doc } = useApp()
  return doc ? <Profile key={doc} id={doc} /> : <Directory />
}

function endLabel(p: Person) {
  if (p.deathKind) return DEATH_KINDS[p.deathKind] + (p.deathContested ? '（有争议）' : '')
  if (p.died) return '已去世 · 死因未录'
  return '生卒未录'
}

function Directory() {
  const { ix, openPerson, t } = useApp()
  const wrap = useRef<HTMLDivElement>(null)
  const { width } = useSize(wrap)
  const [group, setGroup] = useState<Group>('faction')
  const [q, setQ] = useState('')

  const narrow = width > 0 && width < 760
  const nameW = narrow ? 116 : 150
  const roleW = narrow ? 0 : Math.min(300, Math.max(160, width * 0.22))
  // list padding 2×20, row padding-left 8, two grid gaps of 14, and a margin for the death tick
  const stripW = Math.max(160, width - nameW - roleW - 84)
  const x = useMemo(() => d3.scaleLinear().domain([T0, T1]).range([0, stripW]), [stripW])

  const groups = useMemo(() => {
    const list = ix.people.filter(
      (p) => !q || [p.name, p.pinyin ?? '', p.role1966, ...(p.aka ?? []).map((a) => a.name)].some((s) => s.includes(q)),
    )
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
  }, [ix, group, q])

  const full = ix.people.filter((p) => p.life.length >= 3).length

  return (
    <div className="view">
      <div className="viewhead">
        <div>
          <h1>人物</h1>
          <p>
            每行一人，色带是一生的状态（{T0}–{T1} 同一时间轴，红线为 1966 年）。点名字看完整传记。已完成完整传记 {full} / {ix.people.length} 人。
          </p>
        </div>
        <div className="spacer" />
        <div className="legend">
          <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="筛选姓名、职务…" />
          {(Object.keys(GROUPS) as Group[]).map((k) => (
            <button key={k} className="chip" aria-pressed={group === k} onClick={() => setGroup(k)}>
              {GROUPS[k]}
            </button>
          ))}
        </div>
      </div>
      <div className="canvas people-list" ref={wrap}>
        <div className="people-axis" style={{ paddingLeft: nameW + roleW + 36 }}>
          <svg width={stripW} height={16} style={{ display: 'block', overflow: 'visible' }}>
            {(stripW < 300 ? [1900, 1949, 1989] : TICKS).map((yr) => (
              <text key={yr} x={x(yr)} y={12} textAnchor="middle" fontSize={10.5} fill="var(--muted)">
                {yr}
              </text>
            ))}
          </svg>
        </div>
        {groups.map((g) => (
          <section key={g.label}>
            <h2 className="people-group">
              {g.label} <span>{g.people.length}</span>
            </h2>
            {g.people.map((p) => {
              const now = statusAt(p, t)
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
                    <LifeStrip p={p} x={x} T1={T1} width={stripW} height={10} mark={1966} />
                  </span>
                </button>
              )
            })}
          </section>
        ))}
      </div>
      <div style={{ padding: '6px 20px 8px', borderTop: '1px solid var(--rule)' }}>
        <StatusLegend />
      </div>
    </div>
  )
}

function Profile({ id }: { id: string }) {
  const { ix, openPerson, t } = useApp()
  const p = ix.person.get(id)
  const wrap = useRef<HTMLDivElement>(null)
  const { width } = useSize(wrap)
  if (!p) return <Directory />
  const mainW = Math.min(720, Math.max(280, (width > 1100 ? width - 420 : width) - 64))
  const start = p.born ? Number(p.born.slice(0, 4)) - 2 : 1940
  const end = p.died ? Number(p.died.slice(0, 4)) + 2 : 1990
  const x = d3.scaleLinear().domain([start, end]).range([0, mainW])
  const ticks = x.ticks(Math.max(3, Math.floor(mainW / 90))).filter((y) => Number.isInteger(y))
  const events = ix.eventsByPerson.get(id) ?? []
  const claims = ix.claims.filter((c) => c.people.includes(id))
  const names = (p.aka ?? []).map((a) => `${ALIAS_KINDS[a.kind]}${a.name}`)
  const place = p.birthplace ?? p.origin

  return (
    <div className="view">
      <div className="profile" ref={wrap}>
        <div className="profile-inner">
          <nav className="crumbs">
            <button className="linklike" onClick={() => openPerson()}>
              ← 人物
            </button>
          </nav>
          <header className="profile-head">
            <div className="profile-id">
              <div>
                <div className="kicker">人物 · {p.role1966}</div>
                <h1>
                  {p.name} {p.verify && <Verify />}
                </h1>
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
              </div>
              <Portrait p={p} width={mainW < 420 ? 84 : 112} credit />
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
              {p.life.length === 0 && <p className="pending">完整传记尚未撰写（里程碑 MP-2）。现在只有概述、命运轨迹和 1966 年前后的事件。</p>}
              {p.life.map((s, i) => (
                <section key={i}>
                  <h2>
                    {s.h}
                    {(s.from || s.to) && <time>{fmtRange(s.from ?? '', s.to)}</time>}
                    {s.verify && <Verify />}
                  </h2>
                  {s.text.split(/\n{2,}/).map((para, j) => (
                    <p key={j}>{para}</p>
                  ))}
                  <div className="chips">
                    {s.cites.map((c) => (
                      <Cite key={c} cite={c} />
                    ))}
                  </div>
                </section>
              ))}
              {p.assess.length > 0 && (
                <section>
                  <h2>评价</h2>
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
              {(ix.relationsByPerson.get(id) ?? []).length > 0 && (
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
