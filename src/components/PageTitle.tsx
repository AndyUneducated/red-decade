import { groupOf, itemOf } from '../nav'
import { useApp } from '../state'

// A list page's h1: its menu label, after the group's name when the group has several pages — the only sign
// of where the page sits. Both come from nav.ts, so moving a page in the menu needs no change here.
export function PageTitle() {
  const { page } = useApp()
  const g = groupOf(page)
  return (
    <h1>
      {g.items.length > 1 && <span className="h1-group">{g.label} ›</span>}
      {itemOf(page).label}
    </h1>
  )
}
