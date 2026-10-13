// a source's name for lists and chart labels: its alias, else the title without bracketed notes and book marks
export const shortTitle = (s: { title: string; alias?: string }) =>
  (s.alias ?? s.title.replace(/[（(][^)）]*[)）]/g, '').replace(/^《|》$/g, '')).trim()
