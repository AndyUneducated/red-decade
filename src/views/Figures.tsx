import { PageTitle } from '../components/PageTitle'
import { Cite, Entity } from '../components/bits'
import { COUNTY_KINDS, MEASURES, SOURCE_KINDS, VOICES, type County, type Figure } from '../data/schema'
import { fmtDate } from '../lib/dates'
import { useApp, useHistoryState } from '../state'
import { VOICE_COLOR } from './Narratives'

type Count = Figure['counts'][number]

// One log scale for every case, so 24 deaths and 1.38 million persecuted sit on the same ruler.
const LOG_MAX = 7
const TICKS = [1, 10, 100, 1e3, 1e4, 1e5, 1e6]
const pct = (v: number) => (Math.log10(Math.max(v, 1)) / LOG_MAX) * 100
const tickLabel = (v: number) => (v >= 1e4 ? `${v / 1e4} 万` : v >= 1e3 ? `${v / 1e3} 千` : String(v))

const SUFFIX = new Set(['余', '多'])
export function fmtValue(c: Count) {
  if (c.value === undefined) return c.approx ?? '—'
  const n = c.value >= 1e4 ? `${+(c.value / 1e4).toFixed(c.value % 1e4 ? 1 : 0)} 万` : c.value.toLocaleString('en-US')
  if (!c.approx) return n
  return SUFFIX.has(c.approx) ? `${n}${c.approx}` : `${c.approx}${n}`
}

function Row({ c }: { c: Count }) {
  const color = VOICE_COLOR[c.voice]
  return (
    <div className="fig-row" data-measure={c.measure}>
      <div className="fig-what">
        <b>{c.what}</b>
        {c.scope && <span>{c.scope}</span>}
      </div>
      <div className="fig-track">
        {c.value !== undefined ? (
          <i className="fig-bar" style={{ width: `${pct(c.value)}%`, background: color }} />
        ) : (
          <span className="fig-nonum">原文不给确数</span>
        )}
      </div>
      <div className="fig-val">
        {fmtValue(c)}
        {c.value !== undefined && c.unit !== '人' && <small>{c.unit}</small>}
      </div>
      <div className="fig-src">
        <span className="fig-measure">{MEASURES[c.measure]}</span>
        <span style={{ color }}>{VOICES[c.voice]}</span> <Cite cite={c.cite} />
      </div>
      <q className="fig-quote">{c.quote}</q>
      {c.note && <div className="fig-note">{c.note}</div>}
    </div>
  )
}

function Case({ f }: { f: Figure }) {
  return (
    <article className="fig-case" id={`fig-${f.id}`}>
      <header>
        <h3>{f.title}</h3>
        <span>
          {f.region} · {f.period}
        </span>
      </header>
      <p>{f.summary}</p>
      <div className="fig-axis" aria-hidden>
        <div />
        <div className="fig-ticks">
          {TICKS.map((t) => (
            <span key={t} style={{ left: `${pct(t)}%` }}>
              {tickLabel(t)}
            </span>
          ))}
        </div>
      </div>
      {f.counts.map((c, i) => (
        <Row key={i} c={c} />
      ))}
      {f.caveats && <div className="fig-caveat">{f.caveats}</div>}
      {(f.events.length > 0 || f.people.length > 0) && (
        <div className="fig-links">
          {f.events.map((id) => (
            <Entity key={id} refTo={{ type: 'event', id }} />
          ))}
          {f.people.map((id) => (
            <Entity key={id} refTo={{ type: 'person', id }} />
          ))}
        </div>
      )}
    </article>
  )
}

// The register's bars are coloured by what kind of document gives the number, not by voice:
// 1980s cleanup records and the gazetteers built on them are both later official texts.
const KIND_COLOR: Record<string, string> = { 'local-record': 'var(--v-officialLater)', gazetteer: 'var(--v-scholar)' }

function CountyRow({ u }: { u: County }) {
  const { ix } = useApp()
  const [open, setOpen] = useHistoryState(`figures.county.${u.id}`, false)
  const rows = u.counts.length ? u.counts : [undefined]
  return (
    <div className="cty" aria-expanded={open}>
      <button className="cty-name" onClick={() => setOpen(!open)} title="展开原文">
        {u.name}
        {u.kind !== 'county' && <small>{COUNTY_KINDS[u.kind]}</small>}
      </button>
      <div className="cty-rev" title={u.revcom?.quote}>
        {u.revcom ? fmtDate(u.revcom.date) : ''}
      </div>
      <div className="cty-counts">
        {rows.map((c, i) => {
          if (!c) return <div key={i} className="cty-count cty-empty">所读章节不给数字</div>
          const kind = ix.source.get(c.cite.split('@')[0])?.kind ?? ''
          const color = KIND_COLOR[kind] ?? VOICE_COLOR[c.voice]
          return (
            <div key={i} className="cty-count" data-measure={c.measure}>
              <div className="fig-track">
                {c.value !== undefined ? <i className="fig-bar" style={{ width: `${pct(c.value)}%`, background: color }} /> : <span className="fig-nonum">{c.what}</span>}
              </div>
              <div className="fig-val">{c.value !== undefined ? fmtValue(c) : ''}</div>
              <div className="fig-src">
                <span className="fig-measure">{MEASURES[c.measure]}</span>
                <span style={{ color }}>{SOURCE_KINDS[kind] ?? VOICES[c.voice]}</span>
              </div>
              {open && (
                <div className="cty-quote">
                  <q className="fig-quote">{c.quote}</q> <Cite cite={c.cite} />
                  {c.note && <div className="fig-note">{c.note}</div>}
                </div>
              )}
            </div>
          )
        })}
        {open && u.revcom && (
          <div className="cty-quote">
            革委会：<q className="fig-quote">{u.revcom.quote}</q> <Cite cite={u.revcom.cite} />
          </div>
        )}
        {open && u.note && <div className="fig-note">{u.note}</div>}
      </div>
    </div>
  )
}

