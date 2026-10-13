import { ISM_KINDS } from '../../data/schema'
import { fmtDate } from '../../lib/dates'
import { AXES, describe, ismColor } from '../../lib/isms'
import { page as pageDef } from '../../pages'
import { useApp } from '../../state'
import { Cite, Entity, PersonChip, Voices } from '../bits'
import { ClaimLinks, highlight } from './lists'

function IsmChips({ title, list }: { title: string; list: string[] }) {
  const { ix } = useApp()
  if (!list.length) return null
  return (
    <div className="ism-rel">
      <span>{title}</span>
      <div className="chips">
        {list.map((id) => {
          const m = ix.ism.get(id)
          return m && <Entity key={id} refTo={{ type: 'ism', id }} dot={ismColor(m.kind)} />
        })}
      </div>
    </div>
  )
}

function MiniSpectrum({ points }: { points: { x: number; y: number }[] }) {
  const S = 96
  const p = (v: number) => ((v + 1) / 2) * (S - 12) + 6
  return (
    <svg width={S} height={S} className="mini-spectrum" aria-hidden>
      <rect x={0.5} y={0.5} width={S - 1} height={S - 1} fill="none" stroke="var(--rule-2)" />
      <line x1={S / 2} x2={S / 2} y1={0} y2={S} stroke="var(--rule)" />
      <line y1={S / 2} y2={S / 2} x1={0} x2={S} stroke="var(--rule)" />
      <polyline points={points.map((q) => `${p(q.x)},${p(-q.y)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth={1.2} />
      {points.map((q, i) => (
        <circle key={i} cx={p(q.x)} cy={p(-q.y)} r={i === points.length - 1 ? 3.5 : 2} fill="var(--accent)" />
      ))}
    </svg>
  )
}

export function IsmCard({ id }: { id: string }) {
  const { ix, go, page } = useApp()
  const m = ix.ism.get(id)
  if (!m) return null
  const total = m.hits.reduce((s, h) => s + h.count, 0)
  const children = (ix.ismChildren.get(id) ?? []).map((c) => c.id)
  const opposed = (ix.ismOpposed.get(id) ?? []).map((c) => c.id)
  return (
    <>
      <header>
        <div className="kicker">主义 · {ISM_KINDS[m.kind]}</div>
        <h2>{m.name}</h2>
        <div className="meta">
          {fmtDate(m.from)}
          {m.to ? `–${fmtDate(m.to)}` : ' 起'}
          {page !== 'lineage' && (
            <>
              {' · '}
              <button className="linklike" onClick={() => go('lineage')}>
                {pageDef('lineage').title} →
              </button>
            </>
          )}
        </div>
      </header>
      <section>
        <p>{m.summary}</p>
        {m.carriers.length > 0 && (
          <div className="ism-rel">
            <span>代表人物</span>
            <div className="chips">
              {m.carriers.map((c) =>
                c.person ? (
                  <PersonChip key={c.name} id={c.person} />
                ) : (
                  <span key={c.name} className="chip nolink">
                    {c.name}
                  </span>
                ),
              )}
            </div>
          </div>
        )}
        <IsmChips title="源出" list={m.parents} />
        <IsmChips title="衍生" list={children} />
        <IsmChips title="针对" list={m.against} />
        <IsmChips title="被针对" list={opposed} />
        {m.notes.length > 0 && <Voices voices={m.notes} />}
        <div className="chips">
          {m.cites.map((c) => (
            <Cite key={c} cite={c} />
          ))}
        </div>
      </section>
      {m.pos.length > 0 && (
        <section>
          <h3>光谱位置（编者判断）</h3>
          <div className="ism-pos">
            <MiniSpectrum points={m.pos} />
            <ol>
              {m.pos.map((p) => (
                <li key={p.at}>
                  <time>{fmtDate(p.at)}</time> {describe(p)}
                  {p.note && <small>{p.note}</small>}
                </li>
              ))}
            </ol>
          </div>
          <p className="sub-note">
            横轴：{AXES.x[0]} ↔ {AXES.x[1]}；纵轴：{AXES.y[0]} ↔ {AXES.y[1]}。位置只表示相对立场，{m.kind === 'label' ? '罪名的位置是批判者对被批判者的描述，' : ''}不是测量。
          </p>
        </section>
      )}
      {m.terms.length > 0 && (
        <section>
          <h3>
            语料中（{m.hits.length} 份文献，{total} 次）
          </h3>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8 }}>匹配词：{m.terms.join('、')}</div>
          {m.hits.slice(0, 6).map((h, i) => (
            <div className="ctx" key={h.source} style={i ? undefined : { borderTop: 0 }}>
              <time>{fmtDate(h.date)}</time> · {h.count} 次{i === 0 && ' · 首次出现'} <Cite cite={h.source} />
              <div className="q">…{highlight(h.context, m.terms)}…</div>
            </div>
          ))}
          {m.hits.length > 6 && <p className="sub-note">另有 {m.hits.length - 6} 份文献。</p>}
          {!m.hits.length && <p className="sub-note">本站已收文献中未出现。</p>}
        </section>
      )}
      {m.concepts.length > 0 && (
        <section>
          <h3>相关概念</h3>
          <div className="chips">
            {m.concepts.map((c) => (
              <Entity key={c} refTo={{ type: 'concept', id: c }} />
            ))}
          </div>
        </section>
      )}
      <ClaimLinks on="ism" id={id} />
    </>
  )
}
