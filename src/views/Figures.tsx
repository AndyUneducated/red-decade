import { Cite, Entity } from '../components/bits'
import { MEASURES, VOICES, type Figure } from '../data/schema'
import { useApp } from '../state'
import { VOICE_COLOR } from './Narratives'

type Count = Figure['counts'][number]

// One log scale for every case, so 24 deaths and 1.38 million persecuted sit on the same ruler.
const LOG_MAX = 7
const TICKS = [1, 10, 100, 1e3, 1e4, 1e5, 1e6]
const pct = (v: number) => (Math.log10(Math.max(v, 1)) / LOG_MAX) * 100
const tickLabel = (v: number) => (v >= 1e4 ? `${v / 1e4} 万` : v >= 1e3 ? `${v / 1e3} 千` : String(v))

const SUFFIX = new Set(['余', '多'])
function fmtValue(c: Count) {
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
            <h1>数字争议</h1>
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
      </div>
    </div>
  )
}
