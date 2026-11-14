// Server-side, one-time bootstrap. Never use VITE_ variables for the service key.
import { createClient } from '@supabase/supabase-js'
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ERP_ADMIN_EMAIL, ERP_ADMIN_PASSWORD, ERP_ADMIN_NAME } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ERP_ADMIN_EMAIL || !ERP_ADMIN_NAME || !ERP_ADMIN_PASSWORD || ERP_ADMIN_PASSWORD.length < 12)
  throw new Error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ERP_ADMIN_EMAIL, ERP_ADMIN_NAME and ERP_ADMIN_PASSWORD (12+ characters) in the process environment.')
const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const { count, error: countError } = await client.from('erp_profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('disabled', false)
if (countError) throw new Error('Apply the ERP migrations first.')
if (count) throw new Error('An active administrator already exists. Use Users & Roles.')
const { data, error } = await client.auth.admin.createUser({ email: ERP_ADMIN_EMAIL, password: ERP_ADMIN_PASSWORD, email_confirm: true })
if (error || !data.user) throw new Error(error?.message ?? 'Could not create admin')
const { error: profileError } = await client.from('erp_profiles').insert({
  auth_id: data.user.id, email: ERP_ADMIN_EMAIL.toLowerCase(), name: ERP_ADMIN_NAME, role: 'admin',
})
if (profileError) {
  await client.auth.admin.deleteUser(data.user.id)
  throw new Error('Admin profile creation failed; the Auth account was rolled back.')
}
console.log('First administrator created. Sign in with the account you supplied.')
