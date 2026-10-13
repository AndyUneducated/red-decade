import { groupOf, useApp } from '../state'

// the group's name before a page title, as the only sign of where the page sits; nothing for one-page groups
export function GroupCrumb() {
  const { view } = useApp()
  const g = groupOf(view)
  if (g.items.length < 2) return null
  return <span className="h1-group">{g.label} ›</span>
}
