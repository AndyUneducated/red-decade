import { groupOf, useApp, VIEWS } from '../state'

export function SubNav() {
  const { view, go } = useApp()
  const g = groupOf(view)
  if (g.views.length < 2) return null
  return (
    <nav className="subnav" aria-label={g.label}>
      {g.views.map((v) => (
        <button key={v} aria-current={v === view ? 'page' : undefined} onClick={() => go(v)}>
          {VIEWS[v]}
        </button>
      ))}
    </nav>
  )
}
