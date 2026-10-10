// Minimal wikitext → plain text conversion for Wikisource documents.
// Headings become "## title", paragraphs are separated by blank lines,
// templates/refs/categories are dropped.

function stripTemplates(src: string): string {
  let out = ''
  let depth = 0
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '{' && src[i + 1] === '{') {
      depth++
      i++
    } else if (depth && src[i] === '}' && src[i + 1] === '}') {
      depth--
      i++
    } else if (!depth) out += src[i]
  }
  return out
}

export function wikiToText(wikitext: string): string {
  let s = wikitext
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  s = s.replace(/<ref[^>/]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
  s = stripTemplates(s)
  s = s.replace(/\{\|[\s\S]*?\|\}/g, '')
  s = s.replace(/\[\[(?:Category|分类|File|Image|文件):[^\]]*\]\]/gi, '')
  s = s.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1').replace(/\[\[([^\]]*)\]\]/g, '$1')
  s = s.replace(/\[https?:\/\/\S+\s([^\]]*)\]/g, '$1')
  s = s.replace(/'''?/g, '')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/?[a-z][^>]*>/gi, '')
  s = s.replace(/^\s*(=+)\s*(.*?)\s*\1\s*$/gm, (_, eq: string, t: string) => `\n${'#'.repeat(Math.min(eq.length, 4))} ${t}\n`)
  s = s.replace(/^[:*#]+\s*/gm, '')
  s = s.replace(/&nbsp;/g, ' ').replace(/\u200b/g, '')
  return s
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s*\n\s*/g, p.startsWith('#') ? ' ' : '').trim())
    .filter(Boolean)
    .join('\n\n') + '\n'
}
