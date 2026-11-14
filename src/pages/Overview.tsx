import { useState } from 'react'
import { ROLES, Role } from '../roles'
import { useStore, SCOPED } from '../store'
import { projectMetrics, sc } from '../metrics'
import { RANGE_KEYS, Range } from './widgets'
import { DASH } from './Dashboards'

export function Overview({ role, name }: { role: Role; name: string }) {
  const cfg = ROLES[role]
  const { me, data, proj, setProj } = useStore()
  const [range, setRange] = useState<Range>('30D')
  const pms = projectMetrics(data)
  const locked = !!me && SCOPED.includes(me.role) && !!me.project
  const seed = proj === 'all' ? 0 : pms.findIndex(m => m.code === proj) + 1
  const urgent = (data.approvals ?? []).filter(a => a.status === 'Pending').length + sc(data.billing, proj).filter(b => b.status === 'Overdue').length + sc(data.incidents, proj).filter(i => i.status === 'Open').length
  const Body = DASH[role]
  return (
    <>
      <div className="head">
        <div><h1>Overview</h1><p className="muted">Good morning, {name.split(' ')[0]}. {urgent} item{urgent === 1 ? '' : 's'} need attention{proj !== 'all' ? ` in ${proj}` : ''}.</p></div>
        <div className="row">
          <select className="pillsel" value={proj} disabled={locked} title={locked ? 'Your assigned project' : 'Filter dashboard by project'} onChange={e => setProj(e.target.value)}>
            {!locked && <option value="all">All projects</option>}
            {pms.map(m => <option key={m.code} value={m.code}>{m.code} · {m.name}</option>)}
          </select>
          <select className="pillsel" value={range} onChange={e => setRange(e.target.value as Range)}>{RANGE_KEYS.map(r => <option key={r}>{r}</option>)}</select>
          <a className="btn" href={`#${cfg.actionTo}`}>+ {cfg.action}</a>
        </div>
      </div>
      <Body key={role} role={role} range={range} seed={seed} name={name} />
    </>
  )
}
