import { useMemo } from 'react'
import { Cite, PersonChip } from '../../components/bits'
import { VOICES, type Voice } from '../../data/schema'
import { personMentioner } from '../../derive/match'
import { fmtDate } from '../../lib/dates'
import { useApp } from '../../state'
import { Insight } from './Insight'
import { ATTRIBUTION_MIN_KINDS as MIN_KINDS } from './shared'

const ORDER = Object.keys(VOICES) as Voice[]

export function Attribution() {
  const { ix, sel, select } = useApp()
  const mention = useMemo(() => personMentioner(ix.people), [ix])
  const events = useMemo(
    () =>
      ix.events
        .filter((e) => new Set(e.voices.map((v) => v.voice)).size >= MIN_KINDS)
        .map((e) => ({ e, kinds: new Set(e.voices.map((v) => v.voice)).size })),
    [ix],
  )
  const picked = sel?.type === 'event' ? events.find((x) => x.e.id === sel.id) : undefined
  const cur = picked ?? [...events].sort((a, b) => b.kinds - a.kinds)[0]
  const rows = useMemo(() => {
    if (!cur) return []
    return [...cur.e.voices]
      .sort((a, b) => ORDER.indexOf(a.voice) - ORDER.indexOf(b.voice))
      .map((v) => ({ v, named: mention(v.text) }))
  }, [cur, mention])
  const seen = new Map<string, number>()
  for (const r of rows) for (const id of new Set(r.named)) seen.set(id, (seen.get(id) ?? 0) + 1)
  if (!cur) return null

  return (
    <Insight
      question="同一件事，当时的文件、1981 年决议、1980 年代的判决书、亲历者和学者各说是谁干的？谁的名字在后来的叙述里出现、谁的名字消失了？"
      method={`取至少有 ${MIN_KINDS} 种叙述者（原始文件、当时官方、1981 决议、后来官方、审判、亲历者、学术研究等）的事件（${events.length} 个）。每条叙述按叙述者的先后排列，列出其中点到名字的已建档人物。只在一种叙述里出现的名字加了框。`}
      caveats="叙述是本站从各出处摘录的，每种叙述者只取了一两句，没有被摘到的句子里可能另有人名；点名不等于归咎，需看原文语气。只认全名。"
    >
      <div className="chips" style={{ marginBottom: 14 }}>
        {events.map(({ e }) => (
          <button key={e.id} className="chip" aria-pressed={e.id === cur.e.id} onClick={() => select({ type: 'event', id: e.id })}>
            {fmtDate(e.date).replace(/月.*$/, '月')} {e.title.length > 18 ? e.title.slice(0, 17) + '…' : e.title}
          </button>
        ))}
      </div>
      <section className="insight-detail" style={{ maxWidth: 1000, marginTop: 0 }}>
        <h3>
          {fmtDate(cur.e.date)} · {cur.e.title}
        </h3>
        <table className="sources attribution">
          <tbody>
            {rows.map(({ v, named }, i) => (
              <tr key={i}>
                <th>{VOICES[v.voice]}</th>
                <td>
                  <div className="chips" style={{ marginBottom: 4 }}>
                    {named.map((id) => (
                      <span key={id} className={seen.get(id) === 1 ? 'only' : undefined}>
                        <PersonChip id={id} />
                      </span>
                    ))}
                    {!named.length && <span className="muted-note">未点名</span>}
                  </div>
                  <div style={{ color: 'var(--ink-2)' }}>
                    {v.text} <Cite cite={v.cite} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Insight>
  )
}
