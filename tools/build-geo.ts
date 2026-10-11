// Builds public/geo/basemap.json for the footprint map from Natural Earth (public domain):
// today's provincial boundaries of China (10m admin-1) and neighbouring countries (50m admin-0),
// simplified (Douglas–Peucker) and rounded to 0.01°. Downloads are cached in node_modules/.cache.
// Run by hand when the basemap needs to change: node tools/build-geo.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CACHE = join(ROOT, 'node_modules', '.cache', 'natural-earth')
const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'

type Ring = [number, number][]
type Geometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] }
type Feature = { properties: Record<string, string>; geometry: Geometry }

async function load(file: string): Promise<Feature[]> {
  mkdirSync(CACHE, { recursive: true })
  const path = join(CACHE, file)
  if (!existsSync(path)) writeFileSync(path, Buffer.from(await (await fetch(BASE + file)).arrayBuffer()))
  return JSON.parse(readFileSync(path, 'utf8')).features
}

function simplify(ring: Ring, tol: number): Ring {
  const keep = new Uint8Array(ring.length)
  keep[0] = keep[ring.length - 1] = 1
  const stack: [number, number][] = [[0, ring.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    const [ax, ay] = ring[a]
    const [bx, by] = ring[b]
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy)
    let max = 0
    let at = -1
    for (let i = a + 1; i < b; i++) {
      // a closed ring starts and ends on the same point: measure from that point instead of a segment
      const d = len < 1e-9 ? Math.hypot(ring[i][0] - ax, ring[i][1] - ay) : Math.abs(dy * ring[i][0] - dx * ring[i][1] + bx * ay - by * ax) / len
      if (d > max) (max = d), (at = i)
    }
    if (max > tol && at > 0) {
      keep[at] = 1
      stack.push([a, at], [at, b])
    }
  }
  const out: Ring = []
  for (let i = 0; i < ring.length; i++)
    if (keep[i]) {
      const p: [number, number] = [Math.round(ring[i][0] * 100) / 100, Math.round(ring[i][1] * 100) / 100]
      const last = out[out.length - 1]
      if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p)
    }
  return out
}

const area = (r: Ring) => Math.abs(r.reduce((s, [x, y], i) => s + x * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * y, 0) / 2)

function shrink(g: Geometry, tol: number, minArea: number): Geometry | undefined {
  const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)
    .map((poly) => poly.map((r) => simplify(r, tol)).filter((r) => r.length >= 4 && area(r) >= minArea))
    .filter((poly) => poly.length)
  if (!polys.length) return undefined
  return polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys }
}

const inBox = (g: Geometry) => {
  const pts = (g.type === 'Polygon' ? g.coordinates : g.coordinates.flat()).flat()
  return pts.some(([x, y]) => x > 60 && x < 150 && y > 5 && y < 62)
}

const admin1 = await load('ne_10m_admin_1_states_provinces.geojson')
const admin0 = await load('ne_50m_admin_0_countries.geojson')
const SAR = ['TWN', 'HKG', 'MAC']
const out: { type: 'Feature'; properties: { n: string; k: 'p' | 'c' }; geometry: Geometry }[] = []
for (const f of admin1)
  if (f.properties.adm0_a3 === 'CHN') {
    const geometry = shrink(f.geometry, 0.03, 0.02)
    if (geometry) out.push({ type: 'Feature', properties: { n: f.properties.name_zh, k: 'p' }, geometry })
  }
for (const f of admin0) {
  const a3 = f.properties.ADM0_A3
  if (a3 === 'CHN' || !inBox(f.geometry)) continue
  const geometry = shrink(f.geometry, SAR.includes(a3) ? 0.02 : 0.08, SAR.includes(a3) ? 0.001 : 0.3)
  if (geometry) out.push({ type: 'Feature', properties: { n: f.properties.NAME_ZH, k: SAR.includes(a3) ? 'p' : 'c' }, geometry })
}
mkdirSync(join(ROOT, 'public', 'geo'), { recursive: true })
const json = JSON.stringify({ type: 'FeatureCollection', features: out })
writeFileSync(join(ROOT, 'public', 'geo', 'basemap.json'), json)
console.log(`basemap.json  ${out.filter((f) => f.properties.k === 'p').length} provinces, ${out.filter((f) => f.properties.k === 'c').length} countries, ${(json.length / 1024).toFixed(0)} KB`)
