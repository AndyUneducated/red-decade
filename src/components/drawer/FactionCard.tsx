import { statusAt } from '../../data/atlas'
import { fmtRange } from '../../lib/dates'
import { detailPage, page as pageDef } from '../../pages'
import { useApp } from '../../state'
import { Cite, Entity, PersonChip, StatusDot } from '../bits'
import { FactionInsights } from './InsightNotes'
import { ClaimLinks } from './lists'

export function FactionCard({ id }: { id: string }) {
  const { ix, t, open } = useApp()
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
        <div className="meta">
          {f.from || f.to ? `${fmtRange(f.from ?? '', f.to)} · ` : ''}
          <button className="linklike" onClick={() => open('faction', id)}>
            {pageDef(detailPage('faction')).title} →
          </button>
        </div>
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
      <FactionInsights id={id} />
      <ClaimLinks on="faction" id={id} />
    </>
  )
}
