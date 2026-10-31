// README screenshots from a production build, in the light theme, at 1440×900 or 390×844.
//   npx vite build && node tools/screenshots.ts "<hash>|<name>[|phone]" ...
//   node tools/screenshots.ts "#/timeline|timeline" "#/today|today-phone|phone"
// Writes docs/screenshots/<name>.png; prints any script error the page raised.
import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = fileURLToPath(new URL('../dist', import.meta.url))
const OUT = fileURLToPath(new URL('../docs/screenshots/', import.meta.url))
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg' }

// the site is deployed under /red-decade/, so serve dist there
const server = createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname).replace(/^\/red-decade/, '')
    if (rel.endsWith('/')) rel += 'index.html'
    const path = join(DIST, normalize(rel).replace(/^([/\\]|\.\.)+/, ''))
    const body = await readFile(path)
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end()
  }
})
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/red-decade/`

const channel = process.env.PLAYWRIGHT_CHANNEL ?? 'msedge'
const browser = await chromium.launch(channel === 'chromium' ? {} : { channel })
for (const job of process.argv.slice(2)) {
  const [hash, name, size] = job.split('|')
  const phone = size === 'phone'
  const page = await browser.newPage({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: phone, hasTouch: phone })
  await page.addInitScript(() => localStorage.setItem('rd-theme', 'light'))
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(url + hash, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: join(OUT, `${name}.png`) })
  console.log(name, errors.length ? errors : 'ok')
  await page.close()
}
await browser.close()
server.close()
