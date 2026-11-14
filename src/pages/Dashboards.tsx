import { useState, FC, ReactNode } from 'react'
import { ROLES, ROLE_KEYS, Role, Tone } from '../roles'
import { useStore, projectCodes, Rec } from '../store'
import { Avatar, tone } from '../ui'
import { projectMetrics, liveKpis, budgetLines, localDate, n, short, sc, sum, PM } from '../metrics'
import { Btn, useAction, useToast } from '../ux'
import { TypeCards } from './SiteDocs'
import { Card, Strip, Trend, Pipeline, AI, HBars, Prog, Donut, StackBar, Heat, Steps, Feed, Btns, CashChart, peso, Range } from './widgets'

export interface P { role: Role; range: Range; seed: number; name: string }
const chip = (t: string, c = tone(t)) => <span className={`chip ${c}`}>{t}</span>
const days = (k: number) => Array.from({ length: k }, (_, i) => String(i + 1))
const today = localDate
const TEAL = '#35e0b5', BLUE = '#7aa2ff', AMBER = '#f5c542', VIOLET = '#c79bff', RED = '#ff7b8a'

function useCtx() {
  const s = useStore()
  const pms = projectMetrics(s.data)
  return { ...s, pms, p: (k: string) => sc(s.data[k], s.proj), kpis: (role: Role) => liveKpis(role, s.data, s.users, s.proj, pms) }
}

/* ---------- project summary: one component, role-specific columns, live from records ---------- */
const pg = (m: PM) => <><Prog v={m.progress} /> {m.progress}%</>
const ub = (m: PM) => <><Prog v={m.used} bad={m.used > 100} /> {m.used}%</>
const COLS: Record<Role, [string, (m: PM) => ReactNode][]> = {
  admin: [['Progress', pg], ['Budget used', ub], ['Collected', m => short(m.collected)], ['Status', m => chip(m.status)]],
  assistant_manager: [['Progress', pg], ['Tasks done', m => `${m.done}/${m.todo + m.ongoing + m.done}`], ['Open incidents', m => m.incidents], ['Status', m => chip(m.status)]],
  site_supervisor: [['Open tasks', m => m.todo + m.ongoing], ['Crew today', m => m.crew], ['Deliveries pending', m => m.deliveries], ['Open incidents', m => m.incidents]],
  foreman: [['Crew today', m => m.crew], ['OT hours', m => m.ot], ['Purchases pending', m => m.pending], ['Progress', pg]],
  client: [['Progress', pg], ['Billed', m => short(m.billed)], ['Paid', m => short(m.collected)], ['Balance', m => short(m.balance)]],
  documents: [['Compliance', m => `${m.docsOk}/4 required`], ['Status', m => chip(m.status)]],
  budget: [['Budget', m => short(m.budget)], ['Spent', m => short(m.spent)], ['Used', ub], ['Status', m => chip(m.status)]],
  asset: [['Equipment on site', m => m.assets], ['Open incidents', m => m.incidents], ['Status', m => chip(m.status)]],
  hr: [['Crew today', m => m.crew], ['OT hours', m => m.ot], ['Status', m => chip(m.status)]],
  finance: [['Billed', m => short(m.billed)], ['Collected', m => short(m.collected)], ['Balance', m => short(m.balance)], ['Overdue invoices', m => m.overdue]],
}
function ProjectSummary({ role }: { role: Role }) {
  const { pms, proj } = useCtx()
  const cols = COLS[role]
  const rows = proj === 'all' ? pms : pms.filter(m => m.code === proj)
  const one = proj !== 'all' ? rows[0] : null
  return (
    <Card t={one ? one.name : 'Project summary'} r={one ? <a className="muted" href={`#project/${one.code}`}>Open project →</a> : <span className="muted">{pms.length} projects</span>}>
      {one ? (
        <div className="facts"><div><span className="muted up">Site</span><b>{one.site}</b></div>{cols.map(([l, f]) => <div key={l}><span className="muted up">{l}</span><b>{f(one)}</b></div>)}</div>
      ) : (
        <div className="scroll"><table><thead><tr><th>Project</th>{cols.map(([l]) => <th key={l}>{l}</th>)}</tr></thead>
          <tbody>{rows.map(m => <tr key={m.code}><td><a className="plink" href={`#project/${m.code}`}>{m.name}</a><br /><span className="muted">{m.code} · {m.site}</span></td>{cols.map(([l, f]) => <td key={l}>{f(m)}</td>)}</tr>)}
            {!rows.length && <tr><td colSpan={cols.length + 1} className="muted">No projects yet.</td></tr>}</tbody></table></div>
      )}
    </Card>
  )
}

