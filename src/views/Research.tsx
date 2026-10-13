import { PageTitle } from '../components/PageTitle'
import { ClaimCard } from '../components/drawer/ClaimCard'
import { fmtDate } from '../lib/dates'
import { useApp } from '../state'
import { shortTitle } from '../lib/sources'

const REPO = 'https://github.com/AndyUneducated/red-decade/tree/main/research'
const TIERS = ['', '原文', '官方', '亲历', '研究']
const ACCESS = { unread: '未读', partial: '部分', read: '已读' }

export function Research() {
  const { ix, select } = useApp()
  const sourced = ix.events.filter((e) => !e.verify).length
  const fateTotal = ix.people.reduce((n, p) => n + p.fate.length, 0)
  const fateVerify = ix.people.reduce((n, p) => n + p.fate.filter((f) => f.verify).length, 0)
  const withText = ix.sources.filter((s) => s.hasText)
  const missing = ix.sources.filter((s) => s.tier === 1 && !s.hasText)
  const secondary = ix.sources.filter((s) => s.tier > 1).sort((a, b) => a.tier - b.tier || a.date.localeCompare(b.date))
  const verifyEvents = ix.events.filter((e) => e.verify)

  const stats: [number | string, string][] = [
    [ix.people.length, '人物'],
    [`${sourced}/${ix.events.length}`, '事件（有原文出处）'],
    [`${fateTotal - fateVerify}/${fateTotal}`, '命运节点（已核）'],
    [ix.relations.length, '关系'],
    [`${withText.length}/${withText.length + missing.length}`, '一手文献（已获全文）'],
    [ix.claims.length, '本站研究结论'],
  ]

  return (
    <div className="view">
      <div className="research">
        <div className="viewhead" style={{ padding: '0 0 14px', border: 0 }}>
          <div>
            <PageTitle />
            <p>
              本站的每一条判断都应能追溯到原文。下面是基于一手文献逐字比对得出的结论，以及全部来源的登记表。完整的研究日志、方法与待办见{' '}
              <a href={REPO} target="_blank" rel="noreferrer">
                research/
              </a>
              。数据构建于 {new Date(ix.builtAt).toLocaleString('zh-CN')}。
            </p>
          </div>
        </div>
        <div className="stats">
          {stats.map(([v, l]) => (
            <div key={l}>
              <b>{v}</b>
              <span>{l}</span>
            </div>
          ))}
        </div>
        <div className="research-grid">
          <div>
            <h2 className="sec">结论 · 由原文推出</h2>
            {ix.claims.map((c) => (
              <ClaimCard key={c.id} id={c.id} inline />
            ))}
          </div>
          <div>
            <h2 className="sec">来源登记（第一层：原始文献）</h2>
            <table className="sources">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>文献</th>
                  <th>版本</th>
                </tr>
              </thead>
              <tbody>
                {withText.map((s) => (
                  <tr key={s.id}>
                    <td className="num">{s.date}</td>
                    <td>
                      <button className="linklike" onClick={() => select({ type: 'doc', id: s.id })}>
                        {s.alias ? `《${s.alias}》` : shortTitle(s)}
                      </button>
                    </td>
                    <td className="num">
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer">
                          rev {s.revid}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 className="sec" style={{ marginTop: 28 }}>
              待找原文（{missing.length}）
            </h2>
            <table className="sources">
              <tbody>
                {missing.map((s) => (
                  <tr key={s.id}>
                    <td className="num">{s.date}</td>
                    <td>
                      {s.title}
                      {s.note && <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{s.note}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 className="sec" style={{ marginTop: 28 }}>
              第 2–4 层来源（{secondary.filter((s) => s.access !== 'unread').length}/{secondary.length} 已读）
            </h2>
            <table className="sources">
              <thead>
                <tr>
                  <th>层</th>
                  <th>书目</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {secondary.map((s) => (
                  <tr key={s.id}>
                    <td className="num">{TIERS[s.tier]}</td>
                    <td>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.title}
                        </a>
                      ) : (
                        s.title
                      )}
                      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                        {[s.author, s.publisher, s.date].filter(Boolean).join(' · ')}
                      </div>
                      {s.want.length > 0 && (
                        <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 12, color: 'var(--ink-2)' }}>
                          {s.want.map((w) => (
                            <li key={w}>{w}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="num">{ACCESS[s.access ?? 'unread']}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 className="sec" style={{ marginTop: 28 }}>
              待核事件（{verifyEvents.length}）
            </h2>
            <table className="sources">
              <tbody>
                {verifyEvents.map((e) => (
                  <tr key={e.id}>
                    <td className="num">{fmtDate(e.date)}</td>
                    <td>
                      <button className="linklike" onClick={() => select({ type: 'event', id: e.id })}>
                        {e.title}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
