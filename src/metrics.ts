import type { Rec, User } from './store'
import type { Role, Tone } from './roles'
import { NAV } from './modules'

export type D = Record<string, Rec[]>
export const n = (s?: string) => Number(s) || 0
export const short = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? '-' : ''
  return a >= 1e6 ? `${s}₱${(a / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : a >= 1e3 ? `${s}₱${Math.round(a / 1e3)}K` : `${s}₱${a}`
}
export const sc = (rows: Rec[] | undefined, proj: string) => (rows ?? []).filter(r => proj === 'all' || r.project === proj)
export const sum = (rows: Rec[], f = 'amount') => rows.reduce((a, r) => a + n(r[f]), 0)
/** Local calendar date (YYYY-MM-DD). toISOString() would give the UTC date, which is yesterday in the Philippines before 8 AM. */
export const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
export const REQ_DOCS = ['Permit', 'Contract', 'Plan', 'Certificate']

/** Budget lines with ACTUAL derived from expenses (+ approved/received purchases as Materials), so budget and project spend always agree. */
export function budgetLines(d: D, proj: string): Rec[] {
  return sc(d.budgets, proj).map(b => {
    const exp = sum((d.expenses ?? []).filter(e => e.project === b.project && e.category === b.category))
    const pur = b.category === 'Materials' ? sum((d.purchases ?? []).filter(p => p.project === b.project && !['Pending', 'Rejected'].includes(p.status))) : 0
    const actual = exp + pur, budget = n(b.budget)
    return { ...b, actual: String(actual), status: actual > budget ? 'Over' : budget && actual / budget >= 0.9 ? 'Warning' : 'Within' } as Rec
  })
}
/** Number of records pointing at a project (used to block deleting a project that is still in use). */
export const countRefs = (d: D, code: string) => Object.entries(d).reduce((a, [k, rows]) => a + (k === 'projects' || k === 'checklist' ? 0 : rows.filter(r => r.project === code).length), 0)

export interface PM {
  code: string; name: string; site: string; client: string; status: string
  budget: number; spent: number; used: number; billed: number; collected: number; balance: number; overdue: number
  progress: number; todo: number; ongoing: number; done: number; incidents: number; deliveries: number
  crew: number; ot: number; docsOk: number; assets: number; pending: number
}

/** Every number on every dashboard is derived from the module records, keyed by project code (P-001...). */
export function projectMetrics(d: D): PM[] {
  const by = (k: string, code: string) => (d[k] ?? []).filter(r => r.project === code)
  return (d.projects ?? []).map((p, i) => {
    const code = p.code
    const exp = by('expenses', code), pur = by('purchases', code), bil = by('billing', code), pay = by('payments', code)
    const prog = by('progress', code), tk = by('tasks', code), att = by('attendance', code), doc = by('documents', code)
    const spent = sum(exp) + sum(pur.filter(r => !['Pending', 'Rejected'].includes(r.status)))
    const billed = sum(bil.filter(r => r.status !== 'Draft')), collected = sum(pay), budget = n(p.budget)
    const last = att.reduce((m, r) => (r.date > m ? r.date : m), '')
    const day = att.filter(r => r.date === last && n(r.days) > 0)
    return {
      code, name: p.name, site: p.site, client: p.client, status: p.status,
      budget, spent, used: budget ? Math.round((spent / budget) * 100) : 0, billed, collected,
      balance: Math.max(0, billed - collected), overdue: bil.filter(r => r.status === 'Overdue').length,
      progress: prog.length ? Math.round(sum(prog, 'percent') / prog.length) : 0,
      todo: tk.filter(r => r.status === 'Todo').length, ongoing: tk.filter(r => r.status === 'Ongoing').length, done: tk.filter(r => r.status === 'Done').length,
      incidents: by('incidents', code).filter(r => r.status === 'Open').length,
      deliveries: by('deliveries', code).filter(r => r.status !== 'Received').length,
      crew: day.length, ot: sum(day, 'ot'),
      docsOk: REQ_DOCS.filter(t => doc.some(x => x.type === t && x.status === 'Approved')).length,
      assets: (d.assets ?? []).filter(a => a.site === p.site).length,
      pending: pur.filter(r => r.status === 'Pending').length,
    }
  })
}

export function liveKpis(role: Role, d: D, users: User[], proj: string, pms: PM[]): [string, string, string, Tone][] {
  const sel = proj === 'all' ? pms : pms.filter(p => p.code === proj)
  const S = (k: string) => sc(d[k], proj)
  const ct = (rows: Rec[], f: (r: Rec) => boolean) => rows.filter(f).length
  const T = (c: number, t: Tone): Tone => (c > 0 ? t : '')
  const pendA = ct(d.approvals ?? [], r => r.status === 'Pending')
  const inc = ct(S('incidents'), r => r.status === 'Open')
  const avg = sel.length ? Math.round(sel.reduce((a, p) => a + p.progress, 0) / sel.length) : 0
  const coll = sum(S('payments')), bil = S('billing')
  const unpaid = sum(bil.filter(r => r.status === 'Sent' || r.status === 'Overdue'))
  const od = ct(bil, r => r.status === 'Overdue')
  const dl = sel.filter(p => p.status === 'Delayed').length
  const open = sel.reduce((a, p) => a + p.todo + p.ongoing, 0)
  const crew = sel.reduce((a, p) => a + p.crew, 0)
  const emp = d.employees ?? [], as = d.assets ?? [], bud = budgetLines(d, proj)
  const exp = sum(S('expenses'))
  const dlv = sel.reduce((a, p) => a + p.deliveries, 0)
  switch (role) {
    case 'admin': return [['Active projects', String(sel.filter(p => p.status === 'Ongoing').length), dl ? `${dl} delayed` : '', T(dl, 'a')], ['Pending approvals', String(pendA), pendA ? 'needs action' : '', T(pendA, 'a')], ['Users', String(users.length), '', ''], ['Open incidents', String(inc), '', T(inc, 'a')], ['Collected', short(coll), '', '']]
    case 'assistant_manager': return [['On track', String(sel.filter(p => p.status === 'Ongoing').length), '', ''], ['Delayed', String(dl), '', T(dl, 'a')], ['Open tasks', String(open), '', ''], ['Pending approvals', String(pendA), '', T(pendA, 'a')], ['Open incidents', String(inc), '', T(inc, 'a')]]
    case 'site_supervisor': return [['Workers on site', String(crew), '', ''], ['Open tasks', String(open), '', ''], ['Deliveries pending', String(dlv), '', T(dlv, 'a')], ['Open incidents', String(inc), '', T(inc, 'a')], ['Progress', `${avg}%`, '', '']]
    case 'client': return [['Overall progress', `${avg}%`, '', 'g'], ['Contract value', short(sel.reduce((a, p) => a + p.budget, 0)), '', ''], ['Paid so far', short(coll), '', 'g'], ['Balance', short(sel.reduce((a, p) => a + p.balance, 0)), od ? `${od} overdue` : '', T(od, 'a')], ['Open billings', String(ct(bil, r => r.status === 'Sent' || r.status === 'Overdue')), '', '']]
    case 'budget': return [['Total budget', short(sum(bud, 'budget')), '', ''], ['Spent', short(sum(bud, 'actual')), '', ''], ['Over budget', String(ct(bud, r => r.status === 'Over')), 'lines', T(ct(bud, r => r.status === 'Over'), 'r')], ['Budget approvals', String(ct(d.approvals ?? [], r => r.type === 'Budget' && r.status === 'Pending')), '', ''], ['Remaining', short(sum(bud, 'budget') - sum(bud, 'actual')), '', 'g']]
    case 'asset': return [['Total assets', String(as.length), '', ''], ['Deployed', String(ct(as, r => r.status === 'Deployed')), '', ''], ['Under repair', String(ct(as, r => r.condition === 'Repair')), '', T(ct(as, r => r.condition === 'Repair'), 'a')], ['In maintenance', String(ct(as, r => r.status === 'Maintenance')), '', ''], ['Pending transfers', String(ct(d.transfers ?? [], r => r.status === 'Pending')), '', '']]
    case 'hr': return [['Employees', String(emp.length), '', ''], ['Active', String(ct(emp, r => r.status === 'Active')), '', ''], ['Leave requests', String(ct(d.leaves ?? [], r => r.status === 'Pending')), '', T(ct(d.leaves ?? [], r => r.status === 'Pending'), 'a')], ['Payroll in draft', String(ct(d.payroll ?? [], r => r.status === 'Draft')), '', ''], ['Crew today', String(crew), '', '']]
    case 'finance': return [['Collected', short(coll), '', 'g'], ['Receivables', short(unpaid), od ? `${od} overdue` : '', T(od, 'a')], ['Expenses', short(exp), '', ''], ['Net cash', short(coll - exp), '', coll - exp >= 0 ? 'g' : 'r'], ['Pending purchases', String(ct(S('purchases'), r => r.status === 'Pending')), '', '']]
    default: return []
  }
}

export interface Note { id: string; title: string; sub: string; tone: Tone; href: string }
/** Notifications are derived from live records, so resolving the item (approve, close, pay...) removes it. */
export function notifications(role: Role, d: D, proj: string, pms: PM[]): Note[] {
  const out: Note[] = []
  const has = (...r: Role[]) => r.includes(role)
  const S = (k: string) => sc(d[k], proj)
  const go = (page: string, code: string) => (NAV[role].includes(page) ? `#${page}` : `#project/${code}`)
  const dayIn = (s: string) => Math.ceil((new Date(s).getTime() - Date.now()) / 864e5)
  if (has('admin', 'assistant_manager', 'budget')) (d.approvals ?? []).filter(a => a.status === 'Pending' && (role !== 'budget' || a.type === 'Budget')).forEach(a => out.push({ id: `ap:${a.id}`, title: a.request, sub: `${a.type} approval · ${a.by}`, tone: 'a', href: '#approvals' }))
  if (has('admin', 'finance', 'client')) S('billing').filter(b => b.status === 'Overdue').forEach(b => out.push({ id: `bl:${b.id}`, title: `${b.invoice} is overdue`, sub: `${b.project} · ${short(n(b.amount))}`, tone: 'r', href: go('billing', b.project) }))
  if (has('admin', 'assistant_manager', 'site_supervisor')) S('incidents').filter(i => i.status === 'Open').forEach(i => out.push({ id: `in:${i.id}`, title: i.report, sub: `${i.project} · ${i.severity} severity`, tone: i.severity === 'High' ? 'r' : 'a', href: go('incidents', i.project) }))
  if (has('admin', 'assistant_manager')) pms.filter(m => m.status === 'Delayed').forEach(m => out.push({ id: `dp:${m.code}`, title: `${m.name} is delayed`, sub: `${m.code} · ${m.progress}% complete`, tone: 'r', href: `#project/${m.code}` }))
  if (has('admin', 'documents')) [...(d.documents ?? []).filter(x => x.expires).map(x => ({ id: x.id, t: x.title, e: x.expires })), ...(d.permits ?? []).filter(x => x.expires).map(x => ({ id: x.id, t: x.permit, e: x.expires }))]
    .forEach(x => { const k = dayIn(x.e); if (k >= 0 && k <= 30) out.push({ id: `ex:${x.id}`, title: `${x.t} expires in ${k} day${k === 1 ? '' : 's'}`, sub: 'Renew before it lapses', tone: k < 14 ? 'r' : 'a', href: '#documents' }) })
  if (has('documents')) (d.documents ?? []).filter(x => x.status === 'Review').forEach(x => out.push({ id: `rv:${x.id}`, title: `${x.title} awaiting review`, sub: `${x.project} · ${x.type}`, tone: 'a', href: '#documents' }))
  if (has('site_supervisor')) S('deliveries').filter(x => x.status === 'Delayed').forEach(x => out.push({ id: `dl:${x.id}`, title: `${x.item} delivery delayed`, sub: `${x.supplier} · ${x.project}`, tone: 'r', href: go('deliveries', x.project) }))
  if (has('foreman', 'finance')) S('purchases').filter(x => x.status === 'Pending').forEach(x => out.push({ id: `pu:${x.id}`, title: `Purchase pending: ${x.item}`, sub: `${x.supplier} · ${short(n(x.amount))}`, tone: 'a', href: go('purchases', x.project) }))
  if (has('foreman')) (d.cashadvance ?? []).filter(x => x.status === 'Pending').forEach(x => out.push({ id: `ca:${x.id}`, title: `Cash advance request: ${x.worker}`, sub: short(n(x.amount)), tone: 'a', href: '#cashadvance' }))
  if (has('hr')) {
    (d.leaves ?? []).filter(x => x.status === 'Pending').forEach(x => out.push({ id: `lv:${x.id}`, title: `Leave request: ${x.employee}`, sub: `${x.type} · ${x.from}`, tone: 'a', href: '#leaves' }))
    const dr = (d.payroll ?? []).filter(x => x.status === 'Draft').length
    if (dr) out.push({ id: 'pay:draft', title: `${dr} payroll record${dr > 1 ? 's' : ''} in draft`, sub: 'Review and approve', tone: 'a', href: '#payroll' })
  }
  if (has('asset')) {
    (d.assets ?? []).filter(x => x.status === 'Maintenance' || x.condition === 'Repair').forEach(x => out.push({ id: `as:${x.id}`, title: `${x.asset} ${x.code} needs maintenance`, sub: x.site, tone: 'a', href: '#assets' }))
    ;(d.transfers ?? []).filter(x => x.status === 'Pending').forEach(x => out.push({ id: `tr:${x.id}`, title: `Transfer pending: ${x.asset}`, sub: `${x.from} → ${x.to}`, tone: '', href: '#transfers' }))
  }
  if (has('hr', 'site_supervisor')) {
    const g: Record<string, number> = {}
    S('attendance').filter(a => a.status === 'Pending').forEach(a => { const k = `${a.project} ${a.date}`; g[k] = (g[k] ?? 0) + 1 })
    Object.entries(g).forEach(([k, c]) => out.push({ id: `at:${k}`, title: `Attendance awaiting approval: ${k}`, sub: `${c} record${c > 1 ? 's' : ''}`, tone: 'a', href: '#attendance' }))
  }
  return out.slice(0, 25)
}
