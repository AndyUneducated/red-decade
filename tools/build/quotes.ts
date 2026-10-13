// Stage 4: every quoted text must occur verbatim in its source (rules in src/derive/quotes.ts).
import { quoteMisses, stripAttribution } from '../../src/derive/quotes.ts'
import { errors } from './io.ts'
import type { Data } from './load.ts'

export function checkQuotes(d: Data) {
  const check = (cite: string, quote: string, where: string) => {
    const id = cite.split('@')[0]
    const body = d.texts.get(id)
    if (!body) return errors.push(`${where}: source ${id} has no text to check quote against`)
    for (const part of quoteMisses(body, quote)) errors.push(`${where}: quote not found in ${id}: "${part.slice(0, 40)}…"`)
  }
  // assessments, voices and notes are quotes only when marked so, and then need a cite
  const marked = (v: { quote?: boolean; cite?: string; text: string }, where: string) => {
    if (!v.quote) return
    if (!v.cite) errors.push(`${where} is marked as a quote but has no cite`)
    else check(v.cite, stripAttribution(v.text), where)
  }

  for (const c of d.claims) for (const e of c.evidence) if (e.quote) check(e.cite, e.quote, `claim ${c.id}`)
  for (const f of d.figures) for (const c of f.counts) check(c.cite, c.quote, `figure ${f.id} "${c.what}"`)
  for (const s of d.series) for (const p of s.points) check(p.cite, p.quote, `series ${s.id} ${p.year}`)
  for (const u of d.counties) {
    for (const c of u.counts) check(c.cite, c.quote, `county ${u.id}`)
    if (u.revcom) check(u.revcom.cite, u.revcom.quote, `county ${u.id} revcom`)
  }
  for (const r of d.revcoms) check(r.cite, r.quote, `revcom ${r.province}`)
  for (const p of d.people) {
    for (const q of p.quotes) check(q.cite, q.text, `person ${p.id} quote`)
    for (const v of p.assess) marked(v, `person ${p.id} assess ${v.voice}`)
  }
  for (const e of d.events) for (const v of e.voices) marked(v, `event ${e.id} voice ${v.voice}`)
  for (const m of d.isms) for (const v of m.notes) marked(v, `ism ${m.id} note ${v.voice}`)
  for (const c of d.concepts) for (const v of c.notes) marked(v, `concept ${c.id} note ${v.voice}`)
  for (const doc of d.documents)
    for (const p of doc.pairs ?? []) {
      check(p.against, p.original, `document ${doc.id} pair ${p.point}`)
      check(doc.id, p.rebuttal, `document ${doc.id} pair ${p.point}`)
    }
}
