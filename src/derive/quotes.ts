// Verbatim quote checking. src/derive/ is shared by the data build (plain Node, so imports carry the .ts
// extension and nothing here may depend on Vite or React) and the browser.

// Tolerated: nested ‘’ rendered as “”, and a sentence-final mark where the source continues.
const norm = (s: string) => s.replace(/[‘’]/g, (q) => (q === '‘' ? '“' : '”'))

// the parts of `quote` (split at ……) that do not occur in `body`; empty when the quote checks out
export function quoteMisses(body: string, quote: string): string[] {
  const hay = norm(body)
  return quote
    .split('……')
    .map((s) => norm(s.trim()).replace(/[。！？，；]$/, ''))
    .filter((part) => part && !hay.includes(part))
}

// voice and note texts may end with an attribution in full-width parentheses: “……”（刘少奇检讨）
export const stripAttribution = (text: string) => text.replace(/（[^）]*）$/, '')
