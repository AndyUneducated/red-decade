import { relationActive, statusAt } from '../../data/atlas'
import { STATUSES } from '../../data/schema'
import { lifespan } from '../../lib/dates'
import { useApp } from '../../state'
import { Cite, Entity, StatusDot, Verify } from '../bits'
import { PersonFacts, PositionList } from '../PersonFacts'
import { Portrait } from '../Portrait'
import { ClaimLinks, EventList, FateLine, RelationList } from './lists'

export function PersonCard({ id }: { id: string }) {
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
