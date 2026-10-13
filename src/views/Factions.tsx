import * as d3 from 'd3'
import { useMemo, useRef, type CSSProperties } from 'react'
import { Cite, StatusDot } from '../components/bits'
import { FactionInsights } from '../components/drawer/InsightNotes'
import { ClaimLinks } from '../components/drawer/lists'
import { PageTitle } from '../components/PageTitle'
import { LifeStrip } from '../components/LifeStrip'
import { LONG_MARKS, Scrubber } from '../components/Scrubber'
import { factionAt, statusAt } from '../data/atlas'
import { ORG_LEVELS, STATUSES, type Faction, type Person, type Status } from '../data/schema'
import { CONTROL_FROM, CONTROL_TO, controlAt, controlRuns } from '../lib/control'
import { fmtRange, fmtT, toT } from '../lib/dates'
import { LEVEL_ORDER } from '../lib/orgs'
import { useSize } from '../lib/useSize'
import { useApp } from '../state'

const KINDS: Record<Faction['kind'], string> = {
  core: '核心',
  group: '集团',
  institution: '体制内',
  mass: '群众',
  target: '被打击群体',
  dissent: '异见',
}
const KIND_ORDER = Object.keys(KINDS) as Faction['kind'][]

// the person strips cover the working lives in the register; control is only computed 1959–1981
const P0 = 1900
const P1 = 1990
const STANDING = new Set<Status>(['power', 'rise', 'restored', 'normal'])

const statusNow = (p: Person, t: number): Status | undefined => (p.died && toT(p.died) <= t ? 'dead' : statusAt(p, t))

export function Factions() {
  const { ix, param, open } = useApp()
  const f = (param && ix.faction.get(param)) || ix.factions[0]
  const members = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of ix.people) for (const id of p.factions) m.set(id, (m.get(id) ?? 0) + 1)
    return m
  }, [ix])

  return (
    <div className="view">
      <div className="viewhead">
        <div>
          <PageTitle />
          <p>
            1965–1966 年格局下划分的 {ix.factions.length} 个派系与群体：党内派别、中央小组、体制内系统、群众组织、被打击的群体和异见者。一人可属几派，“在位”与“掌控”按每人此刻的归属计。拖动时间轴看各派此刻的状态。
          </p>
        </div>
      </div>
      <Scrubber min={1949} max={P1} marks={LONG_MARKS} />
      <div className="factions">
        <nav className="faction-list" aria-label="派系列表">
          {KIND_ORDER.map((k) => {
            const list = ix.factions.filter((x) => x.kind === k)
            if (!list.length) return null
            return (
              <div key={k}>
                <div className="group">{KINDS[k]}</div>
                {list.map((x) => (
                  <button key={x.id} aria-current={x.id === f.id} onClick={() => open('faction', x.id)} style={{ '--fc': x.color } as CSSProperties}>
                    <i />
                    <span>{x.name}</span>
                    <small>{members.get(x.id) ?? 0}</small>
                  </button>
                ))}
              </div>
            )
          })}
        </nav>
        <FactionDetail key={f.id} f={f} />
      </div>
    </div>
  )
}