function PendingCard() {
  const c = useCtx()
  const pend = (c.data.approvals ?? []).filter(x => x.status === 'Pending')
  const decide = (x: Rec, s: 'Approved' | 'Rejected') => c.decideApproval(x, s)
  return (
    <Card t={`Pending approvals · ${pend.length}`} r={<a className="muted" href="#approvals">All →</a>}>
      <Feed items={pend.map(x => ({ a: x.by, t: x.request, s: `${x.type} · requested by ${x.by}`, r: <Btns a={() => decide(x, 'Approved')} b={() => decide(x, 'Rejected')} /> }))} />
    </Card>
  )
}

/* ---------- ADMIN ---------- */
function Admin({ role, range, seed }: P) {
  const c = useCtx()
  const counts = ROLE_KEYS.map(k => ({ l: ROLES[k].label, v: c.users.filter(u => u.role === k).length }))
  const mx = Math.max(1, ...counts.map(x => x.v))
  return (<>
    <Strip items={c.kpis(role)} />
    <ProjectSummary role={role} />
    <div className="g2">
      <Card t={ROLES[role].chartTitle} r={<span className="muted">sample trend</span>}><Trend role={role} range={range} seed={seed} /></Card>
      <Card t="Users by role" r={<a className="muted" href="#users">Manage →</a>}><HBars rows={counts.map(x => ({ ...x, max: mx }))} /></Card>
    </div>
    <div className="g3">
      <PendingCard />
      <Card t="Recent activity" r={<a className="muted" href="#audit">Audit log →</a>}><Feed items={c.log.slice(0, 6).map(l => ({ a: l.by, t: l.msg, s: l.at }))} /></Card>
      <AI role={role} />
    </div>
  </>)
}

/* ---------- ASSISTANT MANAGER ---------- */
function AsstMgr({ role }: P) {
  const c = useCtx()
  const inc = c.p('incidents').filter(i => i.status === 'Open')
  const st = [0, 1, 3, 6], ln = [10, 9, 8, 7]
  const rows = c.pms.filter(m => c.proj === 'all' || m.code === c.proj)
  return (<>
    <Strip items={c.kpis(role)} />
    <div className="g2"><ProjectSummary role={role} /><PendingCard /></div>
    <div className="g21">
      <Card t="Schedule timeline (weeks)"><div className="gantt">
        <div className="gh"><span />{Array.from({ length: 14 }, (_, i) => <span key={i} className="muted">W{i + 1}</span>)}</div>
        {rows.map((m, i) => <div className="gr" key={m.code}><span className="muted">{m.code}</span>
          <div className="gt"><i className={m.status === 'Delayed' ? 'red' : ''} style={{ left: `${(st[i % 4] / 14) * 100}%`, width: `${(ln[i % 4] / 14) * 100}%` }}><u style={{ width: `${m.progress}%` }} /></i></div></div>)}</div></Card>
      <Card t={`Open incidents · ${inc.length}`}><Feed items={inc.map(i => ({ a: i.project, t: i.report, s: `${i.project} · ${i.severity}`, r: <button className="ghost sm" onClick={() => c.update('incidents', i.id, { status: 'Closed' })}>Close</button> }))} /></Card>
    </div>
  </>)
}

/* ---------- shared: attendance verification (HR, Site Supervisor) ---------- */
function AttendanceVerify() {
  const c = useCtx()
  const { run: act, pending } = useAction()
  const pend = c.p('attendance').filter(a => a.status === 'Pending')
  const groups: Record<string, Rec[]> = {}
  pend.forEach(a => { const g = `${a.project}|${a.date}`; groups[g] = [...(groups[g] ?? []), a] })
  return (
    <Card t={`Attendance to verify · ${pend.length}`} r={<a className="muted" href="#attendance">Open →</a>}>
      <Feed items={Object.entries(groups).map(([g, rs]) => {
        const [pj, dt] = g.split('|')
        const here = rs.filter(r => n(r.days) > 0)
        return { a: pj, t: `${pj} · ${dt}`, s: `${here.length} present · ${rs.length - here.length} absent · ${rs.reduce((x, r) => x + n(r.ot), 0)}h OT`,
          r: <Btn className="sm" busy={pending} onClick={() => void act(() => { rs.forEach(r => c.update('attendance', r.id, { status: 'Approved' }, true)); c.addLog(`Approved attendance ${pj} ${dt}`) }, `Attendance approved · ${pj} ${dt}`)}>Approve all</Btn> }
      })} />
    </Card>
  )
}

