// Boots the generated schema in PGlite (Node) and reports any statement that fails.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const src = readFileSync('lib/local/schema.generated.ts', 'utf8')
const grab = (name) => {
  const start = src.indexOf(`export const ${name}`)
  const eq = src.indexOf('= ', start) + 2
  const end = src.indexOf('\nexport const', eq)
  return JSON.parse(src.slice(eq, end === -1 ? undefined : end))
}
export async function bootLocalDb() {
  const db = new PGlite()
  let failed = 0
  const all = [...grab('LOCAL_PRELUDE_STATEMENTS'), ...grab('LOCAL_SCHEMA_STATEMENTS'), ...grab('LOCAL_EXTRAS_STATEMENTS')]
  for (const [i, stmt] of all.entries()) {
    try {
      await db.exec(stmt)
    } catch (e) {
      failed++
      console.log(`#${i} FAILED: ${e.message}\n   ${stmt.slice(0, 120).replace(/\s+/g, ' ')}`)
    }
  }
  console.log(`${all.length - failed}/${all.length} statements ok`)
  return db
}
if (process.argv[1].endsWith('test-local-schema.mjs')) await bootLocalDb()