function Register({ counties }: { counties: County[] }) {
  const { ix } = useApp()
  const provinces = [...new Set(counties.map((u) => u.province))]
  const kinds = new Map<string, Set<string>>()
  for (const u of counties)
    for (const cite of [...u.counts.map((c) => c.cite), ...(u.revcom ? [u.revcom.cite] : [])]) {
      const s = ix.source.get(cite.split('@')[0])
      if (!s) continue
      if (!kinds.has(s.kind)) kinds.set(s.kind, new Set())
      // a gazetteer is cited chapter by chapter; count books, not chapters
      kinds.get(s.kind)!.add(s.alias?.match(/《[^》]+》/)?.[0] ?? s.id)
    }
  return (
    <section className="register">
      <h2 className="sec" style={{ marginTop: 28 }}>
        按县登记（{counties.length} 个县市）
      </h2>
      <p className="register-lede">
        各县自己的说法：1980 年代“处遗”办公室的统计和此后编成的县志，一县一行，同一把对数刻度。各县数字的统计口径不同，不能相加。点县名展开原文；“革委会”一列是该县革命委员会成立的日期。
      </p>
      <div className="legend" style={{ marginBottom: 12 }}>
        {[...kinds].map(([k, set]) => (
          <span key={k}>
            <i style={{ background: KIND_COLOR[k] ?? 'var(--muted)' }} />
            {SOURCE_KINDS[k] ?? k} {set.size} {k === 'gazetteer' ? '部' : '份'}
          </span>
        ))}
      </div>
      {provinces.map((p) => {
        const list = counties.filter((u) => u.province === p)
        const prefs = [...new Set(list.map((u) => u.prefecture ?? ''))]
        return (
          <details key={p} className="register-prov" open={provinces.length === 1}>
            <summary>
              {p} <span>{list.length}</span>
            </summary>
            <div className="fig-axis cty-axis" aria-hidden>
              <div />
              <div>革委会</div>
              <div className="fig-ticks">
                {TICKS.map((t) => (
                  <span key={t} style={{ left: `${pct(t)}%` }}>
                    {tickLabel(t)}
                  </span>
                ))}
              </div>
            </div>
            {prefs.map((pf) => (
              <div key={pf} className="register-pref">
                {pf && <h4>{pf}</h4>}
                {list
                  .filter((u) => (u.prefecture ?? '') === pf)
                  .map((u) => (
                    <CountyRow key={u.id} u={u} />
                  ))}
              </div>
            ))}
          </details>
        )
      })}
    </section>
  )
}

export function Figures() {
  const { ix } = useApp()
  const ready = ix.figures.filter((f) => !f.need)
  const pending = ix.figures.filter((f) => f.need)
  const voices = [...new Set(ready.flatMap((f) => f.counts.map((c) => c.voice)))]
  return (
    <div className="view">
      <div className="research figures">
        <div className="viewhead" style={{ padding: '0 0 14px', border: 0 }}>
          <div>
            <PageTitle />
            <p>
              同一案件的死亡与迫害数字，按出处并列，不取其一。每个数字都附原文，构建时逐字核对。横条用同一把对数刻度，各案之间可以比较数量级；原文只说“大批”“数千”的，照录不折算。
            </p>
          </div>
        </div>
        <div className="legend" style={{ marginBottom: 18 }}>
          {voices.map((v) => (
            <span key={v}>
              <i style={{ background: VOICE_COLOR[v] }} />
              {VOICES[v]}
            </span>
          ))}
        </div>
        <nav className="fig-index">
          {ready.map((f) => (
            <a key={f.id} href={`#fig-${f.id}`} onClick={(e) => (e.preventDefault(), document.getElementById(`fig-${f.id}`)?.scrollIntoView({ behavior: 'smooth' }))}>
              {f.title}
            </a>
          ))}
        </nav>
        <div className="fig-list">
          {ready.map((f) => (
            <Case key={f.id} f={f} />
          ))}
        </div>
        {pending.length > 0 && (
          <>
            <h2 className="sec" style={{ marginTop: 28 }}>
              尚无一手文本（{pending.length}）
            </h2>
            <div className="fig-pending">
              {pending.map((f) => (
                <div key={f.id}>
                  <b>{f.title}</b>
                  <span>
                    {f.region} · {f.period}
                  </span>
                  <p>{f.summary}</p>
                  <small>待找：{f.need}</small>
                </div>
              ))}
            </div>
          </>
        )}
        {ix.counties.length > 0 && <Register counties={ix.counties} />}
      </div>
    </div>
  )
}
