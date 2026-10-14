// Compiles content/*.yaml + research/*.yaml + sources/text into public/data.
// Fails on schema errors, dangling ids, or quotes that do not occur verbatim in their source.
// The stages live in tools/build/, in the order they run here.
import { check } from './build/check.ts'
import { compile, stats, write } from './build/emit.ts'
import { errors } from './build/io.ts'
import { link } from './build/link.ts'
import { loadAll } from './build/load.ts'
import { openData, openStats, writeOpen } from './build/open.ts'
import { checkQuotes } from './build/quotes.ts'

const data = loadAll()
link(data)
check(data)
checkQuotes(data)
const { atlas, pressTexts } = compile(data)
const open = openData(atlas)
atlas.moved = open.relinks

if (errors.length) {
  console.error(`\n${errors.length} error(s):\n` + errors.map((e) => `  ✗ ${e}`).join('\n'))
  process.exit(1)
}
write(data, atlas)
writeOpen(open)
console.log(stats(data, pressTexts.length) + '\n' + openStats(open))