/* ---------- SITE SUPERVISOR ---------- */
function SiteSup({ role }: P) {
  const c = useCtx()
  const tk = c.p('tasks')
  const next: Record<string, string> = { Todo: 'Ongoing', Ongoing: 'Done' }
  const att = c.p('attendance')
  const last = att.reduce((m, r) => (r.date > m ? r.date : m), '')
  const trade: Record<string, number> = {}
  att.filter(a => a.date === last && n(a.days) > 0).forEach(a => { const pos = (c.data.employees ?? []).find(e => e.name === a.worker)?.position ?? 'Other'; trade[pos] = (trade[pos] ?? 0) + 1 })
  const tmax = Math.max(1, ...Object.values(trade))
  const [chk, setChk] = useState([true, true, false, false, false])
  const items = ['Hard hats and vests worn', 'Scaffolding inspected', 'Fire extinguishers in place', 'First-aid kit stocked', 'Toolbox talk done']
  return (<>
    <Strip items={c.kpis(role)} />
    <ProjectSummary role={role} />
    <div className="g2">
      <Card t="Task board"><div className="kan">{['Todo', 'Ongoing', 'Done'].map(s => { const cs = tk.filter(t => t.status === s); return (
        <div key={s}><span className="muted up">{s} · {cs.length}</span>
          {cs.map(t => <div className="kc" key={t.id}><b>{t.task}</b><span className="muted">{t.crew} · {t.project}</span>
            {next[s] && <button className="ghost sm" onClick={() => c.update('tasks', t.id, { status: next[s] })}>→ {next[s]}</button>}</div>)}</div>) })}</div></Card>
      <Card t="Crew by trade (latest attendance)"><HBars rows={Object.entries(trade).map(([l, v]) => ({ l, v, max: tmax }))} />{!Object.keys(trade).length && <p className="muted">No attendance logged yet.</p>}</Card>
    </div>
    <div className="g3">
      <Card t="Deliveries" r={<a className="muted" href="#deliveries">Open →</a>}><Feed items={c.p('deliveries').map(d => ({ a: d.supplier, t: d.item, s: `${d.supplier} · ETA ${d.eta}`, r: d.status === 'Received' ? chip('Received', '') : <button className="ghost sm" onClick={() => c.update('deliveries', d.id, { status: 'Received' })}>Mark received</button> }))} /></Card>
      <Card t="Daily safety checklist" r={<span className="muted">{chk.filter(Boolean).length}/{items.length}</span>}>
        <div className="chks">{items.map((x, i) => <label key={x} className="chk"><input type="checkbox" checked={chk[i]} onChange={() => setChk(chk.map((v, j) => (j === i ? !v : v)))} />{x}</label>)}</div></Card>
      <AI role={role} />
    </div>
    <AttendanceVerify />
  </>)
}

/* ---------- FOREMAN: roster = workers assigned to this project (Employees), absent is recorded, saving goes to Attendance as Pending ---------- */
const TRADES = ['Mason', 'Carpenter', 'Laborer', 'Electrician', 'Plumber', 'Welder', 'Steelman']
interface Mark { p: boolean; ot: number }
function Foreman({ role }: P) {
  const c = useCtx()
  const code = c.proj === 'all' ? (c.pms[0]?.code ?? '') : c.proj
  const td = today()
  const roster = (c.data.employees ?? []).filter(e => e.status === 'Active' && TRADES.includes(e.position) && e.project === code)
  const att = (c.data.attendance ?? []).filter(a => a.project === code && a.date === td)
  const rec = (e: Rec) => att.find(a => a.worker === e.name)
  const [sheet, setSheet] = useState<Record<string, Mark>>({})
  const [saved, setSaved] = useState(false)
  const { run: act, pending } = useAction()
  const get = (e: Rec): Mark => { const r = rec(e); return sheet[e.id] ?? (r ? { p: n(r.days) > 0, ot: n(r.ot) } : { p: true, ot: 0 }) }
  const locked = (e: Rec) => rec(e)?.status === 'Approved'
  const set = (e: Rec, v: Partial<Mark>) => { setSaved(false); setSheet({ ...sheet, [e.id]: { ...get(e), ...v } }) }
  const pay = (e: Rec) => (get(e).p ? Math.round(n(e.rate) + get(e).ot * (n(e.rate) / 8) * 1.25) : 0)
  const present = roster.filter(e => get(e).p).length
  const save = () => {
    roster.filter(e => !locked(e)).forEach(e => {
      const g = get(e), ex = rec(e)
      const v = { days: g.p ? '1' : '0', ot: g.p ? String(g.ot) : '0', status: 'Pending' }
      if (ex) c.update('attendance', ex.id, v, true); else c.add('attendance', { worker: e.name, project: code, date: td, ...v }, true)
    })
    c.addLog(`Saved attendance for ${code} (${td}), awaiting approval`); setSaved(true)
  }
  const pur = c.p('purchases'), ca = (c.data.cashadvance ?? []).filter(x => roster.some(e => e.name === x.worker))
  const st = (e: Rec) => { const r = rec(e); return r ? chip(r.status, r.status === 'Approved' ? '' : 'warn') : chip('Not saved', 't') }
  return (<>
    <Strip items={[['Present today', `${present}/${roster.length}`, roster.length - present ? `${roster.length - present} absent` : '', roster.length - present ? 'a' : ''], ['OT hours', String(roster.reduce((a, e) => a + (get(e).p ? get(e).ot : 0), 0)), '', ''], ['Day payroll', peso(roster.reduce((a, e) => a + pay(e), 0)), '', ''], ['Purchases pending', String(pur.filter(x => x.status === 'Pending').length), '', ''], ['Cash advances pending', String(ca.filter(x => x.status === 'Pending').length), '', '']]} />
    <ProjectSummary role={role} />
    <Card t={`Attendance sheet · ${code} · ${td}`} r={<Btn busy={pending} onClick={() => void act(save, 'Attendance saved · sent for approval')} disabled={!roster.length}>{saved ? 'Saved ✓' : 'Save attendance'}</Btn>}>
      <div className="scroll"><table><thead><tr><th>Worker</th><th>Present</th><th>Overtime</th><th>Day pay</th><th>Record</th></tr></thead>
        <tbody>{roster.map(e => { const g = get(e), lk = locked(e); return (
          <tr key={e.id}><td><span className="clock"><Avatar name={e.name} />{e.name} <span className="muted">{e.position}</span></span></td>
            <td><input type="checkbox" checked={g.p} disabled={lk} onChange={() => set(e, { p: !g.p })} /></td>
            <td><span className="qty"><button className="ghost sm" disabled={lk || !g.p || g.ot <= 0} onClick={() => set(e, { ot: g.ot - 1 })}>−</button>{g.ot}h<button className="ghost sm" disabled={lk || !g.p} onClick={() => set(e, { ot: g.ot + 1 })}>+</button></span></td>
            <td>{peso(pay(e))}</td><td>{st(e)}</td></tr>) })}
          {!roster.length && <tr><td colSpan={5} className="muted">No tradespeople are assigned to {code || 'a project'} yet. Ask HR to set the project on each worker in Employees.</td></tr>}</tbody></table></div>
      <p className="muted hint">Saved sheets go to HR and the Site Supervisor as “Pending”. Approved records are locked.</p></Card>
    <div className="g21">
      <Card t="Purchase requests" r={<a className="muted" href="#purchases">Open →</a>}><Feed items={pur.slice(0, 4).map(x => ({ a: x.supplier, t: x.item, s: `${x.supplier} · ${peso(n(x.amount))}`, r: chip(x.status, x.status === 'Pending' ? 'warn' : x.status === 'Rejected' ? 'bad' : '') }))} /></Card>
      <Card t="Cash advances (my crew)" r={<a className="muted" href="#cashadvance">Open →</a>}><Feed items={ca.slice(0, 4).map(x => ({ a: x.worker, t: x.worker, s: peso(n(x.amount)), r: chip(x.status, x.status === 'Pending' ? 'warn' : x.status === 'Rejected' ? 'bad' : '') }))} /></Card>
    </div>
  </>)
}

