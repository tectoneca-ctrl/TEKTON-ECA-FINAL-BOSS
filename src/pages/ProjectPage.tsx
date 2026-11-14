import { ReactNode, useState } from 'react'
import { useStore, SCOPED } from '../store'
import { Role } from '../roles'
import { projectMetrics, budgetLines, n, short, sum } from '../metrics'
import { Card, Strip, Feed, Donut, BudgetChart, peso } from './widgets'
import { tone } from '../ui'
import { Empty } from '../ux'
import { can } from '../modules'

const ALL = ['Summary', 'Budget', 'Billing', 'Documents', 'Tasks', 'Crew']
const TABS: Record<Role, string[]> = {
  admin: ALL, assistant_manager: ALL, site_supervisor: ['Summary', 'Documents', 'Tasks', 'Crew'], foreman: ['Summary', 'Tasks', 'Crew'],
  client: ['Summary', 'Billing', 'Documents'], documents: ['Summary', 'Documents'], budget: ['Summary', 'Budget', 'Billing'], asset: ['Summary'], hr: ['Summary', 'Crew'], finance: ['Summary', 'Budget', 'Billing'],
}
const chip = (t: string) => <span className={`chip ${tone(t)}`}>{t}</span>
function Tbl({ cols, rows }: { cols: [string, (r: Record<string, string>) => ReactNode][]; rows: Record<string, string>[] }) {
  return <div className="scroll"><table><thead><tr>{cols.map(([l]) => <th key={l}>{l}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{cols.map(([l, f]) => <td key={l}>{f(r)}</td>)}</tr>)}{!rows.length && <tr><td colSpan={cols.length}><Empty icon="documents" title="Nothing recorded yet" hint="Records for this project will appear here." /></td></tr>}</tbody></table></div>
}

function BudgetTab({ code }: { code: string }) {
  const { data } = useStore()
  const bl = budgetLines(data, code).map(b => ({ l: b.category, b: n(b.budget), a: n(b.actual) }))
  const ex = (data.expenses ?? []).filter(e => e.project === code)
  const tb = bl.reduce((x, r) => x + r.b, 0), ta = bl.reduce((x, r) => x + r.a, 0)
  const used = tb ? Math.round((ta / tb) * 100) : 0, left = tb - ta, tot = sum(ex)
  const cats: [string, number, string][] = [['Materials', '#35e0b5'], ['Labor', '#7aa2ff'], ['Equipment', '#f5c542'], ['Other', '#c79bff']].map(([c, col]) => [c, sum(ex.filter(e => e.category === c)), col])
  return (
    <>
      <Strip items={[['Total budget', short(tb), '', ''], ['Actual spend', short(ta), `${used}% used`, used > 100 ? 'r' : used >= 90 ? 'a' : ''], [left < 0 ? 'Over by' : 'Remaining', short(Math.abs(left)), '', left < 0 ? 'r' : 'g'], ['Expenses logged', short(tot), `${ex.length} items`, '']]} />
      <div className="g2">
        <Card t="Budget vs actual" r={<span className="legend"><i className="lg3" />Budget<i className="lg1" />Actual</span>}>
          {bl.length ? <BudgetChart rows={bl} /> : <p className="muted">No budget lines for this project yet.</p>}
        </Card>
        <div className="stackcol">
          <Card t="Spend by category">{tot ? <Donut d={cats.map(x => [x[0], Math.round((x[1] / tot) * 100), x[2]])} center={short(tot)} /> : <p className="muted">No expenses yet.</p>}</Card>
          <Card t="Expenses"><Tbl cols={[['Item', r => r.item], ['Category', r => r.category], ['Amount', r => peso(n(r.amount))], ['Date', r => r.date]]} rows={ex} /></Card>
        </div>
      </div>
    </>
  )
}

