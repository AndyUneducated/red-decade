import { useEffect, useState } from 'react'
import { Drawer } from './components/Drawer'
import { Search } from './components/Search'
import { useApp, VIEWS, type View } from './state'
import { Docs } from './views/Docs'
import { Fates } from './views/Fates'
import { Ideas } from './views/Ideas'
import { Narratives } from './views/Narratives'
import { Network } from './views/Network'
import { People } from './views/People'
import { Research } from './views/Research'
import { River } from './views/River'
import { Timeline } from './views/Timeline'

const COMPONENTS: Record<View, () => React.ReactNode> = {
  timeline: Timeline,
  people: People,
  network: Network,
  fates: Fates,
  river: River,
  ideas: Ideas,
  narratives: Narratives,
  docs: Docs,
  research: Research,
}

export default function App() {
  const { view, go, select, sel } = useApp()
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

  const Current = COMPONENTS[view]
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <b>
            红色<i>年代</i>
          </b>
          <span>1949–1989 · 当前深描 1966</span>
        </div>
        <nav className="tabs">
          {(Object.keys(VIEWS) as View[]).map((v) => (
            <button key={v} aria-current={v === view ? 'page' : undefined} onClick={() => go(v)}>
              {VIEWS[v]}
            </button>
          ))}
        </nav>
        <button className="searchbtn" onClick={() => setSearching(true)}>
          搜索人物、事件、概念、文献 <kbd>Ctrl K</kbd>
        </button>
      </header>
      <main className="main">
        <Current />
        <Drawer />
      </main>
      {searching && <Search onClose={() => setSearching(false)} />}
    </div>
  )
}
