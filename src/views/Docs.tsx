import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Entity, PersonChip } from '../components/bits'
import type { Ref } from '../data/atlas'
import { SOURCE_KINDS } from '../data/schema'
import { fmtDate } from '../lib/dates'
import { useApp, useHistoryState } from '../state'
import { shortTitle } from '../lib/sources'

const KINDS = SOURCE_KINDS
const DEFAULT_DOC = 'ws-1966-05-16-notice'

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function Docs() {
  const { ix, param, openDoc } = useApp()
  const [filter, setFilter] = useHistoryState('docs.filter', '')
  const id = param && ix.source.get(param)?.hasText ? param : DEFAULT_DOC

  const groups = useMemo(() => {
    const list = ix.sources.filter((s) => s.hasText && (!filter || (s.title + (s.alias ?? '')).includes(filter)))
    return Object.entries(KINDS)
      .map(([k, label]) => ({ label, items: list.filter((s) => s.kind === k).sort((a, b) => a.date.localeCompare(b.date)) }))
      .filter((g) => g.items.length)
  }, [ix, filter])

  return (
    <div className="view">
      <div className="docs">
        <nav className="doclist" aria-label="文献列表">
          <div style={{ padding: '6px 16px 4px' }}>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="筛选文献…"
              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--rule-2)', borderRadius: 6, background: 'var(--card)', font: 'inherit', fontSize: 12.5 }}
            />
          </div>
          {groups.map((g) => (
            <div key={g.label}>
              <div className="group">{g.label}</div>
              {g.items.map((s) => (
                <button key={s.id} aria-current={s.id === id} onClick={() => openDoc(s.id)}>
                  <time>{fmtDate(s.date)}</time>
                  <strong>{s.alias ? `《${s.alias}》` : shortTitle(s)}</strong>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <Reader key={id} id={id} />
      </div>
    </div>
  )
}

function Reader({ id }: { id: string }) {
  const { ix, select, openDoc } = useApp()
  const s = ix.source.get(id)!
  const meta = ix.doc.get(id)
  const [text, setText] = useState<string | null>(null)
  const [hl, setHl] = useHistoryState('docs.hl', { concepts: true, people: false })
  const [find, setFind] = useHistoryState('docs.find', '')
  const [mode, setMode] = useHistoryState<'text' | 'pairs'>('docs.mode', meta?.pairs ? 'pairs' : 'text')
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/texts/${id}.txt`)
      .then((r) => r.text())
      .then(setText)
  }, [id])

  const rebuttedBy = ix.documents.filter((d) => d.pairs?.some((p) => p.against === id))

  const matcher = useMemo(() => {
    const terms = new Map<string, { ref: Ref; cls: string }>()
    if (hl.people)
      for (const p of ix.people)
        for (const n of [p.name, ...(p.aka ?? []).map((a) => a.name)]) if (n.length >= 2) terms.set(n, { ref: { type: 'person', id: p.id }, cls: 'p' })
    if (hl.concepts) for (const c of ix.concepts) for (const t of c.terms) terms.set(t, { ref: { type: 'concept', id: c.id }, cls: 'c' })
    const q = find.trim()
    const keys = [...terms.keys()].sort((a, b) => b.length - a.length)
    if (q) keys.unshift(q)
    if (!keys.length) return null
    return { re: new RegExp(`(${keys.map(esc).join('|')})`, 'g'), terms, q }
  }, [hl, find, ix])

  const findCount = useMemo(() => {
    const q = find.trim()
    if (!q || !text) return 0
    return text.split(q).length - 1
  }, [find, text])

  const render = (para: string): ReactNode => {
    if (!matcher) return para
    return para.split(matcher.re).map((part, i) => {
      if (i % 2 === 0) return part
      if (part === matcher.q) return <mark key={i} className="r">{part}</mark>
      const m = matcher.terms.get(part)
      if (!m) return part
      return (
        <mark key={i} className={m.cls} onClick={() => select(m.ref)} title={m.cls === 'c' ? ix.concept.get(m.ref.id)?.name : undefined}>
          {part}
        </mark>
      )
    })
  }

  const paras = useMemo(() => (text ?? '').split(/\n{2,}/).filter((p) => p.trim()), [text])

  return (
    <div className="reader" ref={scroller}>
      <div className="reader-inner">
        <div className="kicker">{KINDS[s.kind] ?? s.kind}</div>
        <h1>{s.alias ? `《${s.alias}》` : s.title}</h1>
        {s.alias && <div style={{ color: 'var(--ink-2)', fontFamily: 'var(--serif)', marginBottom: 6 }}>{s.title}</div>}
        <div className="docmeta">
          <span>{fmtDate(s.date)}</span>
          {s.author && <span>{s.author}</span>}
          {s.url && (
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.revid ? `维基文库 rev ${s.revid}` : (s.via ?? new URL(s.url).hostname)} ↗
            </a>
          )}
          {text && <span>{text.length.toLocaleString()} 字</span>}
        </div>
        {s.excerpt && (
          <div className="significance excerpt">
            节录：原作者为个人，著作权尚在保护期内，本站只收录用于评论的段落（不计入思想谱系词频）。全文见上方链接。
          </div>
        )}
        {meta && (
          <div className="significance">
            <div>{meta.summary}</div>
            {meta.significance && <div style={{ marginTop: 6, color: 'var(--ink-2)' }}>{meta.significance}</div>}
            {(meta.people.length > 0 || meta.concepts.length > 0) && (
              <div className="chips" style={{ marginTop: 8 }}>
                {meta.people.map((p) => (
                  <PersonChip key={p} id={p} />
                ))}
                {meta.concepts.map((c) => (
                  <Entity key={c} refTo={{ type: 'concept', id: c }} />
                ))}
              </div>
            )}
          </div>
        )}
        {rebuttedBy.map((d) => (
          <div className="significance rebut" key={d.id}>
            本文被{' '}
            <button className="linklike" style={{ fontWeight: 600 }} onClick={() => openDoc(d.id)}>
              {d.source.alias ? `《${d.source.alias}》` : d.source.title}
            </button>{' '}
            逐条批驳（{d.pairs!.filter((p) => p.against === id).length} 条），可在该文中查看对照。
          </div>
        ))}
        <div className="togglebar">
          {meta?.pairs && (
            <>
              <button aria-pressed={mode === 'pairs'} onClick={() => setMode('pairs')}>
                逐条对照
              </button>
              <button aria-pressed={mode === 'text'} onClick={() => setMode('text')}>
                全文
              </button>
              <span style={{ width: 12 }} />
            </>
          )}
          <button aria-pressed={hl.concepts} onClick={() => setHl((h) => ({ ...h, concepts: !h.concepts }))}>
            标注概念
          </button>
          <button aria-pressed={hl.people} onClick={() => setHl((h) => ({ ...h, people: !h.people }))}>
            标注人物
          </button>
          <input
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder="文内查找"
            style={{ marginLeft: 'auto', padding: '2px 9px', border: '1px solid var(--rule-2)', borderRadius: 999, font: 'inherit', fontSize: 12, width: 140, background: 'var(--card)' }}
          />
          {find.trim() && <span style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>{findCount} 处</span>}
        </div>

        {mode === 'pairs' && meta?.pairs ? (
          <div className="pairs">
            <div className="pairhead">
              <span />
              <span>被批驳的原文 · {shortTitle(ix.source.get(meta.pairs[0].against)!)}</span>
              <span>批驳 · {s.alias ?? s.title}</span>
            </div>
            {meta.pairs.map((p, i) => (
              <div className="pair" key={i}>
                <div className="num">{p.point}</div>
                <div className="orig">{render(p.original)}</div>
                <div className="reb">{render(p.rebuttal)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="body">
            {!text && <div className="loading">载入中</div>}
            {paras.map((p, i) =>
              p.startsWith('## ') ? (
                <h4 key={i}>{p.slice(3)}</h4>
              ) : (
                <p key={i} id={`p${i + 1}`}>
                  <span className="pnum">{i + 1}</span>
                  {render(p)}
                </p>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  )
}
