import { useLayoutEffect, useRef, useState } from 'react'
import { label, type Ref } from '../data/atlas'
import { scrollWhenReady } from '../lib/history'
import { useApp } from '../state'
import { CARDS } from './drawer/cards'

const same = (a: Ref, b: Ref) => a.type === b.type && a.id === b.id && a.sub === b.sub

export function Drawer() {
  const { ix, sel, select } = useApp()
  // cards opened from inside the drawer stack up, so a citation followed from a person can lead back,
  // to the place in the card where the reader left it
  const [stack, setStack] = useState<{ ref: Ref; top: number }[]>([])
  const prev = useRef<Ref>(undefined)
  const backTo = useRef<number>(undefined)
  const aside = useRef<HTMLElement>(null)
  // last offset seen before the card changes; reading scrollTop after the swap would give the new card's clamp
  const top = useRef(0)
  useLayoutEffect(() => {
    const p = prev.current
    prev.current = sel
    const el = aside.current
    if (!sel) setStack([])
    else if (backTo.current !== undefined) {
      if (el) scrollWhenReady(el, backTo.current)
      backTo.current = undefined
    } else if (p && !same(p, sel)) {
      setStack((s) => [...s.slice(-9), { ref: p, top: top.current }])
      if (el) el.scrollTop = 0
    }
    top.current = el?.scrollTop ?? 0
  }, [sel])
  if (!sel) return null
  const back = stack[stack.length - 1]
  const Card = CARDS[sel.type]
  return (
    <aside className="drawer" aria-label="详情" ref={aside} onScroll={(e) => (top.current = e.currentTarget.scrollTop)}>
      <button className="close" onClick={() => select(undefined)} aria-label="关闭" title="关闭（Esc）">
        ×
      </button>
      {back && (
        <button
          className="drawer-back"
          onClick={() => {
            backTo.current = back.top
            setStack((s) => s.slice(0, -1))
            select(back.ref, true)
          }}
        >
          ← {label(ix, back.ref)}
        </button>
      )}
      <Card id={sel.id} sub={sel.sub} />
    </aside>
  )
}
