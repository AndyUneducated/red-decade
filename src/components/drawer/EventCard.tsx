import { LANES } from '../../data/schema'
import { fmtRange } from '../../lib/dates'
import { useApp } from '../../state'
import { Cite, Entity, PersonChip, Verify, Voices } from '../bits'
import { ClaimLinks } from './lists'

export function EventCard({ id }: { id: string }) {
  const { ix } = useApp()
  const e = ix.event.get(id)
  if (!e) return null
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
      <ClaimLinks on="event" id={id} />
    </>
  )
}