/* ---------- CLIENT: only the assigned project ---------- */
function Client({ role }: P) {
  const c = useCtx()
  const code = c.proj === 'all' ? (c.pms[0]?.code ?? '') : c.proj
  const m = c.pms.find(x => x.code === code)
  const ms = (c.data.progress ?? []).filter(x => x.project === code)
  const bil = (c.data.billing ?? []).filter(x => x.project === code)
  const docs = (c.data.documents ?? []).filter(x => x.project === code)
  if (!m) return <Card t="No project assigned"><p className="muted">Ask your administrator to assign a project to your account.</p></Card>
  return (<>
    <Strip items={c.kpis(role)} />
    <div className="g2">
      <Card t={`${m.name} · progress`} r={chip(m.status)}><div className="row start"><Donut d={[['Done', m.progress, TEAL], ['Remaining', 100 - m.progress, '#16302f']]} center={`${m.progress}%`} />
        <div className="grow"><Feed items={ms.map(x => ({ a: x.milestone, t: x.milestone, s: x.date || 'Not started', r: chip(`${n(x.percent)}%`, n(x.percent) >= 100 ? '' : n(x.percent) > 0 ? 'warn' : 't') }))} /></div></div></Card>
      <Card t="Contract payments"><StackBar d={[['Paid', m.collected, TEAL], ['Due', m.balance, AMBER], ['Unbilled', Math.max(0, m.budget - m.billed), '#1e3a3d']]} fmt={peso} />
        <div className="scroll"><table><thead><tr><th>Invoice</th><th>Amount</th><th>Due</th><th>Status</th></tr></thead><tbody>
          {bil.map(b => <tr key={b.id}><td>{b.invoice}</td><td>{peso(n(b.amount))}</td><td className="muted">{b.due}</td><td>{chip(b.status, b.status === 'Paid' ? '' : tone(b.status))}</td></tr>)}</tbody></table></div></Card>
    </div>
    <div className="g21">
      <Card t="Site photos · this week"><div className="photos">{['Slab formwork', 'Rebar layout', 'Column casting', 'Block wall', 'Site overview', 'Delivery'].map((x, i) => <div key={x} style={{ background: `linear-gradient(135deg,hsl(${170 + i * 8} 35% ${16 + i * 2}%),#0b1214)` }}><span>{x}</span></div>)}</div></Card>
      <Card t="Your documents" r={<a className="muted" href="#documents">All →</a>}><Feed items={docs.slice(0, 4).map(d => ({ a: d.title, t: d.title, s: `${d.type}${d.expires ? ` · valid until ${d.expires}` : ''}`, r: chip(d.status) }))} /></Card>
    </div>
  </>)
}

