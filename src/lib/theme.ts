import { useSyncExternalStore } from 'react'

// The theme lives on <html data-theme>; index.html sets it before first paint from
// localStorage, or from the system preference when the reader has never chosen.
export type Theme = 'light' | 'dark'
const KEY = 'rd-theme'
const listeners = new Set<() => void>()

const read = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

function apply(t: Theme) {
  document.documentElement.dataset.theme = t
  listeners.forEach((f) => f())
}

export function setTheme(t: Theme) {
  try {
    localStorage.setItem(KEY, t)
  } catch {
    // private mode: the choice just won't persist
  }
  apply(t)
}

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  let chosen: string | null = null
  try {
    chosen = localStorage.getItem(KEY)
  } catch {
    // ignore
  }
  if (!chosen) apply(e.matches ? 'dark' : 'light')
})

export function useTheme(): Theme {
  return useSyncExternalStore((f) => {
    listeners.add(f)
    return () => listeners.delete(f)
  }, read)
}
