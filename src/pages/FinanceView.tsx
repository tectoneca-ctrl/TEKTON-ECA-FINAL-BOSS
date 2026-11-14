import { projectMetrics, short } from '../metrics'
import { useStore } from '../store'
import { Empty } from '../ux'
import { Card, Strip } from './widgets'

export function FinanceView() {
  const { me, data, backend, financeSummary } = useStore()
  if (!me || me.role !== 'documents' || !me.financeViewProject) {
    return <><h1>Access denied</h1><div className="card muted">Walang Finance view-only access ang account na ito.</div></>
  }

  const all = backend === 'supabase' ? financeSummary : projectMetrics(data)
  const rows = me.financeViewProject === 'all' ? all : all.filter(p => p.code === me.financeViewProject)
  const total = rows.reduce((t, p) => ({
    budget: t.budget + p.budget,
    spent: t.spent + p.spent,
    billed: t.billed + p.billed,
    collected: t.collected + p.collected,
    balance: t.balance + p.balance,
    overdue: t.overdue + p.overdue,
  }), { budget: 0, spent: 0, billed: 0, collected: 0, balance: 0, overdue: 0 })

  return (
    <>
      <div className="head">
        <div><h1>Finance overview</h1><p className="muted">Project-level summary · Read only · Scope: {me.financeViewProject === 'all' ? 'All projects' : me.financeViewProject}</p></div>
        <span className="chip">VIEW ONLY</span>
      </div>
      <Strip items={[
        ['Projects', String(rows.length), '', ''],
        ['Project budget', short(total.budget), '', ''],
        ['Actual spend', short(total.spent), '', ''],
        ['Billed', short(total.billed), '', ''],
        ['Collected', short(total.collected), '', 'g'],
        ['Outstanding', short(total.balance), total.overdue ? `${total.overdue} overdue invoices` : '', total.overdue ? 'a' : ''],
      ]} />
      <Card t="Project finance summary">
        <div className="scroll"><table>
          <thead><tr><th>Project</th><th>Budget</th><th>Actual spend</th><th>Billed</th><th>Collected</th><th>Outstanding</th><th>Overdue invoices</th></tr></thead>
          <tbody>
            {rows.map(p => <tr key={p.code}>
              <td><b>{p.name}</b><br /><span className="muted">{p.code} · {p.site}</span></td>
              <td>{short(p.budget)}</td><td>{short(p.spent)}</td><td>{short(p.billed)}</td><td>{short(p.collected)}</td><td>{short(p.balance)}</td><td>{p.overdue}</td>
            </tr>)}
            {!rows.length && <tr><td colSpan={7}><Empty icon="billing" title="No project data in this scope" hint="Ask Admin to update your Finance summary access." /></td></tr>}
          </tbody>
        </table></div>
      </Card>
      <p className="muted hint">Summary only. Walang invoice/payment details, payroll, bank information, edit controls, o approval actions sa view na ito.</p>
    </>
  )
}