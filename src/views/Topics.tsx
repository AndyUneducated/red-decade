import { Cite, PersonChip } from '../components/bits'
import { ClaimLinks, EventList } from '../components/drawer/lists'
import { PageTitle } from '../components/PageTitle'
import type { Event, Topic } from '../data/schema'
import { fmtRange } from '../lib/dates'
import { useApp } from '../state'

export function Topics() {
  const { ix, param, open } = useApp()
  const t = (param && ix.topic.get(param)) || ix.topics[0]
  return (
    <div className="view">
      <div className="viewhead">
        <div>
          <PageTitle />
          <p>跨越各时期的专题。事件与研究结论各自标注所属专题，一条事件可属几个专题，也仍在时间线上按日期出现。</p>
        </div>
      </div>
      <div className="factions">
        <nav className="faction-list" aria-label="专题列表">
          {ix.topics.map((x) => (
            <button key={x.id} aria-current={x.id === t.id} onClick={() => open('topic', x.id)}>
              <span>{x.name}</span>
              <small>{ix.eventsByTopic.get(x.id)?.length ?? 0}</small>
            </button>
          ))}
        </nav>
        <TopicDetail key={t.id} t={t} />
      </div>
    </div>
  )
}

const decade = (e: Event) => `${e.date.slice(0, 3)}0 年代`

function TopicDetail({ t }: { t: Topic }) {
  const { ix } = useApp()
  const events = ix.eventsByTopic.get(t.id) ?? []
  const claims = ix.claimsBy.topic.get(t.id) ?? []
  const byDecade = new Map<string, Event[]>()
  for (const e of events) byDecade.set(decade(e), [...(byDecade.get(decade(e)) ?? []), e])
  const people = new Map<string, number>()
  for (const e of events) for (const p of e.people) people.set(p, (people.get(p) ?? 0) + 1)
  const sources = new Set(events.flatMap((e) => e.cites.map((c) => c.split('@')[0])))

  return (
    <div className="faction-detail">
      <header className="faction-head">
        <div className="kicker">专题 · {fmtRange(t.from, t.to)}</div>
        <h2>{t.name}</h2>
        <p>{t.summary}</p>
        <div className="chips">
          {t.cites.map((c) => (
            <Cite key={c} cite={c} />
          ))}
        </div>
      </header>

      <div className="stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div>
          <b>{events.length}</b>
          <span>事件</span>
        </div>
        <div>
          <b>{claims.length}</b>
          <span>研究结论</span>
        </div>
        <div>
          <b>{people.size}</b>
          <span>涉及人物</span>
        </div>
        <div>
          <b>{sources.size}</b>
          <span>事件引用的来源</span>
        </div>
      </div>

      {t.sections.map((s) => (
        <section key={s.h}>
          <h3>{s.h}</h3>
          <p>{s.text}</p>
          {s.cites.length > 0 && (
            <div className="chips">
              {s.cites.map((c) => (
                <Cite key={c} cite={c} />
              ))}
            </div>
          )}
        </section>
      ))}

      <ClaimLinks on="topic" id={t.id} />

      <section>
        <h3>事件</h3>
        {[...byDecade].map(([d, list]) => (
          <div key={d}>
            <h4>{d}</h4>
            <EventList events={list} />
          </div>
        ))}
      </section>

      {people.size > 0 && (
        <section>
          <h3>涉及人物</h3>
          <div className="chips">
            {[...people]
              .sort((a, b) => b[1] - a[1])
              .map(([id]) => (
                <PersonChip key={id} id={id} />
              ))}
          </div>
        </section>
      )}

      {t.gaps.length > 0 && (
        <section>
          <h3>库内材料尚不能回答的问题</h3>
          <ul>
            {t.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
