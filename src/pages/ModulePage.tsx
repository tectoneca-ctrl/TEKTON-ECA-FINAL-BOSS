import { useMemo, useState } from 'react'
import { MODULES, MONEY, STATUS_EDITORS, OPTIONAL_PROJECT, AUTO_APPROVAL, Field } from '../modules'
import { Btn, Empty, useAction } from '../ux'
import { useStore, projectCodes, nextProjectCode, SCOPED, Rec } from '../store'
import { projectReferences, localDate } from '../metrics'

const BAD = ['Overdue', 'Delayed', 'Over', 'Rejected', 'High', 'Expired', 'Repair', 'Open', 'Resigned', 'Returned']
const WARN = ['Pending', 'Warning', 'Review', 'Expiring', 'Draft', 'Medium', 'Expected', 'Todo', 'Maintenance']
const tone = (v: string) => (BAD.includes(v) ? 'bad' : WARN.includes(v) ? 'warn' : '')

export function ModulePage({ k, readOnly }: { k: string; readOnly: boolean }) {
  const { me, backend, data, users, add, update, remove, decideApproval, payInvoice } = useStore()
  const def = MODULES[k]
  const financePayroll = backend === 'supabase' && me?.role === 'finance' && k === 'payroll'
  const sites = projectCodes((data.projects ?? []).filter(p => p.status !== 'Archived'))
  const emps = (data.employees ?? []).filter(e => e.status !== 'Resigned').map(e => e.name)
  const hasProj = def.fields.some(f => f.type === 'project')
  const lock = me && SCOPED.includes(me.role) && me.project && hasProj ? me.project : ''
  const all = data[k] ?? []
  const rows = lock ? all.filter(r => r.project === lock) : all
  const vis = def.fields.filter(f => !f.hidden)
  const status = def.fields.find(f => f.k === 'status')
  const editors = STATUS_EDITORS[k]
  const canStatus = !(backend === 'supabase' && ['purchases','transfers','cashadvance','billing','payroll'].includes(k)) && !readOnly && (!editors || (!!me && editors.includes(me.role)))
  const rowLocked = (r: Rec) => (backend === 'supabase' && (k === 'payments' || ['billing','payroll'].includes(k) && r.status === 'Paid' || ['purchases','transfers','cashadvance'].includes(k) && ['Received','Done','Released'].includes(r.status))) || k === 'attendance' && r.status === 'Approved' && !(me && STATUS_EDITORS.attendance.includes(me.role))
  const [q, setQ] = useState('')
  const [flt, setFlt] = useState(k === 'projects' ? 'Active' : 'All')
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [err, setErr] = useState('')
  const [projectDelete, setProjectDelete] = useState<Rec | null>(null)
  const [deleteCode, setDeleteCode] = useState('')
  const { run, pending } = useAction()

  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 'type', dir: 1 })
  const isTemplatePage = k === 'templates'
  const shown = useMemo(() => {
    const filtered = rows.filter(r =>
      (k === 'projects' && flt === 'Active' ? r.status !== 'Archived' : flt === 'All' || r.status === flt) &&
      JSON.stringify(r).toLowerCase().includes(q.toLowerCase()))
    if (!isTemplatePage) return filtered
    const compare = (a: Rec, b: Rec, key: string) => {
      const av = a[key] ?? '', bv = b[key] ?? ''
      const field = def.fields.find(f => f.k === key)
      return field?.type === 'number'
        ? (Number(av) || 0) - (Number(bv) || 0)
        : av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' })
    }
    const tieBreakers = ['type', 'section', 'order', 'label', 'out'].filter(key => key !== sort.key)
    return filtered.sort((a, b) => {
      const primary = compare(a, b, sort.key) * sort.dir
      if (primary) return primary
      for (const key of tieBreakers) {
        const next = compare(a, b, key)
        if (next) return next
      }
      return 0
    })
  }, [rows, q, flt, isTemplatePage, sort, def.fields, k])

  const defaults = (): Record<string, string> => Object.fromEntries(def.fields.map(f => [f.k,
    f.type === 'code' ? '' : f.type === 'project' ? (lock || (OPTIONAL_PROJECT.includes(k) ? '' : sites[0]?.code ?? ''))
    : f.type === 'employee' ? emps[0] ?? '' : f.type === 'select' ? f.options?.[0] ?? '' : f.type === 'date' && f.k === 'date' ? localDate() : '']))
  const start = (r?: Rec) => { setErr(''); setEditId(r ? r.id : null); setForm(r ? { ...Object.fromEntries(def.fields.map(f => [f.k, r[f.k] ?? ''])), _version: r._version } : defaults()); setOpen(true) }
  const save = () => {
    const req = def.fields.find(f => !f.hidden)
    if (req && !form[req.k]?.trim()) return setErr(`${req.label} is required.`)
    if (k === 'projects') {
      const c = (form.code ?? '').trim()
      if (!/^[A-Za-z0-9._-]+$/.test(c)) return setErr('Site ID can only use letters, numbers, dots, dashes and underscores.')
      if (!editId && (data.projects ?? []).some(p => p.code.toLowerCase() === c.toLowerCase())) return setErr('That Site ID already exists.')
    }
    if (hasProj && !OPTIONAL_PROJECT.includes(k) && !form.project) return setErr('Choose a project.')
    const neg = def.fields.find(f => f.type === 'number' && form[f.k] !== '' && Number(form[f.k]) < 0)
    if (neg) return setErr(`${neg.label} cannot be negative.`)
    const msg = editId ? 'Changes saved' : AUTO_APPROVAL[k] && form.status === 'Pending' ? 'Record added · sent for approval' : 'Record added'
    void run(async () => { if (editId) await update(k, editId, form, true); else await add(k, form, true) }, msg).then(ok => { if (ok) setOpen(false) })
  }
  const del = (r: Rec) => {
    if (k === 'projects') { setProjectDelete(r); setDeleteCode(''); return }
    if (confirm('Delete this record?')) void run(() => remove(k, r.id, true), 'Record deleted')
  }
  const archive = (r: Rec) => {
    const restoring = r.status === 'Archived'
    const restoreStatuses = ['Planning', 'Ongoing', 'Delayed', 'Completed']
    const restoreTo = restoreStatuses.includes(r.statusBeforeArchive) ? r.statusBeforeArchive : 'Planning'
    const prompt = restoring
      ? `Restore ${r.code} to ${restoreTo}? It will be available for new project work again.`
      : `Archive ${r.code}? Its linked history will stay available, while new records and checklist changes will be blocked.`
    if (!confirm(prompt)) return
    void run(() => update('projects', r.id, {
      status: restoring ? restoreTo : 'Archived',
      statusBeforeArchive: restoring ? '' : r.status,
      _version: r._version,
    }, true), restoring ? 'Project restored' : 'Project archived')
  }
  const projectDeleteRefs = projectDelete ? projectReferences(data, projectDelete.code, users) : []
  const permanentlyDelete = () => {
    if (!projectDelete || projectDeleteRefs.length || deleteCode.trim() !== projectDelete.code) return
    void run(() => remove('projects', projectDelete.id, true), 'Project permanently deleted').then(ok => {
      if (ok) { setProjectDelete(null); setDeleteCode('') }
    })
  }
  const csv = () => {
    const head = vis.map(f => f.label).join(',')
    const body = shown.map(r => vis.map(f => `"${(r[f.k] ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([head + '\n' + body], { type: 'text/csv' }))
    a.download = `${k}.csv`; a.click()
  }
  const fmt = (f: Field, v: string) => (MONEY.has(f.k) && v !== '' ? `₱${Number(v).toLocaleString()}` : v)
  const input = (f: Field) => {
    const v = form[f.k] ?? ''
    const set = (x: string) => setForm({ ...form, [f.k]: x })
    if (f.type === 'code') return <input value={v} readOnly={!!editId} placeholder={`e.g. ${nextProjectCode(data.projects ?? [])}`} onChange={e => set(e.target.value.toUpperCase().replace(/\s+/g, ''))} />
    if (f.type === 'project') return <select value={v} disabled={!!lock} onChange={e => set(e.target.value)}>{OPTIONAL_PROJECT.includes(k) && <option value="">— None —</option>}{sites.map(s => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}</select>
    if (f.type === 'employee') return <select value={v} onChange={e => set(e.target.value)}>{(emps.includes(v) || !v ? emps : [v, ...emps]).map(o => <option key={o}>{o}</option>)}</select>
    if (f.type === 'select') return <select disabled={backend === 'supabase' && f.k === 'status' && (k === 'approvals' || ['purchases','transfers','cashadvance'].includes(k) && !editId)} value={v} onChange={e => set(e.target.value)}>{(k === 'projects' && f.k === 'status' ? f.options?.filter(o => o !== 'Archived') : f.options)?.map(o => <option key={o}>{o}</option>)}</select>
    return <input type={f.type} value={v} onChange={e => set(e.target.value)} />
  }

  return (
    <>
      <h1>{def.title}</h1>
      <p className="muted">{shown.length} of {rows.length} records{lock ? ` · ${lock} only` : ''}{readOnly ? ' · view only' : ''}</p>
      <div className="card toolbar">
        <input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
        {status?.options && <select aria-label={`${def.title} status filter`} value={flt} onChange={e => setFlt(e.target.value)}>{k === 'projects' && <option>Active</option>}<option>All</option>{status.options.map(o => <option key={o}>{o}</option>)}</select>}
        <span className="grow" />
        <button className="ghost" onClick={csv}>Export CSV</button>
        {!readOnly && !financePayroll && k !== 'approvals' && <button onClick={() => start()}>+ New</button>}
      </div>
      <div className="card scroll">
        <table>
          <thead><tr>{vis.map(f => <th key={f.k} aria-sort={isTemplatePage ? (sort.key === f.k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none') : undefined}>{isTemplatePage
            ? <button type="button" className="table-sort" onClick={() => setSort(current => current.key === f.k ? { ...current, dir: current.dir === 1 ? -1 : 1 } : { key: f.k, dir: 1 })}>
                {f.label}<span aria-hidden="true">{sort.key === f.k ? (sort.dir === 1 ? '↑' : '↓') : '↕'}</span>
              </button>
            : f.label}</th>)}<th /></tr></thead>
          <tbody>
            {shown.map(r => (
              <tr key={r.id}>
                {vis.map(f => (
                  <td key={f.k}>
                    {f.k === 'status' && f.options
                      ? (canStatus && !rowLocked(r) && !(k === 'projects' && r.status === 'Archived') && !(k !== 'projects' && r.project && data.projects.some(p => p.code === r.project && p.status === 'Archived'))
                        ? <select className={`chip ${tone(r[f.k])}`} value={r[f.k]} disabled={pending} onChange={e => { const status = e.target.value; void run(() => update(k, r.id, { status, _version: r._version }, true), 'Changes saved') }}>{f.options.filter(o => k !== 'projects' || o !== 'Archived').map(o => <option key={o}>{o}</option>)}</select>
                        : <span className={`chip ${tone(r[f.k])}`}>{r[f.k]}</span>)
                      : fmt(f, r[f.k] ?? '')}
                  </td>
                ))}
                <td><span className="row">
                  {k === 'payroll' && backend === 'supabase' && ['admin','finance'].includes(me?.role ?? '') && r.status === 'Approved' && <button disabled={pending} onClick={() => void run(() => update(k, r.id, { status: 'Paid', _version: r._version }, true), 'Payroll released')}>Release payroll</button>}
                  {k === 'billing' && backend === 'supabase' && !readOnly && ['Sent','Overdue'].includes(r.status) && <button disabled={pending} onClick={() => void run(() => payInvoice(r), 'Collection recorded')}>Mark paid</button>}
                  {k === 'projects' && <a className="btnlink" href={`#project/${r.code}`}>Open</a>}
                  {k === 'projects' && me?.role === 'admin' && <button className="ghost sm" disabled={pending} onClick={() => archive(r)}>{r.status === 'Archived' ? 'Restore' : 'Archive'}</button>}
                  {k === 'projects' && me?.role === 'admin' && <button className="ghost sm danger" disabled={pending} onClick={() => del(r)}>Delete</button>}
                  {k === 'approvals' && !readOnly && (backend === 'demo' || me?.role === 'admin') && r.status === 'Pending' && <><button className="sm" disabled={pending} onClick={() => void run(() => decideApproval(r, 'Approved'))}>Approve</button><button className="ghost sm" disabled={pending} onClick={() => void run(() => decideApproval(r, 'Rejected'))}>Reject</button></>}
                  {!readOnly && !financePayroll && k !== 'approvals' && k !== 'projects' && r.project && data.projects.some(p => p.code === r.project && p.status === 'Archived') && <span className="muted">Archived project · history only</span>}
                  {!readOnly && !financePayroll && !rowLocked(r) && k !== 'approvals' && !(k === 'projects' && r.status === 'Archived') && !(k !== 'projects' && r.project && data.projects.some(p => p.code === r.project && p.status === 'Archived')) && <button className="ghost sm" onClick={() => start(r)}>Edit</button>}
                  {!readOnly && !financePayroll && k !== 'approvals' && k !== 'projects' && !rowLocked(r) && !(r.project && data.projects.some(p => p.code === r.project && p.status === 'Archived')) && <button className="ghost sm" onClick={() => del(r)}>Delete</button>}
                </span></td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={vis.length + 1}><Empty icon="documents" title={rows.length ? 'No matches' : `No ${def.title.toLowerCase()} yet`} hint={rows.length ? 'Try a different search or filter.' : readOnly ? 'Nothing has been recorded for you yet.' : 'Add the first record to get started.'} action={rows.length ? <button className="ghost sm" onClick={() => { setQ(''); setFlt(k === 'projects' ? 'Active' : 'All') }}>Clear filters</button> : !readOnly && !financePayroll && k !== 'approvals' ? <button onClick={() => start()}>+ New</button> : undefined} /></td></tr>}
          </tbody>
        </table>
      </div>
      {open && (
        <div className="modal" onClick={() => setOpen(false)}>
          <div className="card" onClick={e => e.stopPropagation()}>
            <h3>{editId ? 'Edit' : 'New'} {def.title.toLowerCase()} record</h3>
            {def.fields.filter(f => !f.hidden).map(f => <label key={f.k}><span className="muted">{f.label}</span>{input(f)}</label>)}
            {err && <p className="formerr">{err}</p>}
            <div className="row end"><button className="ghost" disabled={pending} onClick={() => setOpen(false)}>Cancel</button><Btn busy={pending} onClick={save}>Save</Btn></div>
          </div>
        </div>
      )}
      {projectDelete && (
        <div className="modal" onClick={() => setProjectDelete(null)}>
          <div className="card" role="dialog" aria-modal="true" aria-labelledby="project-delete-title" onClick={e => e.stopPropagation()}>
            <h3 id="project-delete-title">Permanently delete {projectDelete.code}?</h3>
            <p className="muted">This cannot be undone. Linked records will never be cascade-deleted; Archive keeps the project's history intact.</p>
            {projectDeleteRefs.length > 0 ? <>
              <p className="formerr">Deletion is blocked until every reference is reassigned or removed. These records will be preserved:</p>
              <div className="card scroll"><table><thead><tr><th>Reference source</th><th>Records</th></tr></thead><tbody>{projectDeleteRefs.map(ref => <tr key={ref.key}><td>{ref.label}</td><td>{ref.count}</td></tr>)}</tbody></table></div>
              <p className="muted">You can archive this project now. To permanently delete it later, restore it first, resolve each reference, then try again.</p>
            </> : <>
              <p>No records or user assignments refer to this project.</p>
              <label>Type <b>{projectDelete.code}</b> to confirm<input autoFocus value={deleteCode} onChange={e => setDeleteCode(e.target.value)} /></label>
            </>}
            <div className="row end"><button className="ghost" onClick={() => setProjectDelete(null)}>Cancel</button>{projectDeleteRefs.length === 0 && <button className="danger" disabled={pending || deleteCode.trim() !== projectDelete.code} onClick={permanentlyDelete}>Permanently delete</button>}</div>
          </div>
        </div>
      )}
    </>
  )
}
