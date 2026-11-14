import { readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const name = 'tekton-erp-test-' + randomUUID().slice(0, 8)
const run = (args, input) => spawnSync('docker', args, { input, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, windowsHide: true })
let started = false
try {
  const start = run(['run','--detach','--name',name,'--env','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine'])
  if (start.status !== 0) throw new Error(start.stderr || 'Docker must be running.')
  started = true
  let ready = false
  for (let i=0;i<40;i++) {
    if (run(['exec',name,'pg_isready','-U','postgres']).status === 0) { ready = true; break }
    await new Promise(r => setTimeout(r, 500))
  }
  if (!ready) throw new Error('Test database did not start.')
  const migrations = readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()
  const sql = [readFileSync('tests/db-bootstrap.sql','utf8'), ...migrations.map(f=>readFileSync('supabase/migrations/'+f,'utf8')), readFileSync('tests/backend.sql','utf8')].join('\n')
  const result = run(['exec','-i',name,'psql','-U','postgres','-q','-v','ON_ERROR_STOP=1'], sql)
  const notices = result.stderr.split('\n').filter(line => /PASS:|ERROR:|CONTEXT:|FAIL:/.test(line))
  console.log(notices.join('\n'))
  if (result.status !== 0) throw new Error('Database tests failed.\n'+result.stderr)
  console.log('PostgreSQL migrations, permissions and workflow tests passed. Auth/Storage service behavior still needs hosted smoke tests.')
} finally {
  if (started) run(['rm','--force',name])
}
