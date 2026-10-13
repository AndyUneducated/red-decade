import { ORG_KINDS, ORG_LEVELS } from '../../data/schema'
import { fmtDate, fmtRange, fmtT, toT } from '../../lib/dates'
import { existsAt, isHead, parentAt, suspendedAt, within } from '../../lib/orgs'
import { useApp } from '../../state'
import { Cite, Entity, PersonChip, Verify } from '../bits'

export function OrgCard({ id }: { id: string }) {
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