/* ---------- DOCUMENTS: site-wide compliance monitoring (live from uploaded records) ---------- */
function Docs({ role }: P) {
  const { data, update, proj } = useStore()
  const docs = data.documents ?? [], permits = data.permits ?? []
  const sites = projectCodes(data.projects ?? []).filter(s => proj === 'all' || s.code === proj)
  const REQ = ['Permit', 'Contract', 'Plan', 'Certificate']
  const cell = (code: string, t: string) => {
    const ds = docs.filter(d => d.project === code && d.type === t)
    return ds.some(d => d.status === 'Approved') ? 'ok' : ds.some(d => d.status === 'Review') ? 'pend' : 'miss'
  }
  const grid = sites.map(s => ({ ...s, c: REQ.map(t => cell(s.code, t)) }))
  const all = grid.flatMap(g => g.c)
  const n = (k: string) => all.filter(x => x === k).length
  const pct = all.length ? Math.round((n('ok') / all.length) * 100) : 0
  const daysTo = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 864e5)
  const expAll = [
    ...docs.filter(d => d.expires).map(d => ({ t: d.title, s: d.project, d: daysTo(d.expires) })),
    ...permits.filter(p => p.expires).map(p => ({ t: p.permit, s: p.project, d: daysTo(p.expires) })),
  ].sort((a, b) => a.d - b.d)
  const soon = expAll.filter(e => e.d >= 0 && e.d <= 30).length
  const review = docs.filter(d => d.status === 'Review')
  const todayS = localDate()
  const kp: [string, string, string, Tone][] = [
    ['Documents', String(docs.length), `${docs.filter(d => d.fileId).length} with files`, ''],
    ['Pending review', String(review.length), review.length ? 'needs action' : '', review.length ? 'a' : ''],
    ['Expiring in 30 days', String(soon), soon ? 'renew soon' : '', soon ? 'a' : ''],
    ['Uploaded today', String(docs.filter(d => d.date === todayS).length), '', ''],
    ['Site compliance', `${pct}%`, `${n('miss')} missing`, n('miss') ? 'a' : 'g'],
  ]
  const cnt = (t: string) => docs.filter(d => d.type === t).length + (t === 'Permit' ? permits.length : 0)
  const lib: [string, number][] = [['Permits', cnt('Permit')], ['Contracts', cnt('Contract')], ['Plans', cnt('Plan')], ['Certificates', cnt('Certificate')], ['With files', docs.filter(d => d.fileId).length], ['Expired', docs.filter(d => d.status === 'Expired').length]]
  const mxl = Math.max(1, ...lib.map(l => l[1]))
  const kb = (s: string) => `${Math.max(1, Math.round(Number(s) / 1024))} KB`
  const sym: Record<string, string> = { ok: '✓', pend: '…', miss: '—' }
  return (<>
    <Strip items={kp} />
    <Card t="Site document checklists" r={<a className="muted" href="#sitedocs">Open →</a>}><TypeCards /></Card>
    <div className="g2">
      <Card t="Site document compliance" r={<span className="muted">Required: {REQ.join(', ')}</span>}>
        <table className="mx"><thead><tr><th>Site</th>{REQ.map(t => <th key={t} className="c">{t}</th>)}<th>Complete</th></tr></thead>
          <tbody>{grid.map(g => { const ok = g.c.filter(x => x === 'ok').length; return (
            <tr key={g.code}><td>{g.name}<br /><span className="muted">{g.code} · {g.site}</span></td>
              {g.c.map((x, i) => <td key={i} className="c"><span className={`cell ${x}`}>{sym[x]}</span></td>)}
              <td><Prog v={(ok / REQ.length) * 100} bad={ok < 2} /> {Math.round((ok / REQ.length) * 100)}%</td></tr>) })}
            {!grid.length && <tr><td colSpan={6} className="muted">No projects yet.</td></tr>}</tbody></table>
        <div className="legend key"><span className="cell ok">✓</span>Approved<span className="cell pend">…</span>In review<span className="cell miss">—</span>Missing</div>
      </Card>
      <Card t="Overall compliance"><Donut d={[['Complete', n('ok'), '#35e0b5'], ['In review', n('pend'), '#f5c542'], ['Missing', n('miss'), '#ff7b8a']]} center={`${pct}%`} /></Card>
    </div>
    <div className="g2">
      <Card t="Document library" r={<a className="muted" href="#documents">Open →</a>}><div className="tiles">{lib.map(([l, c]) => <a className="tile" key={l} href="#documents"><span className="muted">{l}</span><b>{c}</b><Prog v={(c / mxl) * 100} /></a>)}</div></Card>
      <Card t="Expiry tracker" r={<a className="muted" href="#permits">Permits →</a>}><Feed items={expAll.slice(0, 5).map(e => ({ a: e.t, t: e.t, s: e.s, r: <span className={`chip ${e.d < 0 ? 'bad' : e.d < 14 ? 'bad' : e.d < 30 ? 'warn' : 't'}`}>{e.d < 0 ? 'Expired' : `${e.d}d left`}</span> }))} /></Card>
    </div>
    <div className="g21">
      <Card t={`Review queue · ${review.length}`}><Feed items={review.map(d => ({ a: d.by || d.project, t: d.title, s: `${d.project} · ${d.type}`, r: <Btns a={() => update('documents', d.id, { status: 'Approved' })} b={() => update('documents', d.id, { status: 'Returned' })} lb="Return" /> }))} /></Card>
      <Card t="Recent uploads" r={<a className="btn sm" href="#documents">+ Upload</a>}>
        <Feed items={docs.filter(d => d.fileId).slice(0, 4).map(d => ({ a: d.by || 'File', t: d.fileName, s: `${d.project} · ${kb(d.size)} · ${d.date}` }))} /></Card>
    </div>
  </>)
}

