import { Cite } from '../components/bits'
import { PageTitle } from '../components/PageTitle'
import type { Essay } from '../data/schema'
import { fmtDate } from '../lib/dates'
import { useApp } from '../state'

export function Essays() {
  const { ix, param, open } = useApp()
  const e = (param && ix.essay.get(param)) || ix.essays[0]
  return (
    <div className="view">
      <div className="viewhead">
        <div>
          <PageTitle />
          <p>把研究结论连成文章。每节末尾列出所依据的结论与原文；文中“”内的引文在构建时与原文逐字核对。</p>
        </div>
      </div>
      <div className="factions">
        <nav className="faction-list essay-list" aria-label="长文列表">
          {ix.essays.map((x) => (
            <button key={x.id} aria-current={x.id === e?.id} onClick={() => open('essay', x.id)}>
              <span>{x.title}</span>
              <small>{x.period}</small>
            </button>
          ))}
        </nav>
        {e && <EssayBody key={e.id} e={e} />}
      </div>
    </div>
  )
}

function EssayBody({ e }: { e: Essay }) {
  const { ix, select } = useApp()
  const claims = [...new Set(e.sections.flatMap((s) => s.claims))]
  return (
    <article className="faction-detail essay">
      <header className="faction-head">
        <div className="kicker">
          长文 · {e.period} · {claims.length} 条结论 · 写于 {fmtDate(e.written)}
        </div>
        <h2>{e.title}</h2>
        <p className="essay-summary">{e.summary}</p>
      </header>
      {e.sections.map((s, i) => (
        <section key={s.h}>
          <h3>
            <span className="essay-n">{i + 1}</span>
            {s.h}
          </h3>
          {s.text
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
          <div className="essay-basis">
            {s.claims.map((id) => (
              <button key={id} className="cite essay-claim" title={ix.claim.get(id)?.statement} onClick={() => select({ type: 'claim', id })}>
                {id}
              </button>
            ))}
            {s.cites.map((c) => (
              <Cite key={c} cite={c} />
            ))}
          </div>
        </section>
      ))}
    </article>
  )
}
