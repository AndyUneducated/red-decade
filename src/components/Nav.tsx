import { useEffect, useRef, useState } from 'react'
import { groupOf, itemOf, lastItem, NAV, useApp, type NavItem } from '../state'

type Group = (typeof NAV)[number]

// The menu is position: fixed so the scrolling tab strip does not clip it. With a mouse it opens on
// hover and a click on the tab goes to the group's last page; on a touch screen the first tap opens it.
function GroupTab({ g, open, setOpen }: { g: Group; open: boolean; setOpen: (o: boolean) => void }) {
  const { view, doc, go, up } = useApp()
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const timer = useRef<number>(undefined)
  const tapOpened = useRef(false)
  const [pos, setPos] = useState<{ left: number; top: number }>()
  const multi = g.items.length > 1
  const active = groupOf(view) === g
  const current = itemOf(view, doc)

  const place = () => {
    const r = btn.current!.getBoundingClientRect()
    setPos({ left: Math.max(8, Math.min(r.left, innerWidth - 268)), top: r.bottom })
  }
  const show = (on: boolean, delay = 0) => {
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      if (on) place()
      setOpen(on)
    }, delay)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  const visit = (it: NavItem) => {
    setOpen(false)
    if (doc && (view === 'people' || view === 'orgs') && it.view === view && !it.doc) up(view)
    else go(it.view, it.doc)
  }

  return (
    <div
      className="navgroup"
      onPointerEnter={(e) => multi && e.pointerType === 'mouse' && show(true, 60)}
      onPointerLeave={(e) => multi && e.pointerType === 'mouse' && show(false, 160)}
    >
      <button
        ref={btn}
        aria-current={active ? 'page' : undefined}
        aria-haspopup={multi ? 'menu' : undefined}
        aria-expanded={multi ? open : undefined}
        onPointerDown={(e) => {
          tapOpened.current = multi && e.pointerType !== 'mouse' && !open
          if (tapOpened.current) show(true)
        }}
        onClick={() => {
          if (tapOpened.current) tapOpened.current = false
          else visit(lastItem(g))
        }}
        onKeyDown={(e) => {
          if (!multi) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            show(true)
            requestAnimationFrame(() => menu.current?.querySelector('button')?.focus())
          }
          if (e.key === 'Escape') show(false)
        }}
      >
        {g.label}
        {multi && <span className="navcaret" aria-hidden />}
      </button>
      {multi && open && pos && (
        <div
          ref={menu}
          className="navmenu"
          role="menu"
          aria-label={g.label}
          style={{ left: pos.left, top: pos.top }}
          onKeyDown={(e) => {
            const items = [...menu.current!.querySelectorAll('button')]
            const i = items.indexOf(document.activeElement as HTMLButtonElement)
            if (e.key === 'ArrowDown') items[(i + 1) % items.length]?.focus()
            if (e.key === 'ArrowUp') items[(i - 1 + items.length) % items.length]?.focus()
            if (e.key === 'Escape') {
              show(false)
              btn.current?.focus()
            }
            if (['ArrowDown', 'ArrowUp'].includes(e.key)) e.preventDefault()
          }}
        >
          {g.items.map((it) => (
            <button key={it.label} role="menuitem" aria-current={active && it === current ? 'page' : undefined} onClick={() => visit(it)}>
              <b>{it.label}</b>
              <small>{it.desc}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Nav() {
  const { view, doc } = useApp()
  const [open, setOpen] = useState<string>()
  useEffect(() => setOpen(undefined), [view, doc])
  // a tap or click anywhere outside closes an open menu
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !(e.target as Element).closest('.navgroup') && setOpen(undefined)
    addEventListener('pointerdown', close)
    return () => removeEventListener('pointerdown', close)
  }, [open])
  return (
    <nav className="tabs">
      {NAV.map((g) => (
        <GroupTab
          key={g.label}
          g={g}
          open={open === g.label}
          // a tab's late close must not shut the menu the pointer has since moved on to
          setOpen={(o) => setOpen((cur) => (o ? g.label : cur === g.label ? undefined : cur))}
        />
      ))}
    </nav>
  )
}