/* ---------- BUDGET OFFICER: budgets are set here, ACTUAL is computed from expenses and purchases ---------- */
function Budget({ role }: P) {
  const c = useCtx()
  const bud = budgetLines(c.data, c.proj)
  const by = c.pms.filter(m => c.proj === 'all' || m.code === c.proj).map(m => {
    const r = bud.filter(b => b.project === m.code)
    return { l: `${m.code} ${m.name}`, v: sum(r, 'actual'), max: sum(r, 'budget') }
  }).filter(x => x.max > 0)
  const ex = c.p('expenses')
  const cats: [string, number, string][] = [['Materials', TEAL], ['Labor', BLUE], ['Equipment', AMBER], ['Other', VIOLET]].map(([k, col]) => [k, sum(ex.filter(e => e.category === k)), col])
  const tot = cats.reduce((a, x) => a + x[1], 0)
  return (<>
    <Strip items={c.kpis(role)} />
    <ProjectSummary role={role} />
    <div className="g2">
      <Card t="Budget vs actual by project"><HBars rows={by.map(r => ({ ...r, note: `${peso(r.v)} / ${peso(r.max)}` }))} />{!by.length && <p className="muted">No budget lines yet.</p>}</Card>
      <Card t="Expenses by category">{tot ? <Donut d={cats.map(x => [x[0], Math.round((x[1] / tot) * 100), x[2]])} center={short(tot)} /> : <p className="muted">No expenses yet.</p>}</Card>
    </div>
    <div className="g21"><Pipeline role={role} /><PendingCard /></div>
    <Card t="Variance report" r={<a className="muted" href="#budgets">Edit budgets →</a>}><div className="scroll"><table><thead><tr><th>Project</th><th>Category</th><th>Budget</th><th>Actual (computed)</th><th>Variance</th><th>Status</th></tr></thead>
      <tbody>{bud.map(r => { const v = n(r.budget) ? ((n(r.actual) - n(r.budget)) / n(r.budget)) * 100 : 0; return <tr key={r.id}><td>{r.project}</td><td className="muted">{r.category}</td><td>{peso(n(r.budget))}</td><td>{peso(n(r.actual))}</td><td className={v > 0 ? 'neg' : 'teal'}>{v > 0 ? '+' : ''}{v.toFixed(1)}%</td><td>{chip(r.status)}</td></tr> })}</tbody></table></div></Card>
  </>)
}

/* ---------- ASSET OFFICER ---------- */
function Asset({ role, seed }: P) {
  const c = useCtx()
  const as = c.data.assets ?? []
  const cnt = (s: string) => as.filter(a => a.status === s).length
  const site: Record<string, number> = {}
  as.forEach(a => { site[a.site] = (site[a.site] ?? 0) + 1 })
  const smax = Math.max(1, ...Object.values(site))
  const tr = (c.data.transfers ?? []).filter(t => t.status === 'Pending' || t.status === 'Approved')
  return (<>
    <Strip items={c.kpis(role)} />
    <ProjectSummary role={role} />
    <div className="g2">
      <Card t="Utilization · last 14 days" r={<span className="muted">sample</span>}><Heat rows={['Excavators', 'Loaders', 'Mixers', 'Generators', 'Scaffolding', 'Hand tools']} cols={days(14)} seed={seed + 3} /></Card>
      <Card t="Fleet status"><Donut d={[['Deployed', cnt('Deployed'), TEAL], ['Available', cnt('Available'), BLUE], ['Maintenance', cnt('Maintenance'), AMBER]]} center={String(as.length)} /></Card>
    </div>
    <div className="g3">
      <Card t="Needs maintenance"><Feed items={as.filter(a => a.status === 'Maintenance' || a.condition === 'Repair').map(a => ({ a: a.asset, t: `${a.asset} ${a.code}`, s: `${a.site} · ${a.condition}`, r: <button className="ghost sm" onClick={() => c.update('assets', a.id, { status: 'Available', condition: 'Good' })}>Mark fixed</button> }))} /></Card>
      <Card t="Assets by site"><HBars rows={Object.entries(site).map(([l, v]) => ({ l, v, max: smax }))} /></Card>
      <AI role={role} />
    </div>
    <div className="g21">
      <Card t={`Pending transfers · ${tr.length}`} r={<a className="muted" href="#transfers">Open →</a>}><Feed items={tr.map(t => ({ a: t.asset, t: t.asset, s: `${t.from} → ${t.to} · ${t.date}`, r: t.status === 'Approved' ? <button className="ghost sm" onClick={() => c.update('transfers', t.id, { status: 'Done' })}>Complete</button> : chip('Awaiting approval', 'warn') }))} /></Card>
      <Pipeline role={role} />
    </div>
  </>)
}