export function ProjectPage({ code }: { code: string }) {
  const { me, data } = useStore()
  const [tab, setTab] = useState('Summary')
  const m = projectMetrics(data).find(x => x.code === code)
  if (!me) return null
  if (!m) return <><h1>Project not found</h1><a className="btn" href="#overview">Back to overview</a></>
  if (SCOPED.includes(me.role) && me.project && me.project !== code) return <><h1>Access denied</h1><div className="card muted">Hindi ito ang project na naka-assign sa iyo.</div></>
  const tabs = TABS[me.role], cur = tabs.includes(tab) ? tab : tabs[0]
  const rows = (k: string) => (data[k] ?? []).filter(r => r.project === code)
  const open = m.todo + m.ongoing
  const ptype = (data.projects ?? []).find(p => p.code === code)?.type

  return (
    <>
      <div className="head">
        <div><a className="muted" href="#overview">← Overview</a><h1>{m.name}</h1><p className="muted">{m.code} · {m.client} · {m.site}</p></div>
        <div className="row">{chip(m.status)}{ptype && can(me.role, 'sitedocs') && <a className="btnlink" href={`#sitedocs/${ptype}/${code}`}>Open checklist</a>}<div className="seg">{tabs.map(t => <button key={t} className={t === cur ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div></div>
      </div>

      {cur === 'Summary' && <>
        <Strip items={[['Progress', `${m.progress}%`, m.status, m.status === 'Delayed' ? 'a' : 'g'], ['Budget', short(m.budget), '', ''], ['Spent', short(m.spent), `${m.used}% used`, m.used > 100 ? 'r' : ''], ['Billed', short(m.billed), '', ''], ['Collected', short(m.collected), '', 'g'], ['Balance', short(m.balance), m.overdue ? `${m.overdue} overdue` : '', m.overdue ? 'a' : '']]} />
        <div className="g2">
          <Card t="Milestones"><Feed items={rows('progress').map(x => ({ a: x.milestone, t: x.milestone, s: x.date || 'Not started', r: <span className={`chip ${n(x.percent) >= 100 ? '' : n(x.percent) > 0 ? 'warn' : 't'}`}>{n(x.percent)}%</span> }))} /></Card>
          <Card t="Project facts"><div className="facts">
            {([['Open tasks', open], ['Open incidents', m.incidents], ['Deliveries pending', m.deliveries], ['Documents', `${m.docsOk}/4 required`], ['Crew (latest day)', m.crew], ['OT hours', m.ot], ['Pending purchases', m.pending], ['Equipment on site', m.assets]] as [string, string | number][]).map(([l, v]) => <div key={l}><span className="muted up">{l}</span><b>{v}</b></div>)}</div></Card>
        </div></>}

      {cur === 'Budget' && <BudgetTab code={code} />}

      {cur === 'Billing' && <div className="g2">
        <Card t={`Billing · ${peso(m.billed)}`}><Tbl cols={[['Invoice', r => r.invoice], ['Amount', r => peso(n(r.amount))], ['Due', r => r.due], ['Status', r => chip(r.status)]]} rows={rows('billing')} /></Card>
        <Card t={`Payments received · ${peso(m.collected)}`}><Tbl cols={[['Client', r => r.client], ['Amount', r => peso(n(r.amount))], ['Date', r => r.date], ['Method', r => r.method]]} rows={rows('payments')} /></Card>
      </div>}

      {cur === 'Documents' && <Card t="Project documents" r={<a className="muted" href="#documents">Manage →</a>}><Tbl cols={[['Document', r => r.title], ['Type', r => r.type], ['Expires', r => r.expires || '—'], ['Status', r => chip(r.status)]]} rows={rows('documents')} /></Card>}

      {cur === 'Tasks' && <><div className="g2">
        <Card t={`Tasks · ${open} open`}><Tbl cols={[['Task', r => r.task], ['Crew', r => r.crew], ['Due', r => r.due], ['Status', r => chip(r.status)]]} rows={rows('tasks')} /></Card>
        <Card t={`Incidents · ${m.incidents} open`}><Tbl cols={[['Report', r => r.report], ['Severity', r => chip(r.severity)], ['Status', r => chip(r.status)]]} rows={rows('incidents')} /></Card></div>
        <Card t={`Deliveries · ${m.deliveries} pending`}><Tbl cols={[['Item', r => r.item], ['Supplier', r => r.supplier], ['ETA', r => r.eta], ['Status', r => chip(r.status)]]} rows={rows('deliveries')} /></Card></>}

      {cur === 'Crew' && <Card t="Attendance log" r={<span className="muted">{m.crew} on latest day · {m.ot}h OT</span>}><Tbl cols={[['Worker', r => r.worker], ['Date', r => r.date], ['Days', r => r.days], ['OT hours', r => r.ot]]} rows={rows('attendance')} /></Card>}
    </>
  )
}
