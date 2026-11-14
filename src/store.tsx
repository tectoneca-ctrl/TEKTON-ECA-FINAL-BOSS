import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { MODULES, AUTO_APPROVAL } from './modules'
import { useToast } from './ux'
import type { Role } from './roles'

export interface User { id: number; name: string; email: string; role: Role; password: string; project?: string; avatar?: string; financeViewProject?: string }
export type Rec = Record<string, string> & { id: string }
export interface Log { at: string; by: string; msg: string }
export interface Settings { company: string; vat: number; markup: number; retention: number }

export const DEMO_USERS: User[] = [
  { id: 1, name: 'Dana Admin', email: 'admin@tekton.ph', role: 'admin', password: 'Admin@2026' },
  { id: 2, name: 'Aira Mendoza', email: 'assistant@tekton.ph', role: 'assistant_manager', password: 'Assist@2026' },
  { id: 3, name: 'Ramon Villanueva', email: 'supervisor@tekton.ph', role: 'site_supervisor', password: 'Site@2026', project: 'P-001' },
  { id: 4, name: 'Mark Santos', email: 'foreman@tekton.ph', role: 'foreman', password: 'Foreman@2026', project: 'P-001' },
  { id: 5, name: 'Carlo Dela Cruz', email: 'client@tekton.ph', role: 'client', password: 'Client@2026', project: 'P-001' },
  { id: 6, name: 'Ana Reyes', email: 'documents@tekton.ph', role: 'documents', password: 'Docs@2026' },
  { id: 7, name: 'Jose Lim', email: 'budget@tekton.ph', role: 'budget', password: 'Budget@2026' },
  { id: 8, name: 'Ben Ramos', email: 'asset@tekton.ph', role: 'asset', password: 'Asset@2026' },
  { id: 9, name: 'Maria Santos', email: 'hr@tekton.ph', role: 'hr', password: 'People@2026' },
  { id: 10, name: 'Liza Cruz', email: 'finance@tekton.ph', role: 'finance', password: 'Finance@2026' },
]
const SEED_DATA: Record<string, Rec[]> = Object.fromEntries(
  Object.values(MODULES).map(m => [m.key, m.seed.map((s, i) => ({ ...s, id: `${m.key}-${i}` }))]))

export const projectCodes = (rows: Rec[]) => rows.map(p => ({ code: p.code, name: p.name, site: p.site }))
export const nextProjectCode = (rows: Rec[]) => `P-${String(Math.max(0, ...rows.map(r => parseInt((r.code ?? '').replace(/\D/g, ''), 10) || 0)) + 1).padStart(3, '0')}`

export const SCOPED: Role[] = ['client', 'foreman', 'site_supervisor']

function usePersisted<T>(key: string, init: T) {
  const [v, s] = useState<T>(() => {
    try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : init } catch { return init }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* storage unavailable */ } }, [key, v])
  return [v, s] as const
}

interface Store {
  me: User | null; users: User[]; data: Record<string, Rec[]>; log: Log[]; settings: Settings
  login: (email: string, password: string, remember: boolean) => boolean; logout: () => void
  setPassword: (id: number, pw: string) => void
  setAvatar: (url: string) => void
  verify: (email: string, password: string) => boolean; requestReset: (email: string) => void
  read: string[]; markRead: (ids: string[]) => void; updateName: (name: string) => void; changePassword: (oldPw: string, newPw: string) => string | null
  proj: string; setProj: (p: string) => void; addLog: (m: string) => void; setUserProject: (id: number, code: string) => void
  addUser: (u: Omit<User, 'id'>) => void; setRole: (id: number, r: Role) => void; setFinanceView: (id: number, scope: string) => void; removeUser: (id: number) => void
  add: (k: string, r: Record<string, string>, quiet?: boolean) => string
  decideApproval: (a: Rec, status: 'Approved' | 'Rejected') => void
  update: (k: string, id: string, patch: Record<string, string>, quiet?: boolean) => void
  remove: (k: string, id: string, quiet?: boolean) => void
  setSettings: (s: Settings) => void
}
const Ctx = createContext<Store>(null as unknown as Store)
export const useStore = () => useContext(Ctx)

