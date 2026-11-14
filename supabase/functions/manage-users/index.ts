import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

const roles = new Set(['admin','assistant_manager','site_supervisor','foreman','client','documents','budget','asset','hr','finance'])
Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin')
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://tekton-eca-final-boss.pages.dev,http://localhost:5173').split(',').map(s => s.trim())
  const headers: Record<string,string> = {
    'Content-Type': 'application/json', 'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  if (origin && !allowed.includes(origin)) return new Response('Forbidden origin', { status: 403 })
  if (origin) headers['Access-Control-Allow-Origin'] = origin
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405)
  const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1]
  if (!token) return reply({ error: 'Sign in required' }, 401)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: auth, error: authError } = await admin.auth.getUser(token)
  if (authError || !auth.user) return reply({ error: 'Invalid session' }, 401)
  const { data: caller, error: profileError } = await admin.from('erp_profiles').select('role,disabled').eq('auth_id', auth.user.id).single()
  if (profileError || caller?.disabled || caller?.role !== 'admin') return reply({ error: 'Admin access required' }, 403)
  try {
    const body = await request.json()
    if (body.action === 'password') {
      if (!Number.isSafeInteger(body.id) || typeof body.password !== 'string' || body.password.length < 12) return reply({ error: 'Use a password with at least 12 characters.' }, 400)
      const { data: target, error } = await admin.from('erp_profiles').select('auth_id').eq('id', body.id).eq('disabled', false).single()
      if (error || !target) return reply({ error: 'User not found' }, 404)
      const result = await admin.auth.admin.updateUserById(target.auth_id, { password: body.password })
      if (result.error) return reply({ error: result.error.message }, 400)
      await admin.from('erp_audit').insert({ actor: auth.user.id, actor_name: auth.user.email ?? 'Admin', message: 'Reset password of user #' + body.id })
      return reply({ ok: true })
    }
    if (body.action !== 'create') return reply({ error: 'Unknown action' }, 400)
    const u = body.user
    if (!u || typeof u.name !== 'string' || !u.name.trim() || u.name.length > 150 || typeof u.email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email) || !roles.has(u.role) || typeof u.password !== 'string' || u.password.length < 12)
      return reply({ error: 'Provide a name, email, valid role and password of at least 12 characters.' }, 400)
    const project = ['foreman','client','site_supervisor'].includes(u.role) ? u.project || null : null
    if (project) {
      const { data } = await admin.from('erp_projects').select('code').eq('code', project).maybeSingle()
      if (!data) return reply({ error: 'Project not found' }, 400)
    }
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: u.email.trim().toLowerCase(), password: u.password, email_confirm: true,
    })
    if (createError || !created.user) return reply({ error: createError?.message ?? 'Could not create account' }, 400)
    const { error: insertError } = await admin.from('erp_profiles').insert({
      auth_id: created.user.id, name: u.name.trim(), email: u.email.trim().toLowerCase(), role: u.role, project,
    })
    if (insertError) {
      await admin.auth.admin.deleteUser(created.user.id)
      return reply({ error: 'Account setup failed. Verify project and role, then try again.' }, 400)
    }
    await admin.from('erp_audit').insert({ actor: auth.user.id, actor_name: auth.user.email ?? 'Admin', message: 'Created account for ' + u.email.trim().toLowerCase() })
    return reply({ ok: true })
  } catch { return reply({ error: 'Invalid request' }, 400) }
})
