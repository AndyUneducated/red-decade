// File access and the error list shared by every build stage.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { z } from 'zod'

export const ROOT = fileURLToPath(new URL('../..', import.meta.url))
export const path = (...p: string[]) => join(ROOT, ...p)
export const exists = (...p: string[]) => existsSync(path(...p))
export const read = (...p: string[]) => parse(readFileSync(path(...p), 'utf8'))
export const yamlFiles = (...p: string[]) =>
  readdirSync(path(...p))
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .map((f) => [...p, f])

// every stage appends here; the build stops before writing anything if the list is not empty
export const errors: string[] = []

export function load<T extends z.ZodType>(schema: T, data: unknown, label: string): z.infer<T>[] {
  const result = z.array(schema).safeParse(data ?? [])
  if (!result.success) {
    for (const issue of result.error.issues) errors.push(`${label}: ${issue.path.join('.')} ${issue.message}`)
    return []
  }
  return result.data
}
