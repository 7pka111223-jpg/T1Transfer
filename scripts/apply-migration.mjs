// Applies every .sql file in supabase/migrations (in filename order) to the
// project database. Migrations are written to be idempotent, so re-running is safe.
//
//   node --env-file=.env scripts/apply-migration.mjs
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set. Run: node --env-file=.env scripts/apply-migration.mjs')
  process.exit(1)
}

const dir = path.resolve('supabase/migrations')
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()

if (files.length === 0) {
  console.error(`No .sql migrations found in ${dir}`)
  process.exit(1)
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
})

await client.connect()
try {
  for (const file of files) {
    const sql = await readFile(path.join(dir, file), 'utf8')
    process.stdout.write(`Applying ${file} ... `)
    await client.query(sql)
    console.log('ok')
  }
  console.log(`Applied ${files.length} migration(s).`)
} finally {
  await client.end()
}
