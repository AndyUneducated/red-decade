import { useEffect, useState } from 'react'
import { Drawer } from './components/Drawer'
import { Nav } from './components/Nav'
import { Search } from './components/Search'
import { setTheme, useTheme } from './lib/theme'
import { useApp, type View } from './state'
import { Docs } from './views/Docs'
import { Factions } from './views/Factions'
import { Fates } from './views/Fates'
import { Figures } from './views/Figures'
import { Ideas } from './views/Ideas'
import { MapView } from './views/Map'
import { Narratives } from './views/Narratives'
import { Network } from './views/Network'
import { Orgs } from './views/Orgs'
import { People } from './views/People'
import { Research } from './views/Research'
import { River } from './views/River'
import { SeriesView } from './views/Series'
import { Timeline } from './views/Timeline'

const COMPONENTS: Record<View, () => React.ReactNode> = {
  timeline: Timeline,
  people: People,
  orgs: Orgs,
  network: Network,
  fates: Fates,
  river: () => <River part="people" />,
  control: () => <River part="orgs" />,
  factions: Factions,
  map: MapView,
  ideas: Ideas,
  narratives: Narratives,
  figures: Figures,
  series: SeriesView,
  docs: Docs,
  research: Research,
}

function ThemeButton() {
  const theme = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button className="themebtn" onClick={() => setTheme(next)} title={next === 'dark' ? '暗夜模式' : '日间模式'} aria-label={next === 'dark' ? '切换到暗夜模式' : '切换到日间模式'}>
      <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
        {theme === 'dark' ? (
          <>
            <circle cx={8} cy={8} r={3} />
            <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
          </>
        ) : (
          <path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1z" />
        )}
      </svg>
    </button>
  )
}

export default function App() {
  const { view, select, sel } = useApp()
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !(e.target instanceof HTMLInputElement))) {
        e.preventDefault()
        setSearching(true)
      }
      if (e.key === 'Escape' && sel && !searching) select(undefined)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [sel, searching, select])

  // A click on blank space closes the drawer. Anything interactive (buttons, links, fields, or SVG marks
  // drawn with a pointer cursor) is left to its own handler, as is a click that ends a text selection.
  useEffect(() => {
    if (!sel) return
    const onClick = (e: MouseEvent) => {
      const el = e.target as Element
      if (!el.isConnected || searching) return
      if (el.closest('.drawer, .palette, .topbar, button, a, input, select, textarea, label, [role="button"]')) return
      if (getComputedStyle(el).cursor === 'pointer') return
      if (getSelection()?.toString()) return
      select(undefined)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [sel, searching, select])

  const Current = COMPONENTS[view]
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <b>
            红色<i>年代</i>
          </b>
          <span>1949–1989 · 当前深描 1966–1976</span>
        </div>
        <Nav />
        <button className="searchbtn" onClick={() => setSearching(true)}>
          <span className="sb-long">搜索人物、事件、概念、文献</span>
          <span className="sb-short">搜索</span> <kbd>Ctrl K</kbd>
        </button>
        <ThemeButton />
      </header>
      <main className="main">
        <Current />
        <Drawer />
      </main>
      {searching && <Search onClose={() => setSearching(false)} />}
    </div>
  )
}
