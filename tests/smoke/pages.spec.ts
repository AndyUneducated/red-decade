// Opens every page of the registry (and each sample detail page) on a desktop and a phone screen, and fails on
// script errors, a missing title, or content cut off by a box that cannot scroll. Run against a build:
// npm run build && npm run test:smoke
import { expect, test } from '@playwright/test'
import { itemOf } from '../../src/nav'
import { page as pageDef, PAGE_IDS } from '../../src/pages'

// the docs page always shows a document, so its heading is the document's title rather than the page's
const TITLED_BY_ENTITY = new Set(['docs'])

const urls = PAGE_IDS.flatMap((p) => {
  const s = pageDef(p).sample
  const title = TITLED_BY_ENTITY.has(p) ? undefined : itemOf(p).label
  return [{ hash: `#/${p}`, title }, ...(s ? [{ hash: `#/${p}/${s}`, title: undefined }] : [])]
})
urls.push({ hash: '#/timeline?sel=person:mao-zedong', title: itemOf('timeline').label })
urls.push({ hash: '#/lineage?sel=concept:capitalist-roader', title: itemOf('lineage').label })

for (const { hash, title } of urls)
  test(hash, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    await page.goto('./' + hash, { waitUntil: 'domcontentloaded' })
    const h1 = page.locator('main h1').first()
    await expect(h1).toBeVisible()
    if (title) await expect(h1).toContainText(title)
    else await expect(h1).not.toBeEmpty()
    await page.waitForLoadState('networkidle')

    const clipped = await page.evaluate(() => {
      const name = (el: Element) => el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ').join('.') : '')
      const out: string[] = []
      for (const el of document.querySelectorAll('.shell *')) {
        if (el.closest('svg') && el.tagName !== 'svg') continue
        const cs = getComputedStyle(el)
        if (cs.textOverflow === 'ellipsis') continue
        const oy = el.scrollHeight - el.clientHeight
        const ox = el.scrollWidth - el.clientWidth
        if (oy > 4 && !['auto', 'scroll', 'visible'].includes(cs.overflowY)) out.push(`${name(el)} cuts ${oy}px vertically`)
        if (ox > 4 && !['auto', 'scroll', 'visible'].includes(cs.overflowX)) out.push(`${name(el)} cuts ${ox}px horizontally`)
      }
      const doc = document.documentElement
      if (doc.scrollWidth > innerWidth + 2) out.push(`page is ${doc.scrollWidth}px wide in a ${innerWidth}px window`)
      return out
    })
    expect(clipped).toEqual([])
    expect(errors).toEqual([])
  })
