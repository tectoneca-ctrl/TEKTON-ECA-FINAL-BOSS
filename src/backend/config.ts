export interface BackendConfig { mode: 'demo' | 'supabase'; url: string; key: string; error?: string }
export function readBackendConfig(env: Record<string, string | undefined>): BackendConfig {
  const mode = env.VITE_BACKEND_MODE ?? 'demo'
  const url = env.VITE_SUPABASE_URL?.trim() ?? ''
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
  const result: BackendConfig = { mode: mode === 'demo' ? 'demo' : 'supabase', url, key }
  if (!['demo', 'supabase'].includes(mode)) return { ...result, error: 'Invalid backend mode.' }
  if (mode === 'demo') return result
  if (!url || !key) return { ...result, error: 'Supabase is not configured. Ask Admin to finish backend setup.' }
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) throw new Error()
  } catch { return { ...result, error: 'Invalid Supabase project URL.' } }
  if (key.startsWith('sb_secret_')) return { ...result, error: 'Use a publishable key, never a secret key in the frontend.' }
  if (!key.startsWith('sb_publishable_')) {
    try {
      const part = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      if (JSON.parse(atob(part)).role !== 'anon') throw new Error()
    } catch { return { ...result, error: 'Use a Supabase publishable key or legacy anon key.' } }
  }
  return result
}
