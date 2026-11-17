import { useState } from 'react'
import { deleteFileDatabase, listFiles } from '../filedb'
import { MODULES, NAV, INTERNAL } from '../modules'
import { ROLES, ROLE_KEYS, Role } from '../roles'
import { useStore, projectCodes, SCOPED } from '../store'
import { PasswordInput, Strength } from '../ui'
import { UserAvatar } from '../UserAvatar'
import { Btn, useAction, getLatency, setLatency, useToast } from '../ux'

export function UsersPage() {
  const { me, backend, users, data, addUser, setRole, setFinanceView, setPassword, removeUser, setUserProject } = useStore()
  const { run, pending } = useAction()
  const minPassword = backend === 'supabase' ? 12 : 6
  const sites = projectCodes(data.projects ?? [])
  const activeSites = projectCodes((data.projects ?? []).filter(p => p.status !== 'Archived'))
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [pw, setPw] = useState(''), [role, setR] = useState<Role>('foreman'), [pj, setPj] = useState('P-001'), [err, setErr] = useState('')
  const add = async () => {
    if (!name.trim() || !email.trim()) return setErr('Name and email are required.')
    if (users.some(u => u.email.toLowerCase() === email.trim().toLowerCase())) return setErr('That email is already registered.')
    if (pw.length < minPassword) return setErr('Password must be at least ' + minPassword + ' characters.')
    const ok = await run(() => addUser({ name: name.trim(), email: email.trim(), role, password: pw, project: SCOPED.includes(role) ? (activeSites.some(s => s.code === pj) ? pj : activeSites[0]?.code) : undefined }), 'User created')
    if (!ok) return
    setName(''); setEmail(''); setPw(''); setErr('')
  }
  const roleSelect = (v: Role, on: (r: Role) => void, disabled = false) => (
    <select value={v} disabled={disabled || pending} onChange={e => on(e.target.value as Role)}>{ROLE_KEYS.map(k => <option key={k} value={k}>{ROLES[k].label}</option>)}</select>)
  return (
    <>
      <h1>Users &amp; Roles</h1>
      <p className="muted">Ang admin ang nag-aassign ng role at project access. Puwedeng bigyan ang Documents Officer ng Finance summary na view-only at naka-scope sa project.</p>
      <div className="card"><div className="row">
        <input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <PasswordInput placeholder="Temporary password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} />
        {roleSelect(role, setR)}
        {SCOPED.includes(role) && <select value={pj} onChange={e => setPj(e.target.value)} title="Assigned project">{activeSites.map(s => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}</select>}
        <Btn busy={pending} onClick={() => void add()}>+ Add user</Btn>
      </div>{pw && <Strength v={pw} />}{err && <p className="formerr">{err}</p>}</div>
      <div className="card scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Project</th><th>Finance summary (view-only)</th><th /></tr></thead>
        <tbody>{users.map(u => (
          <tr key={u.id}><td><span className="clock"><UserAvatar name={u.name} id={u.id} />{u.name}</span></td><td className="muted">{u.email}</td>
            <td>{roleSelect(u.role, r => { void run(() => setRole(u.id, r), 'Role updated') }, u.id === me?.id)}</td>
            <td>{SCOPED.includes(u.role) ? <select value={u.project ?? ''} disabled={pending} onChange={e => { const project = e.target.value; void run(() => setUserProject(u.id, project), 'Project access updated') }}><option value="">Unassigned</option>{sites.map(s => <option key={s.code} value={s.code}>{s.code}</option>)}</select> : <span className="muted">All</span>}</td>
            <td><select aria-label={`Finance summary access for ${u.name}`} value={u.role === 'documents' ? u.financeViewProject ?? '' : ''} disabled={pending || u.role !== 'documents'} onChange={e => { const scope = e.target.value; void run(() => setFinanceView(u.id, scope), 'Finance view updated') }}><option value="">No access</option><option value="all">All projects · summary only</option>{sites.map(s => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}</select></td>
            <td><span className="row">
              <button className="ghost sm" onClick={() => { const p = prompt(`New password for ${u.name} (min 12 characters)`, ''); if (p && p.length >= minPassword) void run(() => setPassword(u.id, p), 'Password updated') }}>Reset password</button>
              {u.id !== me?.id && <button className="ghost sm" onClick={() => confirm(`Remove ${u.name}?`) && void run(() => removeUser(u.id), backend === 'supabase' ? 'User access disabled' : 'User removed')}>Remove</button>}</span></td></tr>
        ))}</tbody></table></div>
    </>
  )
}

export function AuditPage() {
  const { log } = useStore()
  return (
    <>
      <h1>Audit log</h1><p className="muted">Huling 200 na actions.</p>
      <div className="card scroll"><table><thead><tr><th>When</th><th>Who</th><th>Action</th></tr></thead>
        <tbody>{log.map((l, i) => <tr key={i}><td className="muted">{l.at}</td><td>{l.by}</td><td>{l.msg}</td></tr>)}
          {!log.length && <tr><td colSpan={3} className="muted">Wala pang activity.</td></tr>}</tbody></table></div>
    </>
  )
}

export function ReportsPage() {
  const { me, data } = useStore()
  return (
    <>
      <h1>Reports</h1><p className="muted">Summary ng lahat ng modules. I-click ang card para buksan ang module.</p>
      <div className="kpis">{Object.values(MODULES).filter(m => !INTERNAL.includes(m.key)).map(m => {
        const rows = data[m.key] ?? []
        const counts: Record<string, number> = {}
        rows.forEach(r => { if (r.status) counts[r.status] = (counts[r.status] ?? 0) + 1 })
        const ok = !!me && NAV[me.role].includes(m.key)
        const body = (
          <><span className="muted up">{m.title}</span><b>{rows.length}</b>
            <div className="row">{Object.entries(counts).map(([st, c]) => <i className="chip" key={st}>{st}: {c}</i>)}</div>
            <span className="go">{ok ? 'Open →' : 'Not in your menu'}</span></>)
        return ok
          ? <a className="card kpi click" key={m.key} href={`#${m.key}`}>{body}</a>
          : <div className="card kpi locked" key={m.key} title="This module is not available for your role">{body}</div>
      })}</div>
    </>
  )
}

export function SettingsPage() {
  const { settings, setSettings, backend } = useStore()
  const toast = useToast()
  const [draft, setDraft] = useState(settings)
  const saveSettings = useAction()
  const [lat, setLat] = useState(getLatency() > 0)
  const num = (k: 'vat' | 'markup' | 'retention', label: string, hint: string) => (
    <label key={k}><span className="muted">{label}</span>
      <input type="number" min={0} max={100} value={draft[k]} onChange={e => setDraft({ ...draft, [k]: Math.min(100, Math.max(0, Number(e.target.value))) })} />
      <span className="muted hint">{hint}</span></label>)
  const [busy, setBusy] = useState(false)
  const backup = async () => {
    if (busy) return
    setBusy(true)
    try {
      const keys = ['tk_users_v3', 'tk_data_v6', 'tk_settings', 'tk_log', 'tk_proj', 'tk_read']
      const storage = Object.fromEntries(keys.map(k => {
        const raw = localStorage.getItem(k)
        return [k, raw === null ? null : JSON.parse(raw)]
      }))
      const files = await listFiles()
      const attachments = await Promise.all(files.map(async ({ id, blob }) => {
        const bytes = new Uint8Array(await blob.arrayBuffer())
        let binary = ''
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
        return { id, type: blob.type, size: blob.size, base64: btoa(binary) }
      }))
      const payload = { product: 'Tekton ECA', version: 1, createdAt: new Date().toISOString(), storage, attachments }
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'tekton-backup-' + new Date().toISOString().slice(0, 10) + '.json'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success('Backup downloaded - ' + attachments.length + ' uploaded file(s) included')
    } catch (e) {
      toast.error('Backup failed: ' + (e as Error).message)
    } finally { setBusy(false) }
  }
  const reset = async () => {
    if (!confirm('Reset Tekton ECA demo records, users, settings and uploaded files in this browser? Other site data will be kept.')) return
    if (busy) return
    setBusy(true)
    try {
      await deleteFileDatabase()
      ;['tk_users_v3', 'tk_data_v6', 'tk_settings', 'tk_log', 'tk_me_v2', 'tk_proj', 'tk_read', 'tk_latency', 'tk_sb', 'tk_soon', 'tk_sbg', 'tk_data_v3'].forEach(k => localStorage.removeItem(k))
      sessionStorage.removeItem('tk_me_v2')
      location.hash = ''
      location.reload()
    } catch (e) {
      setBusy(false)
      toast.error('Reset failed: ' + (e as Error).message)
    }
  }
  return (
    <>
      <h1>Settings</h1><p className="muted">Company defaults. Save changes to apply them.</p>
      <div className="g21">
        <div className="card form">
          <label><span className="muted">Company name</span><input value={draft.company} onChange={e => setDraft({ ...draft, company: e.target.value })} /><span className="muted hint">Shown in the app logo tooltip.</span></label>
          {num('vat', 'VAT %', 'Will be applied by the costing and quotation modules (not built yet).')}
          {num('markup', 'Default markup %', 'Default for project costing (not built yet).')}
          {num('retention', 'Retention %', 'Default for progress billing (not built yet).')}
          <Btn busy={saveSettings.pending} onClick={() => void saveSettings.run(() => setSettings(draft), 'Settings saved')}>Save settings</Btn>
        </div>
        <div className="card form">
          <h3>Data</h3>
          <p className="muted">{backend === 'supabase' ? 'Records are stored in Supabase. Manage database backups in the Supabase dashboard; uploaded files need a separate Storage backup.' : 'Demo data is stored in this browser.'}</p>
          {backend === 'demo' && <>
          <p className="muted hint">Backup includes accounts, project records, settings, audit history, and uploaded files. Keep the JSON private.</p>
          <label className="chk"><input type="checkbox" checked={lat} onChange={e => { setLat(e.target.checked); setLatency(e.target.checked); toast.info(e.target.checked ? 'Simulated network delay is on' : 'Simulated network delay is off') }} />Simulate network delay (shows splash, skeleton and loading states)</label>
          <div className="row"><button className="ghost" disabled={busy} onClick={backup}>{busy ? "Preparing backup..." : "Export backup (JSON)"}</button><button className="ghost danger" disabled={busy} onClick={reset}>Reset demo data</button></div></>}
        </div>
      </div>
    </>
  )
}
