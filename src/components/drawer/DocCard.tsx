import { useEffect, useState } from 'react'
import { SOURCE_KINDS } from '../../data/schema'
import { fmtDate } from '../../lib/dates'
import { useApp } from '../../state'
import { DocCitations } from './InsightNotes'

const TIER_LABEL: Record<number, string> = { 1: '一手文献', 2: '官方整理', 3: '亲历者', 4: '研究与资料库' }
const ACCESS = { unread: '未读', partial: '读了一部分', read: '已读' }

// Preview of a source: bibliographic facts, the summary, and the opening of the text; the full text
// is a page of its own. sub is the cited location within the source.
export function DocCard({ id, sub: loc }: { id: string; sub?: string }) {
  const { ix, openDoc } = useApp()
  const s = ix.source.get(id)
  const d = ix.doc.get(id)
  const [head, setHead] = useState<string>()
  useEffect(() => {
    setHead(undefined)
    if (!s?.hasText) return
    let live = true
    fetch(`${import.meta.env.BASE_URL}data/texts/${id}.txt`)
      .then((r) => (r.ok ? r.text() : ''))
      .then((t) => live && setHead(t.replace(/\s+/g, ' ').trim().slice(0, 200) || undefined))
    return () => {
      live = false
    }
  }, [id, s?.hasText])
  if (!s) return null
  return (
    <>
      <header>
        <div className="kicker">
          {TIER_LABEL[s.tier] ?? '文献'} · {SOURCE_KINDS[s.kind as keyof typeof SOURCE_KINDS] ?? s.kind}
        </div>
        <h2>{s.alias ? `《${s.alias}》` : s.title}</h2>
        <div className="meta">{[fmtDate(s.date), s.author, s.publisher, loc && `引用位置 ${loc}`].filter(Boolean).join(' · ')}</div>
      </header>
      <section>
        {s.alias && <p className="sub-note">{s.title}</p>}
        {d && <p>{d.summary}</p>}
        {head && <p className="excerpt-head">{head}……</p>}
        {s.note && <p className="sub-note">{s.note}</p>}
        <div className="chips">
          {s.hasText && (
            <button className="chip" onClick={() => openDoc(id)}>
              打开全文 →
            </button>
          )}
          {s.url && (
            <a className="chip" href={s.url} target="_blank" rel="noreferrer">
              来源网页 ↗
            </a>
          )}
        </div>
        {!s.hasText && <p className="sub-note">本站未收全文{s.access ? `（阅读状态：${ACCESS[s.access]}）` : ''}。</p>}
      </section>
      <DocCitations id={id} />
    </>
  )
}
