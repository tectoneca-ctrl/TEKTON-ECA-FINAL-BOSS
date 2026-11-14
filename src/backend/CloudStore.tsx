import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { cloudClient, backendConfig } from './client'
import { MODULES } from '../modules'
import { StoreContext, type Store, type User, type Rec, type Log, type Settings, type Mutation, type FinanceSummary } from '../store'
import { ErrorState, PageSkeleton, useToast, Btn } from '../ux'

interface Snapshot { readableModules: string[]; meId: number; users: User[]; data: Record<string, Rec[]>; log: Log[]; settings: Settings; financeSummary: FinanceSummary[] }
const empty = (): Snapshot => ({ readableModules: [], meId: 0, users: [], data: Object.fromEntries(Object.keys(MODULES).map(k => [k, []])),
  log: [], settings: { company: 'Tekton ECA Construction', vat: 12, markup: 15, retention: 10 }, financeSummary: [] })

export function CloudStoreProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [state, setState] = useState<Snapshot>(empty)
  const latest = useRef(state)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [recovery, setRecovery] = useState(false)
  const [recoveryPw, setRecoveryPw] = useState('')
  const [recoveryConfirm, setRecoveryConfirm] = useState('')
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  const activeUser = useRef<string | null>(null)
  const generation = useRef(0)
  const queue = useRef(Promise.resolve())
  const [sel, setSel] = useState('all')
  const [read, setRead] = useState<string[]>([])
  const apply = useCallback((value: Snapshot) => {
    const merged = { ...value, data: { ...empty().data, ...value.data } }
    latest.current = merged; setState(merged)
  }, [])
  const refresh = useCallback(async () => {
    const who = activeUser.current
    if (!who) return
    const ticket = ++generation.current
    const { data, error: err } = await cloudClient().rpc('erp_snapshot')
    if (who !== activeUser.current || ticket !== generation.current) return
    if (err) { apply(empty()); throw new Error(err.message) }
    apply(data as Snapshot); setError('')
  }, [apply])
  useEffect(() => {
    if (backendConfig.error) { setError(backendConfig.error); setLoading(false); return }
    const client = cloudClient()
    let live = true
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (!live) return
      const next = session?.user.id ?? null
      const changed = next !== activeUser.current
      activeUser.current = next
      if (changed || !next) {
        generation.current++; apply(empty()); setSel('all'); setRead([]); setError('')
      }
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (!next) { setLoading(false); setRecovery(false); return }
      if (changed || event === 'INITIAL_SESSION') setLoading(true)
      // Supabase callbacks stay synchronous; requests run after the auth lock is released.
      window.setTimeout(() => {
        if (!live || activeUser.current !== next) return
        void refresh().catch(e => { if (live) setError((e as Error).message) }).finally(() => { if (live) setLoading(false) })
      }, 0)
    })
    const sync = () => {
      if (activeUser.current && document.visibilityState === 'visible')
        void refresh().catch(e => setError((e as Error).message))
    }
    const timer = window.setInterval(sync, 30000)
    window.addEventListener('focus', sync)
    return () => { live = false; generation.current++; subscription.unsubscribe(); clearInterval(timer); window.removeEventListener('focus', sync) }
  }, [apply, refresh])

  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error: err } = await cloudClient().rpc(name, args)
    if (err) throw new Error(err.message)
    return data
  }
  const reloadAfterSave = async () => {
    try { await refresh() } catch {
      setError('Changes were saved, but the latest records could not be loaded. Refresh to continue.')
    }
  }
  const commit = (operations: Mutation[]) => {
    if (!operations.length) return Promise.resolve()
    const userAtStart = activeUser.current
    const requestId = crypto.randomUUID()
    // Capture versions before queuing so stale forms cannot overwrite refreshed records.
    const prepared = operations.map(op => {
      const { _version, ...body } = op.data ?? {}
      return { ...op, id: op.id ?? crypto.randomUUID(), data: body,
        version: _version ?? latest.current.data[op.module]?.find(r => r.id === op.id)?._version }
    })
    const result = queue.current.then(async () => {
      if (!userAtStart || userAtStart !== activeUser.current) throw new Error('Session changed. Sign in again.')
      await rpc('erp_mutate', { operations: prepared, request_id: requestId })
      await reloadAfterSave()
    })
    queue.current = result.catch(() => undefined)
    return result
  }
  const manage = async (body: Record<string, unknown>) => {
    const { data, error: err } = await cloudClient().functions.invoke('manage-users', { body })
    if (err) {
      const detail = 'context' in err && err.context instanceof Response ? await err.context.json().catch(() => null) : null
      throw new Error(detail?.error ?? err.message)
    }
    if (data?.error) throw new Error(data.error)
    await reloadAfterSave()
  }
  const profileAccess = async (id: number, patch: Record<string, unknown>) => {
    await rpc('erp_admin_profile', { target_id: id, patch }); await reloadAfterSave()
  }
  const me = state.users.find(u => u.id === state.meId) ?? null
  const value: Store = {
    ...state, me, backend: 'supabase', proj: me && ['client','foreman','site_supervisor'].includes(me.role) ? me.project ?? '' : sel,
    setProj: setSel, read, markRead: ids => setRead(v => [...new Set([...v, ...ids])].slice(-300)),
    addLog: () => { /* Audit entries are written by database triggers, never by the browser. */ },
    login: async (email, password, remember) => {
      localStorage.setItem('tk_cloud_remember', remember ? 'yes' : 'no')
      const { data, error: err } = await cloudClient().auth.signInWithPassword({ email: email.trim(), password })
      if (err) throw new Error(err.message)
      activeUser.current = data.user.id
      try { await refresh(); setLoading(false) } catch (e) { await cloudClient().auth.signOut(); throw e }
      return true
    },
    verify: () => false,
    logout: async () => {
      const { error: err } = await cloudClient().auth.signOut({ scope: 'local' })
      if (err) { toast.error(err.message); return }
      activeUser.current = null; generation.current++; apply(empty()); setRecovery(false)
    },
    requestReset: async email => {
      const { error: err } = await cloudClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin })
      if (err) throw new Error(err.message)
    },
    changePassword: async (oldPw, password) => {
      if (!me) return 'Not signed in.'
      if (password.length < 12) return 'Use at least 12 characters.'
      const { error: verifyError } = await cloudClient().auth.signInWithPassword({ email: me.email, password: oldPw })
      if (verifyError) return 'Current password is incorrect.'
      const { error: err } = await cloudClient().auth.updateUser({ password })
      return err?.message ?? null
    },
    updateName: async name => { await rpc('erp_update_profile', { patch: { name } }); await reloadAfterSave() },
    setAvatar: async avatar => { await rpc('erp_update_profile', { patch: { avatar } }); await reloadAfterSave() },
    setSettings: async patch => { await rpc('erp_update_settings', { patch }); await reloadAfterSave() },
    addUser: user => manage({ action: 'create', user }),
    setPassword: (id, password) => manage({ action: 'password', id, password }),
    setRole: (id, role) => profileAccess(id, { role }),
    setUserProject: (id, project) => profileAccess(id, { project }),
    setFinanceView: (id, finance_view_project) => profileAccess(id, { finance_view_project }),
    removeUser: id => profileAccess(id, { disabled: true }),
    batch: commit,
    add: async (module, data, quiet) => {
      const id = crypto.randomUUID()
      await commit([{ action: 'insert', module, id, data }])
      if (!quiet) toast.success('Record added')
      return id
    },
    update: async (module, id, data, quiet) => {
      await commit([{ action: 'update', module, id, data }])
      if (!quiet) toast.success('Changes saved')
    },
    remove: async (module, id, quiet) => {
      await commit([{ action: 'delete', module, id }])
      if (!quiet) toast.success('Record deleted')
    },
    decideApproval: async (a, status) => {
      await commit([{ action: 'decide', module: 'approvals', id: a.id, data: { status, _version: a._version } }])
      toast.success(status)
    },
    payInvoice: (invoice: Rec) => commit([{ action: 'pay_invoice', module: 'billing', id: invoice.id, data: { _version: invoice._version } }]),
  }
  if (recovery) return <div className="lgn-side"><form className="card lgn-card" onSubmit={async e => {
    e.preventDefault(); if (recoveryBusy) return
    if (recoveryPw.length < 12 || recoveryPw !== recoveryConfirm) { toast.error('Use at least 12 characters and match both passwords.'); return }
    setRecoveryBusy(true)
    try {
      const { error: err } = await cloudClient().auth.updateUser({ password: recoveryPw })
      if (err) throw err
      await value.logout(); setRecovery(false); setRecoveryPw(''); setRecoveryConfirm(''); location.hash = ''; toast.success('Password updated. Sign in with your new password.')
    } catch (e) { toast.error((e as Error).message) } finally { setRecoveryBusy(false) }
  }}><h1>Set a new password</h1><label>New password<input type="password" autoComplete="new-password" value={recoveryPw} onChange={e => setRecoveryPw(e.target.value)} /></label><label>Confirm password<input type="password" autoComplete="new-password" value={recoveryConfirm} onChange={e => setRecoveryConfirm(e.target.value)} /></label><Btn busy={recoveryBusy}>Update password</Btn></form></div>
  if (loading) return <div className="body"><main><PageSkeleton /></main></div>
  if (error) return <div className="body"><main><ErrorState title="Workspace unavailable" message={error} onRetry={() => {
    setLoading(true); void refresh().catch(e => setError((e as Error).message)).finally(() => setLoading(false))
  }} />{!backendConfig.error && <button onClick={() => void value.logout()}>Sign out</button>}</main></div>
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
