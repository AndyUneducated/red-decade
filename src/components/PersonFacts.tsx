import { ALIAS_KINDS, DEATH_KINDS, type Person } from '../data/schema'
import { fmtDate, fmtRange, toT } from '../lib/dates'
import { Cite, Verify } from './bits'

const when = (s: { from?: string; to?: string }) =>
  s.from && s.to ? fmtRange(s.from, s.to) : s.from ? `${fmtDate(s.from)}起` : s.to ? `至${fmtDate(s.to)}` : ''

// Standard biographical fields as a compact two-column table; rows without data are omitted.
export function PersonFacts({ p }: { p: Person }) {
  const rows: [string, React.ReactNode][] = []
  const names = (p.aka ?? []).map((a) => `${ALIAS_KINDS[a.kind]} ${a.name}`)
  if (names.length || p.pinyin) rows.push(['别名', [p.pinyin, ...names].filter(Boolean).join('；')])
  const who = [p.gender && (p.gender === 'f' ? '女' : '男'), p.ethnicity].filter(Boolean).join('，')
  if (who) rows.push(['性别 / 民族', who])
  if (p.born || p.birthplace) rows.push(['出生', [p.born && fmtDate(p.born), p.birthplace].filter(Boolean).join('，')])
  if (p.origin && p.origin !== p.birthplace) rows.push(['籍贯', p.origin])
  if (p.classOrigin) rows.push(['家庭出身', [p.classOrigin, p.classNote].filter(Boolean).join('。')])
  if (p.education.length)
    rows.push([
      '学历',
      p.education.map((e, i) => (
        <div key={i}>
          {e.school}
          {(e.from || e.to) && <time> {when(e)}</time>}
          {e.note && ` · ${e.note}`} <Cite cite={e.cite} />
          {e.verify && <Verify />}
        </div>
      )),
    ])
  if (p.joinedParty || p.party) rows.push(['党派', [p.party ?? '中国共产党', p.joinedParty && `${fmtDate(p.joinedParty)}加入`].filter(Boolean).join('，')])
  if (p.joinedRevolution) rows.push(['参加革命', fmtDate(p.joinedRevolution)])
  if (p.rank)
    rows.push([
      '军衔',
      <>
        {p.rank.rank}（{fmtDate(p.rank.date)}） <Cite cite={p.rank.cite} />
      </>,
    ])
  if (p.died)
    rows.push([
      '去世',
      [fmtDate(p.died), p.deathPlace, p.deathKind && DEATH_KINDS[p.deathKind] + (p.deathContested ? '（死因有争议）' : '')].filter(Boolean).join('，'),
    ])
  if (p.rehab.length)
    rows.push([
      '平反',
      p.rehab.map((r, i) => (
        <div key={i}>
          <time>{fmtDate(r.date)}</time> {r.text} <Cite cite={r.cite} />
          {r.verify && <Verify />}
        </div>
      )),
    ])
  if (p.afterlife.length)
    rows.push([
      '身后',
      p.afterlife.map((r, i) => (
        <div key={i}>
          <time>{fmtDate(r.date)}</time> {r.text} <Cite cite={r.cite} />
          {r.verify && <Verify />}
        </div>
      )),
    ])
  if (!rows.length) return null
  return (
    <dl className="facts">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

// Positions in date order; the ones held at time t are marked.
export function PositionList({ p, t }: { p: Person; t: number }) {
  if (!p.positions.length) return null
  const held = (x: Person['positions'][number]) => (!x.from || toT(x.from) <= t) && (!x.to || t <= toT(x.to, true))
  const list = [...p.positions].sort((a, b) => (a.from ?? '').localeCompare(b.from ?? ''))
  return (
    <ul className="minilist">
      {list.map((x, i) => (
        <li key={i} style={{ opacity: held(x) ? 1 : 0.7 }}>
          <time>{when(x)}</time>
          <span style={{ fontWeight: held(x) ? 600 : 400 }}>
            {x.orgName ?? ''}
            {x.title}
          </span>
          {x.note && <span style={{ color: 'var(--ink-2)' }}> · {x.note}</span>} <Cite cite={x.cite} />
          {x.verify && <Verify />}
        </li>
      ))}
    </ul>
  )
}