export function StoreProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [users, setUsers] = usePersisted<User[]>('tk_users_v3', DEMO_USERS)
  const [data, setData] = usePersisted<Record<string, Rec[]>>('tk_data_v6', SEED_DATA)
  const [log, setLog] = usePersisted<Log[]>('tk_log', [])
  const [settings, setSettings] = usePersisted<Settings>('tk_settings', { company: 'Tekton ECA Construction', vat: 12, markup: 15, retention: 10 })
  const readMe = () => { try { const v = localStorage.getItem('tk_me_v2') ?? sessionStorage.getItem('tk_me_v2'); return v ? Number(v) : null } catch { return null } }
  const [meId, setMeId] = useState<number | null>(readMe)
  const clearMe = () => { try { localStorage.removeItem('tk_me_v2'); sessionStorage.removeItem('tk_me_v2') } catch { /* ignore */ } }
  const me = users.find(u => u.id === meId) ?? null
  const [sel, setSel] = usePersisted<string>('tk_proj', 'all')
  const [readMap, setReadMap] = usePersisted<Record<string, string[]>>('tk_read', {})
  const proj = me && SCOPED.includes(me.role) && me.project ? me.project : sel
  const note = (msg: string) => setLog(l => [{ at: new Date().toLocaleString(), by: me?.name ?? 'system', msg }, ...l].slice(0, 200))
  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  const value: Store = {
    read: me ? readMap[me.id] ?? [] : [],
    markRead: ids => { if (me) setReadMap(m => ({ ...m, [me.id]: [...new Set([...(m[me.id] ?? []), ...ids])].slice(-300) })) },
    setAvatar: url => { if (me) { setUsers(x => x.map(u => (u.id === me.id ? { ...u, avatar: url || undefined } : u))); note(url ? 'Updated profile photo' : 'Removed profile photo') } },
    updateName: name => { if (me) { setUsers(x => x.map(u => (u.id === me.id ? { ...u, name } : u))); note('Updated profile name') } },
    changePassword: (o, nw) => {
      if (!me) return 'Not signed in.'
      if (me.password !== o) return 'Current password is incorrect.'
      if (nw.length < 6) return 'New password must be at least 6 characters.'
      setUsers(x => x.map(u => (u.id === me.id ? { ...u, password: nw } : u))); note('Changed own password'); return null
    },
    me, users, data, log, settings, setSettings, proj, setProj: setSel, addLog: note,
    setUserProject: (id, code) => setUsers(x => x.map(u => (u.id === id ? { ...u, project: code } : u))),
    verify: (email, password) => users.some(x => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password),
    requestReset: email => {
      const u = users.find(x => x.email.toLowerCase() === email.trim().toLowerCase())
      if (!u) return
      setData(d => ({ ...d, approvals: [{ id: uid(), request: `Password reset: ${u.email}`, by: u.name, type: 'Password reset', status: 'Pending', module: '', refId: '' } as Rec, ...(d.approvals ?? [])] }))
      setLog(l => [{ at: new Date().toLocaleString(), by: u.name, msg: 'Requested a password reset' }, ...l].slice(0, 200))
    },
    login: (email, password, remember) => {
      const u = users.find(x => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password)
      if (!u) return false
      clearMe()
      try { (remember ? localStorage : sessionStorage).setItem('tk_me_v2', String(u.id)) } catch { /* ignore */ }
      setMeId(u.id)
      setLog(l => [{ at: new Date().toLocaleString(), by: u.name, msg: 'Signed in' }, ...l].slice(0, 200))
      toast.success(`Welcome back, ${u.name.split(' ')[0]}`)
      return true
    },
    logout: () => { clearMe(); setMeId(null); toast.info('Signed out') },
    setPassword: (id, pw) => { setUsers(x => x.map(u => (u.id === id ? { ...u, password: pw } : u))); note(`Reset password of user #${id}`) },
    addUser: u => { setUsers(x => [...x, { ...u, id: Date.now() }]); note(`Created user ${u.name} as ${u.role}`) },
    setRole: (id, r) => { setUsers(x => x.map(u => (u.id === id ? { ...u, role: r, financeViewProject: r === 'documents' ? u.financeViewProject : undefined } : u))); note(`Changed role of user #${id} to ${r}`) },
    setFinanceView: (id, scope) => {
      if (me?.role !== 'admin') return
      const target = users.find(u => u.id === id)
      const valid = !scope || scope === 'all' || (data.projects ?? []).some(p => p.code === scope)
      if (!target || target.role !== 'documents' || !valid) return
      setUsers(x => x.map(u => (u.id === id ? { ...u, financeViewProject: scope || undefined } : u)))
      note(scope ? `Granted read-only Finance summary to ${target.name} (${scope})` : `Revoked read-only Finance summary from ${target.name}`)
    },
    removeUser: id => { setUsers(x => x.filter(u => u.id !== id)); note(`Removed user #${id}`) },
    add: (k, r, quiet) => {
      const id = uid()
      const auto = AUTO_APPROVAL[k]
      setData(d => {
        const next: Record<string, Rec[]> = { ...d, [k]: [{ ...r, id }, ...(d[k] ?? [])] }
        if (auto && r.status === 'Pending') next.approvals = [{ id: uid(), request: auto.label(r), by: me?.name ?? '', type: auto.type, status: 'Pending', module: k, refId: id } as Rec, ...(d.approvals ?? [])]
        if (k === 'projects' && r.type) next.checklist = [...(d.templates ?? []).filter(t => t.type === r.type).map(t => ({ id: uid(), project: r.code, section: t.section, label: t.label, key: t.key, status: 'Pending', date: '', remarks: '', out: t.out, outKey: t.outKey, outStatus: 'Pending', outDate: '', order: t.order }) as Rec), ...(d.checklist ?? [])]
        return next
      })
      if (!quiet) { note(`Added record in ${MODULES[k].title}`); toast.success(auto && r.status === 'Pending' ? 'Record added · sent for approval' : 'Record added') }
      return id
    },
    decideApproval: (a, status) => {
      setData(d => {
        const next: Record<string, Rec[]> = { ...d, approvals: (d.approvals ?? []).map(x => (x.id === a.id ? { ...x, status } : x)) }
        if (a.module && a.refId && next[a.module]) next[a.module] = next[a.module].map(x => (x.id === a.refId ? { ...x, status } : x))
        return next
      })
      note(`${status}: ${a.request}`)
      toast.success(`${status}: ${a.request}`)
    },
    update: (k, id, p, quiet) => { setData(d => ({ ...d, [k]: (d[k] ?? []).map(r => (r.id === id ? { ...r, ...p } : r)) })); if (!quiet) toast.success('Changes saved') },
    remove: (k, id, quiet) => { setData(d => { const gone = (d[k] ?? []).find(r => r.id === id); const next: Record<string, Rec[]> = { ...d, [k]: (d[k] ?? []).filter(r => r.id !== id) }; if (k === 'projects' && gone) next.checklist = (d.checklist ?? []).filter(c => c.project !== gone.code); return next }); note(`Deleted record in ${MODULES[k].title}`); if (!quiet) toast.success('Record deleted') },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
