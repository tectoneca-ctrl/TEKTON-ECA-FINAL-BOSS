import { createClient } from '@supabase/supabase-js'
import { readBackendConfig } from './config'

export const backendConfig = readBackendConfig(import.meta.env)
export const isCloud = backendConfig.mode === 'supabase'
const storage = {
  getItem: (key: string) => sessionStorage.getItem(key) ?? localStorage.getItem(key),
  setItem: (key: string, value: string) => {
    const remember = localStorage.getItem('tk_cloud_remember') !== 'no'
    ;(remember ? sessionStorage : localStorage).removeItem(key)
    ;(remember ? localStorage : sessionStorage).setItem(key, value)
  },
  removeItem: (key: string) => { sessionStorage.removeItem(key); localStorage.removeItem(key) },
}
export const supabase = isCloud && !backendConfig.error ? createClient(backendConfig.url, backendConfig.key, {
  auth: { storageKey: 'tk_supabase_auth', storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
}) : null
export function cloudClient() {
  if (!supabase) throw new Error(backendConfig.error ?? 'Supabase mode is not enabled.')
  return supabase
}
export function check(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}