function FactionDetail({ f }: { f: Faction }) {
  const { ix, t, select } = useApp()
  const wrap = useRef<HTMLDivElement>(null)
  const { width } = useSize(wrap)
  const stripW = Math.max(160, Math.min(560, width - 330))
  const x = useMemo(() => d3.scaleLinear().domain([P0, P1]).range([0, stripW]), [stripW])

  const members = ix.people
    .filter((p) => p.factions.includes(f.id))
    .sort((a, b) => a.tier - b.tier || (a.born ?? '').localeCompare(b.born ?? ''))
  const core = members.filter((p) => p.tier === 1)
  const rest = members.filter((p) => p.tier !== 1)
  const now = members.filter((p) => factionAt(p, t) === f.id)
  const standing = now.filter((p) => STANDING.has(statusNow(p, t) ?? 'dead'))
  const byStatus = d3.group(members, (p) => statusNow(p, t))

  const inWindow = t >= CONTROL_FROM && t < CONTROL_TO
  const held = ix.orgs
    .map((o) => ({ o, runs: controlRuns(ix, o).filter((r) => r.f === f.id) }))
    .filter((r) => r.runs.length)
    .sort((u, v) => u.runs[0].a - v.runs[0].a || LEVEL_ORDER.indexOf(u.o.level) - LEVEL_ORDER.indexOf(v.o.level))
  const heldNow = inWindow ? held.filter(({ o }) => controlAt(ix, o, t)?.f === f.id) : []
  const xc = d3.scaleLinear().domain([CONTROL_FROM, CONTROL_TO]).range([0, stripW])
  const labelled = ix.orgsByFaction.get(f.id) ?? []

  const row = (p: Person) => (
    <button key={p.id} className="people-row" onClick={() => select({ type: 'person', id: p.id })} style={{ gridTemplateColumns: `130px minmax(0, 1fr) ${stripW}px` }}>
      <span className="nm">
        <StatusDot s={statusNow(p, t)} />
        <b>{p.name}</b>
      </span>
      <span className="role">{p.role1966}</span>
      <span className="strip">
        <LifeStrip p={p} x={x} T1={P1} width={stripW} height={9} t={t} />
      </span>
    </button>
  )

  return (
    <div className="faction-detail" ref={wrap}>
      <header className="faction-head" style={{ '--fc': f.color } as CSSProperties}>
        <div className="kicker">
          派系 · {KINDS[f.kind]}
          {(f.from || f.to) && ` · ${fmtRange(f.from ?? '', f.to)}`}
        </div>
        <h2>{f.name}</h2>
        <p>{f.summary}</p>
        <div className="chips">
          {f.cites.map((c) => (
            <Cite key={c} cite={c} />
          ))}
        </div>
      </header>

      <div className="stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div>
          <b>{members.length}</b>
          <span>成员（曾属此派）</span>
        </div>
        <div>
          <b>{now.length}</b>
          <span>{fmtT(t, 'month')}以此为归属</span>
        </div>
        <div>
          <b>{standing.length}</b>
          <span>其中在位</span>
        </div>
        <div>
          <b>{inWindow ? heldNow.length : '—'}</b>
          <span>{inWindow ? '此刻掌握的机构' : `掌控只计 ${Math.floor(CONTROL_FROM)}–${Math.floor(CONTROL_TO)} 年`}</span>
        </div>
      </div>

      {members.length > 0 && (
        <section>
          <h3>此刻状态</h3>
          <div className="chips">
            {(Object.keys(STATUSES) as Status[])
              .filter((s) => byStatus.has(s))
              .map((s) => (
                <span key={s} className="chip nolink">
                  <StatusDot s={s} /> {STATUSES[s]} <b>{byStatus.get(s)!.length}</b>
                </span>
              ))}
          </div>
        </section>
      )}

      {core.length > 0 && (
        <section>
          <h3>核心人物</h3>
          {core.map(row)}
        </section>
      )}
      {rest.length > 0 && (
        <section>
          <h3>{core.length ? '其他成员' : '成员'}</h3>
          {rest.map(row)}
        </section>
      )}

      {held.length > 0 && (
        <section>
          <h3>
            掌控的机构（{held.length}）
            <small>按负责人的派系，{Math.floor(CONTROL_FROM)}–{Math.floor(CONTROL_TO)}；色浅为没有负责人记录、按机构标注</small>
          </h3>
          {held.map(({ o, runs }) => (
            <button key={o.id} className="people-row" onClick={() => select({ type: 'org', id: o.id })} style={{ gridTemplateColumns: `130px minmax(0, 1fr) ${stripW}px` }}>
              <span className="nm">
                <b style={{ fontSize: 13 }} title={o.name}>
                  {o.short ?? o.name}
                </b>
              </span>
              <span className="role">{ORG_LEVELS[o.level]}</span>
              <span className="strip">
                <svg width={stripW} height={9} style={{ display: 'block', overflow: 'visible' }}>
                  <rect width={stripW} height={9} fill="var(--paper-2)" rx={2} />
                  {runs.map((r, i) => (
                    <rect key={i} x={xc(r.a)} width={Math.max(1.5, xc(r.b) - xc(r.a))} height={9} rx={1.5} fill={f.color} fillOpacity={r.by ? 0.9 : 0.45}>
                      <title>{`${fmtT(r.a, 'month')}–${fmtT(r.b - 1 / 12, 'month')}${r.by ? ` · ${r.by}${r.title ? `（${r.title}）` : ''}` : ''}`}</title>
                    </rect>
                  ))}
                  {inWindow && <line x1={xc(t)} x2={xc(t)} y1={-3} y2={12} stroke="var(--accent)" strokeWidth={1.2} />}
                </svg>
              </span>
            </button>
          ))}
        </section>
      )}

      {labelled.length > 0 && (
        <section>
          <h3>标注为此派的机构</h3>
          <div className="chips">
            {labelled.map((o) => (
              <button key={o.id} className="chip" onClick={() => select({ type: 'org', id: o.id })}>
                <i style={{ background: `var(--org-${o.kind})` }} />
                {o.short ?? o.name}
              </button>
            ))}
          </div>
        </section>
      )}
      <FactionInsights id={f.id} />
      <ClaimLinks on="faction" id={f.id} />
    </div>
  )
}