/* ---------- HR: roster, attendance approval, payroll generated from approved attendance ---------- */
function HR({ role, seed }: P) {
  const c = useCtx()
  const emp = c.data.employees ?? []
  const pos: Record<string, number> = {}
  emp.forEach(e => { pos[e.position] = (pos[e.position] ?? 0) + 1 })
  const pmax = Math.max(1, ...Object.values(pos))
  const pr = c.data.payroll ?? []
  const at = !pr.length ? 0 : pr.every(r => r.status === 'Paid') ? 4 : pr.every(r => r.status !== 'Draft') ? 3 : 1
  const drafts = pr.filter(r => r.status === 'Draft'), appr = pr.filter(r => r.status === 'Approved')
  const advance = (rows: Rec[], s: string) => { rows.forEach(r => c.update('payroll', r.id, { status: s }, true)); c.addLog(`Payroll ${s.toLowerCase()} for ${rows.length} employee(s)`) }
  const leaves = (c.data.leaves ?? []).filter(l => l.status === 'Pending')
  const decide = (l: Rec, s: string) => { c.update('leaves', l.id, { status: s }); c.addLog(`Leave ${s.toLowerCase()}: ${l.employee}`) }
  const [from, setFrom] = useState(`${today().slice(0, 8)}01`)
  const [to, setTo] = useState(today())
  const [msg, setMsg] = useState('')
  const { run: act, pending } = useAction()
  const toast = useToast()
  const gen = () => {
    const att = (c.data.attendance ?? []).filter(a => a.status === 'Approved' && a.date >= from && a.date <= to)
    const period = `${from} to ${to}`
    let made = 0, skipped = 0
    emp.forEach(e => {
      const rs = att.filter(a => a.worker === e.name)
      if (!rs.length) return
      if (pr.some(p => p.employee === e.name && p.period === period)) { skipped++; return }
      const gross = Math.round(rs.reduce((x, a) => x + n(a.days) * n(e.rate) + n(a.ot) * (n(e.rate) / 8) * 1.25, 0))
      if (gross > 0) { c.add('payroll', { employee: e.name, period, gross: String(gross), deductions: '0', status: 'Draft' }, true); made++ }
    })
    c.addLog(`Generated ${made} payroll record(s) for ${period}`)
    const m = made ? `${made} draft payroll record(s) created from approved attendance.` : skipped ? 'Payroll for this period already exists.' : 'No approved attendance in this period.'
    setMsg(m); if (made) toast.success(m); else toast.info(m)
  }
  return (<>
    <Strip items={c.kpis(role)} />
    <ProjectSummary role={role} />
    <div className="g2">
      <Card t="Headcount by position"><HBars rows={Object.entries(pos).map(([l, v]) => ({ l, v, max: pmax }))} /></Card>
      <Card t="Attendance · this week" r={<span className="muted">sample</span>}><Heat rows={['Construction', 'Engineering', 'Admin & HR', 'Finance']} cols={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']} seed={seed + 9} /></Card>
    </div>
    <div className="g21"><AttendanceVerify />
      <Card t="Payroll run"><Steps s={['Prepare', 'Review', 'Approve', 'Release']} at={at} />
        <div className="row"><label className="inl"><span className="muted">From</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label className="inl"><span className="muted">To</span><input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
          <Btn className="ghost" busy={pending} onClick={() => void act(gen)}>Generate from approved attendance</Btn></div>
        {msg && <p className="muted hint">{msg}</p>}
        <div className="sum"><div><span className="muted">Employees</span><b>{pr.length}</b></div><div><span className="muted">Gross</span><b>{peso(sum(pr, 'gross'))}</b></div><div><span className="muted">Deductions</span><b>{peso(sum(pr, 'deductions'))}</b></div></div>
        <div className="row">{drafts.length > 0 && <Btn busy={pending} onClick={() => void act(() => advance(drafts, 'Approved'), 'Payroll approved')}>Approve {drafts.length} draft(s)</Btn>}
          {appr.length > 0 && <Btn busy={pending} onClick={() => void act(() => advance(appr, 'Paid'), 'Payroll released')}>Release {appr.length}</Btn>}<a className="btn ghostbtn" href="#payroll">Open payroll</a></div></Card>
    </div>
    <div className="g21">
      <Card t={`Leave requests · ${leaves.length}`}><Feed items={leaves.map(l => ({ a: l.employee, t: l.employee, s: `${l.type} · ${l.from} to ${l.to}`, r: <Btns a={() => decide(l, 'Approved')} b={() => decide(l, 'Rejected')} lb="Decline" /> }))} /></Card>
      <Pipeline role={role} />
    </div>
  </>)
}

/* ---------- FINANCE: invoices, collections, expenses all from records ---------- */
function Finance({ role }: P) {
  const c = useCtx()
  const bil = c.p('billing'), pay = c.p('payments'), ex = c.p('expenses'), pur = c.p('purchases')
  const [sent, setSent] = useState<string[]>([])
  const [cur, setCur] = useState('')
  const { run: act, pending } = useAction()
  const now = Date.now()
  const unpaid = bil.filter(b => b.status === 'Sent' || b.status === 'Overdue')
  const age = (lo: number, hi: number) => sum(unpaid.filter(b => { const d = Math.floor((now - new Date(b.due).getTime()) / 864e5); return d >= lo && d <= hi }))
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, m: d.toLocaleDateString('en', { month: 'short' }) } })
  const live = months.map(({ key, m }) => ({ m, c: sum(pay.filter(x => x.date.startsWith(key))), e: sum(ex.filter(x => x.date.startsWith(key))) }))
  const cats: [string, number, string][] = [['Materials', TEAL], ['Labor', BLUE], ['Equipment', AMBER], ['Other', VIOLET]].map(([k, col]) => [k, sum(ex.filter(e => e.category === k)), col])
  const tot = cats.reduce((a, x) => a + x[1], 0)
  const markPaid = (b: Rec) => {
    c.update('billing', b.id, { status: 'Paid' }, true)
    c.add('payments', { client: c.pms.find(m => m.code === b.project)?.client ?? b.project, project: b.project, amount: b.amount, date: today(), method: 'Bank' }, true)
    c.addLog(`${b.invoice} marked paid`)
  }
  return (<>
    <Strip items={c.kpis(role)} />
    <ProjectSummary role={role} />
    <div className="g2">
      <CashChart seed={0} live={live} />
      <Card t="Receivables aging"><StackBar fmt={peso} d={[['Not yet due', age(-9999, 0), TEAL], ['1-30 days', age(1, 30), AMBER], ['31-60 days', age(31, 60), '#ff9f7a'], ['60+ days', age(61, 9999), RED]]} /></Card>
    </div>
    <div className="g3">
      <Card t="Expenses by category">{tot ? <Donut d={cats.map(x => [x[0], Math.round((x[1] / tot) * 100), x[2]])} center={short(tot)} /> : <p className="muted">No expenses yet.</p>}</Card>
      <Card t="Invoices" r={<a className="muted" href="#billing">All →</a>}><div className="scroll"><table><thead><tr><th>Invoice</th><th>Amount</th><th>Status</th><th /></tr></thead>
        <tbody>{bil.slice(0, 7).map(b => <tr key={b.id}><td>{b.invoice}<br /><span className="muted">{b.project} · due {b.due}</span></td><td>{peso(n(b.amount))}</td><td>{chip(b.status, b.status === 'Paid' ? '' : tone(b.status))}</td>
          <td>{(b.status === 'Sent' || b.status === 'Overdue') && <span className="row">
            <Btn className="ghost sm" busy={pending && cur === `r${b.id}`} disabled={pending || sent.includes(b.id)} onClick={() => { setCur(`r${b.id}`); void act(() => { setSent(x => [...x, b.id]); c.addLog(`Reminder sent for ${b.invoice}`) }, `Reminder sent for ${b.invoice}`) }}>{sent.includes(b.id) ? 'Sent ✓' : 'Remind'}</Btn>
            <Btn className="sm" busy={pending && cur === b.id} disabled={pending} onClick={() => { setCur(b.id); void act(() => markPaid(b), `${b.invoice} marked paid · payment recorded`) }}>Mark paid</Btn></span>}</td></tr>)}</tbody></table></div></Card>
      <Card t="Payables · purchases to pay"><Feed items={pur.filter(x => x.status !== 'Received').map(x => ({ a: x.supplier, t: x.item, s: `${x.supplier} · ${x.project}`, r: <b>{peso(n(x.amount))}</b> }))} /></Card>
    </div>
  </>)
}

export const DASH: Record<Role, FC<P>> = {
  admin: Admin, assistant_manager: AsstMgr, site_supervisor: SiteSup, foreman: Foreman, client: Client,
  documents: Docs, budget: Budget, asset: Asset, hr: HR, finance: Finance,
}
