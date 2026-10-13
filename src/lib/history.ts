// Per-history-entry memory: scroll offsets of every scroller under .main, plus view-local UI state
// (filters, grouping, sort), so going back returns to the page as it was left.
// Kept in memory only; a reload starts fresh.

// prev is the entry this one was pushed from, which is the one below it in the browser's stack
type Entry = { scroll: Map<string, [number, number]>; ui: Map<string, unknown>; prev?: { key: string; hash: string } }

const entries = new Map<string, Entry>()
let current = ''
let restoring = false

const newKey = () => Math.random().toString(36).slice(2, 10)

function entry(k: string): Entry {
  let e = entries.get(k)
  if (!e) entries.set(k, (e = { scroll: new Map(), ui: new Map() }))
  return e
}

export const currentEntry = () => current

// the entry key of the page being shown; an entry without one (first load, hand-edited hash) gets one
export function adoptEntry(): { key: string; known: boolean } {
  const k = (history.state as { k?: string } | null)?.k
  if (k) return { key: (current = k), known: entries.has(k) }
  current = newKey()
  history.replaceState({ k: current }, '', location.href)
  return { key: current, known: false }
}

// an element's address is its child-index path from .main, checked against its class on the way back
const root = () => document.querySelector('.main')

function pathOf(el: Element): string | undefined {
  const r = root()
  if (!r || !r.contains(el) || el === r) return
  const steps: number[] = []
  for (let n: Element = el; n !== r; n = n.parentElement!) steps.unshift([...n.parentElement!.children].indexOf(n))
  return `${steps.join('/')}|${el.className}`
}

function resolve(path: string): Element | undefined {
  const [steps, cls] = path.split('|')
  let n: Element | undefined = root() ?? undefined
  for (const i of steps.split('/')) n = n?.children[Number(i)]
  return n && n.className === cls ? n : undefined
}

export function pushEntry(hash: string) {
  const from = entry(current)
  const kept = [...from.scroll].map(([p, v]) => [p, v, resolve(p)] as const)
  const prev = { key: current, hash: location.hash }
  current = newKey()
  history.pushState({ k: current }, '', hash)
  const to = entry(current)
  to.prev = prev
  // scrollers that survive the navigation keep their offset in the new entry; remounted ones start at the top
  queueMicrotask(() =>
    requestAnimationFrame(() => {
      for (const [p, v, el] of kept) if (el && el.isConnected && resolve(p) === el && !to.scroll.has(p)) to.scroll.set(p, v)
    }),
  )
}

// the nearest earlier entry whose hash passes the test, and how many steps back it is, if this session's
// history reaches it
export function findBack(test: (hash: string) => boolean): { n: number; hash: string } | undefined {
  let prev = entries.get(current)?.prev
  for (let n = 1; prev && n <= 50; n++) {
    if (test(prev.hash)) return { n, hash: prev.hash }
    prev = entries.get(prev.key)?.prev
  }
}

// set an offset that the content may not be tall enough for yet (images, fetched text)
export function scrollWhenReady(el: Element, top: number) {
  const t0 = performance.now()
  const tick = () => {
    el.scrollTop = top
    if (el.isConnected && el.scrollHeight - el.clientHeight < top - 1 && performance.now() - t0 < 1000) requestAnimationFrame(tick)
  }
  tick()
}

export function getUi<T>(name: string): { has: boolean; value?: T } {
  const ui = entry(current).ui
  return { has: ui.has(name), value: ui.get(name) as T }
}

export function setUi(name: string, value: unknown) {
  entry(current).ui.set(name, value)
}

addEventListener(
  'scroll',
  (e) => {
    if (restoring || !(e.target instanceof Element)) return
    const p = pathOf(e.target)
    if (p) entry(current).scroll.set(p, [e.target.scrollTop, e.target.scrollLeft])
  },
  { capture: true, passive: true },
)

// content may arrive late (document text is fetched, charts measure themselves), so keep trying for a moment;
// any input from the reader ends the attempt
export function beginRestore() {
  restoring = true
}

export function restoreScroll(k: string) {
  const todo = new Map(entries.get(k)?.scroll)
  const t0 = performance.now()
  let aborted = false
  const abort = () => (aborted = true)
  const inputs = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const
  for (const ev of inputs) addEventListener(ev, abort, { capture: true, passive: true })
  // offsets are re-applied through a short settling window: images that load above the target shift
  // the content, and the browser's scroll anchoring would otherwise carry the view past it
  const tick = () => {
    if (k !== current) aborted = true
    let short = false
    if (!aborted)
      for (const [p, [top, left]] of todo) {
        const el = resolve(p)
        if (!el) {
          short = true
          continue
        }
        el.scrollTop = top
        el.scrollLeft = left
        if (el.scrollHeight - el.clientHeight < top - 1 || el.scrollWidth - el.clientWidth < left - 1) short = true
      }
    const age = performance.now() - t0
    if (aborted || (!short && age > 1000) || age > 2500) {
      for (const ev of inputs) removeEventListener(ev, abort, { capture: true })
      if (k === current) restoring = false
      return
    }
    requestAnimationFrame(tick)
  }
  tick()
}
