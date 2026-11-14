import test from 'node:test'
import assert from 'node:assert/strict'
import { readBackendConfig } from '../src/backend/config.ts'

test('demo is explicit and preserves existing offline behavior', () => {
  assert.equal(readBackendConfig({}).mode, 'demo')
  assert.equal(readBackendConfig({}).error, undefined)
})
test('Supabase mode fails closed when credentials are absent', () => {
  const config = readBackendConfig({ VITE_BACKEND_MODE: 'supabase' })
  assert.equal(config.mode, 'supabase')
  assert.match(config.error!, /not configured/)
})
test('accepts public project URL and publishable key', () => {
  assert.equal(readBackendConfig({ VITE_BACKEND_MODE: 'supabase', VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example' }).error, undefined)
})
test('rejects secret keys and service-role JWTs from browser config', () => {
  const common = { VITE_BACKEND_MODE: 'supabase', VITE_SUPABASE_URL: 'https://example.supabase.co' }
  assert.match(readBackendConfig({ ...common, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_example' }).error!, /never a secret/)
  const token = 'a.' + Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') + '.b'
  assert.match(readBackendConfig({ ...common, VITE_SUPABASE_PUBLISHABLE_KEY: token }).error!, /publishable key/)
})
test('rejects insecure remote URLs and unknown modes', () => {
  assert.match(readBackendConfig({ VITE_BACKEND_MODE: 'supabase', VITE_SUPABASE_URL: 'http://example.com', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example' }).error!, /Invalid/)
  assert.match(readBackendConfig({ VITE_BACKEND_MODE: 'typo' }).error!, /Invalid/)
})
