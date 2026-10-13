// The personal view (M9): a bar under the top bar while a person is chosen, linking the pages that narrow to
// them, and the button that starts or ends it.
import { lensUsable, lensOf } from '../derive/lens'
import { lifespan } from '../lib/dates'
import { page, PAGE_IDS } from '../pages'
import { useApp } from '../state'
import { Portrait } from './Portrait'

const LENS_PAGES = PAGE_IDS.filter((p) => page(p).lens)

// before: separator text shown only when there is a button
export function LensButton({ id, before }: { id: string; before?: string }) {
  const { ix, as, setLens } = useApp()
  if (as !== id && !lensUsable(lensOf(ix, id))) return null
  return (
    <>
      {before}
      {as === id ? (
        <button className="linklike" onClick={() => setLens(undefined)}>
          退出个人视角
        </button>
      ) : (
        <button className="linklike" onClick={() => setLens(id)} title="时间线、关系网络、文献等页面只显示与此人有关的内容">
          以此人视角看全站
        </button>
      )}
    </>
  )
}

export function LensBar() {
  const { lens, page: current, go, setLens, openPerson } = useApp()
  if (!lens) return null
  const p = lens.person
  const here = page(current).lens
  return (
    <div className="lensbar" role="region" aria-label="个人视角">
      <Portrait p={p} width={28} />
      <div className="lens-who">
        <b>{p.name}</b>
        <small>
          个人视角 · {lifespan(p.born, p.died)} · 事件 {lens.events.size} · 关系 {lens.relations.length} · 文本 {lens.sources.size}
        </small>
      </div>
      <nav className="lens-pages" aria-label="个人视角下的页面">
        {LENS_PAGES.map((id) => (
          <button key={id} className="chip" aria-pressed={id === current} title={page(id).lens} onClick={() => go(id)}>
            {page(id).title}
          </button>
        ))}
        <button className="chip" onClick={() => openPerson(p.id)}>
          传记
        </button>
      </nav>
      <span className="lens-note">{here ?? '本页不随个人视角变化'}</span>
      <button className="lens-close" onClick={() => setLens(undefined)} aria-label="退出个人视角" title="退出个人视角">
        ×
      </button>
    </div>
  )
}
