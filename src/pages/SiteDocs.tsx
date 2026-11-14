import { useState } from 'react'
import { useStore, Rec } from '../store'
import { TYPES, sections, siteStats, typeSummary, isBlank } from '../checklist'
import { Card, Strip, Prog } from './widgets'
import { Empty, useToast } from '../ux'
import { tone } from '../ui'
import { localDate } from '../metrics'

const EDIT = ['admin', 'documents']
const chip = (t: string) => <span className={`chip ${tone(t)}`}>{t}</span>

/** Category cards (SAQ1, SAQ2, CME, COLOC, RELOC). Used on the Documents dashboard and the Site documents page. */
export function TypeCards() {
  const { data } = useStore()
  return (
    <div className="tcards">{TYPES.map(t => {
      const s = typeSummary(data, t)
      return (
        <a className="tcard" key={t} href={`#sitedocs/${t}`}>
          <div className="th"><b>{t}</b><span className="muted">{s.sites} site{s.sites === 1 ? '' : 's'}</span></div>
          <div className="tp"><Prog v={s.pct} /><span>{s.items ? `${s.pct}%` : '—'}</span></div>
          <div className="tm"><span>{s.done}/{s.items} docs</span><span className={s.outed ? 'yl' : ''}>{s.outed}/{s.outs} OUT</span>{s.keyPending > 0 && <span className="rd">{s.keyPending} key pending</span>}</div>
        </a>)
    })}</div>
  )
}

function SiteTable({ sites }: { sites: Rec[] }) {
  const { data } = useStore()
  const [q, setQ] = useState('')
  const shown = sites.filter(p => `${p.code} ${p.name} ${p.client}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <div className="card toolbar"><input placeholder="Search site ID, name or client…" value={q} onChange={e => setQ(e.target.value)} /></div>
      <div className="card scroll">
        <table>
          <thead><tr><th>Site ID</th><th>Site name</th><th>Client</th><th>Type</th><th>Status</th><th>Documents</th><th>OUT</th></tr></thead>
          <tbody>
            {shown.map(p => {
              const st = siteStats((data.checklist ?? []).filter(r => r.project === p.code))
              return (
                <tr key={p.id} className="link" onClick={() => { location.hash = `sitedocs/${p.type}/${p.code}` }}>
                  <td><b>{p.code}</b></td><td>{p.name}<br /><span className="muted">{p.site}</span></td><td className="muted">{p.client}</td><td>{p.type}</td><td>{chip(p.status)}</td>
                  <td>{st.items ? <><Prog v={st.pct} bad={st.keyPending > 0 && st.pct < 50} /> {st.done}/{st.items}</> : <span className="muted">No checklist</span>}</td>
                  <td>{st.outs ? <span className={`chip ${st.outed ? 'warn' : 't'}`}>{st.outed}/{st.outs}</span> : <span className="muted">—</span>}</td>
                </tr>)
            })}
            {!shown.length && <tr><td colSpan={7}><Empty icon="projects" title="No sites here yet" hint="Create a project with this type under Projects." /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Home() {
  const { data } = useStore()
  return (
    <>
      <h1>Site documents</h1><p className="muted">Pumili ng kategorya para makita ang checklist ng bawat site.</p>
      <Card t="Categories"><TypeCards /></Card>
      <Card t="All sites"><p className="muted">{(data.projects ?? []).length} sites</p></Card>
      <SiteTable sites={data.projects ?? []} />
    </>
  )
}

function TypePage({ type }: { type: string }) {
  const { me, data } = useStore()
  const sites = (data.projects ?? []).filter(p => p.type === type)
  const s = typeSummary(data, type)
  const hasTpl = (data.templates ?? []).some(t => t.type === type && (t.label || t.out))
  return (
    <>
      <div className="head">
        <div><a className="muted" href="#sitedocs">← Site documents</a><h1>{type}</h1><p className="muted">{s.sites} site{s.sites === 1 ? '' : 's'} · checklist per site</p></div>
        {me && EDIT.includes(me.role) && <a className="btn ghostbtn" href="#templates">Edit templates</a>}
      </div>
      <Strip items={[['Sites', String(s.sites), '', ''], ['Documents done', `${s.done}/${s.items}`, s.items ? `${s.pct}%` : '', ''], ['OUT released', `${s.outed}/${s.outs}`, '', s.outed ? 'g' : ''], ['Key items pending', String(s.keyPending), '', s.keyPending ? 'a' : '']]} />
      {!hasTpl && <div className="card"><Empty icon="documents" title={`No ${type} checklist template yet`} hint="Add the sections and documents for this category in Checklist templates, then load them into each site." action={me && EDIT.includes(me.role) ? <a className="btn" href="#templates">Open templates</a> : undefined} /></div>}
      <SiteTable sites={sites} />
    </>
  )
}

interface Dlg { mode: 'add' | 'edit' | 'section' | 'rename'; rec?: Rec; section?: string }
const BLANK = { label: '', key: false, out: '', outKey: false, status: 'Pending', date: '', outStatus: 'Pending', outDate: '', remarks: '', tpl: false }
const short = (d: string) => (d ? d.slice(5) : '')

function Board({ code }: { code: string }) {
  const { me, data, add, update, remove } = useStore()
  const toast = useToast()
  const p = (data.projects ?? []).find(x => x.code === code)
  const rows = (data.checklist ?? []).filter(r => r.project === code)
  const [dlg, setDlg] = useState<Dlg | null>(null)
  const [form, setForm] = useState(BLANK)
  const [err, setErr] = useState('')
  const edit = !!me && EDIT.includes(me.role)
  if (!p) return <><h1>Site not found</h1><a className="btn" href="#sitedocs">Back to site documents</a></>
  const secs = sections(rows), st = siteStats(rows)
  const tplRows = (data.templates ?? []).filter(t => t.type === p.type)
  const nextOrder = Math.max(0, ...rows.map(r => Number(r.order) || 0)) + 1
  const tplOrder = Math.max(0, ...tplRows.map(t => Number(t.order) || 0)) + 1
  const uniq = (a: string[]) => Array.from(new Set(a.filter(Boolean)))
  const suggDoc = uniq([...tplRows.map(t => t.label), ...(data.checklist ?? []).map(r => r.label)])
  const suggOut = uniq([...tplRows.map(t => t.out), ...(data.checklist ?? []).map(r => r.out)])
  const suggSec = uniq([...tplRows.map(t => t.section), ...rows.map(r => r.section)])
  const isSec = !!dlg && (dlg.mode === 'section' || dlg.mode === 'rename')
  const upd = (r: Rec, v: Record<string, string>) => update('checklist', r.id, v, true)

  const load = () => {
    tplRows.forEach(t => add('checklist', { project: code, section: t.section, label: t.label, key: t.key, status: 'Pending', date: '', remarks: '', out: t.out, outKey: t.outKey, outStatus: 'Pending', outDate: '', order: t.order }, true))
    toast.success(`${p.type} checklist loaded`)
  }
  const toggleDoc = (r: Rec) => upd(r, r.status === 'Done' ? { status: 'Pending', date: '' } : { status: 'Done', date: localDate() })
  const toggleOut = (r: Rec, ready: boolean) => {
    if (r.outStatus === 'Out') return upd(r, { outStatus: 'Pending', outDate: '' })
    upd(r, { outStatus: 'Out', outDate: localDate() })
    toast.success(`${r.out} released (OUT)`)
    if (!ready) toast.info(r.label ? `${r.label} is not marked done yet` : 'Some documents in this section are still pending')
  }
  const open = (d: Dlg) => {
    const r = d.rec
    setErr(''); setDlg(d)
    setForm({ ...BLANK, label: d.mode === 'rename' ? d.section ?? '' : r?.label ?? '', key: r?.key === 'yes', out: r?.out ?? '', outKey: r?.outKey === 'yes', status: r?.status ?? 'Pending', date: r?.date ?? '', outStatus: r?.outStatus ?? 'Pending', outDate: r?.outDate ?? '', remarks: r?.remarks ?? '' })
  }
  const move = (r: Rec, dir: -1 | 1) => {
    const list = rows.filter(x => x.section === r.section).sort((a, b) => Number(a.order) - Number(b.order))
    const o = list[list.findIndex(x => x.id === r.id) + dir]
    if (!o) return
    upd(r, { order: o.order }); upd(o, { order: r.order })
  }
  const save = () => {
    if (!dlg) return
    const name = form.label.trim(), out = form.out.trim()
    if (isSec && !name) return setErr('Section name is required.')
    if (!isSec && !name && !out) return setErr('Enter a document, an OUT, or both.')
    const dupe = (section: string, label: string, skip?: string) => !!label && rows.some(r => r.id !== skip && r.section === section && r.label.toLowerCase() === label.toLowerCase())
    if (dlg.mode === 'edit' && dlg.rec) {
      if (dupe(dlg.rec.section, name, dlg.rec.id)) return setErr('That document already exists in this section.')
      const doneDate = form.status === 'Done' ? form.date || localDate() : ''
      const outDate = form.outStatus === 'Out' ? form.outDate || localDate() : ''
      upd(dlg.rec, { label: name, key: form.key ? 'yes' : 'no', status: name ? form.status : 'Pending', date: name ? doneDate : '', remarks: form.remarks, out, outKey: form.outKey ? 'yes' : 'no', outStatus: out ? form.outStatus : 'Pending', outDate: out ? outDate : '' })
    } else if (dlg.mode === 'add') {
      const section = dlg.section ?? ''
      if (dupe(section, name)) return setErr('That document already exists in this section.')
      add('checklist', { project: code, section, label: name, key: form.key ? 'yes' : 'no', status: 'Pending', date: '', remarks: form.remarks, out, outKey: form.outKey ? 'yes' : 'no', outStatus: 'Pending', outDate: '', order: String(nextOrder) }, true)
      if (form.tpl && !tplRows.some(t => t.section === section && t.label.toLowerCase() === name.toLowerCase() && t.out.toLowerCase() === out.toLowerCase())) add('templates', { type: p.type, section, label: name, key: form.key ? 'yes' : 'no', out, outKey: form.outKey ? 'yes' : 'no', order: String(tplOrder) }, true)
    } else if (dlg.mode === 'rename') {
      const old = dlg.section ?? ''
      if (name !== old && secs.some(x => x.name.toLowerCase() === name.toLowerCase())) return setErr('A section with that name already exists.')
      rows.filter(r => r.section === old).forEach(r => upd(r, { section: name }))
      if (form.tpl) tplRows.filter(t => t.section === old).forEach(t => update('templates', t.id, { section: name }, true))
    } else {
      if (secs.some(x => x.name.toLowerCase() === name.toLowerCase())) return setErr('That section already exists.')
      add('checklist', { project: code, section: name, label: '', key: 'no', status: 'Pending', date: '', remarks: '', out: '', outKey: 'no', outStatus: 'Pending', outDate: '', order: String(nextOrder) }, true)
      if (form.tpl && !tplRows.some(t => t.section === name)) add('templates', { type: p.type, section: name, label: '', key: 'no', out: '', outKey: 'no', order: String(tplOrder) }, true)
    }
    toast.success('Saved'); setDlg(null)
  }
  const delRow = () => {
    const r = dlg?.rec
    if (!r || !confirm('Remove this row from the checklist?')) return
    if (rows.filter(x => x.section === r.section).length === 1) upd(r, { label: '', out: '', key: 'no', outKey: 'no', status: 'Pending', date: '', outStatus: 'Pending', outDate: '', remarks: '' })
    else remove('checklist', r.id, true)
    toast.success('Removed'); setDlg(null)
  }
  const delSection = (name: string) => {
    const n = rows.filter(r => r.section === name).length
    if (!confirm(`Delete "${name}" and its ${n} row(s) from this site?`)) return
    rows.filter(r => r.section === name).forEach(r => remove('checklist', r.id, true))
    toast.success('Section removed')
  }
  const saveTpl = () => {
    if (!confirm(`Replace the ${p.type} template with this site's checklist? Other sites keep what they already have.`)) return
    tplRows.forEach(t => remove('templates', t.id, true))
    ;[...rows].sort((a, b) => Number(a.order) - Number(b.order)).forEach((r, i) => add('templates', { type: p.type, section: r.section, label: r.label, key: r.key, out: r.out, outKey: r.outKey, order: String(i + 1) }, true))
    toast.success(`${p.type} template updated`)
  }

  return (
    <>
      <div className="head">
        <div><a className="muted" href={`#sitedocs/${p.type}`}>← {p.type}</a><h1>{p.name}</h1><p className="muted">Site ID {p.code} · {p.client} · {p.site}</p></div>
        <div className="row">{chip(p.status)}{edit && rows.length > 0 && <button className="ghost" onClick={saveTpl} title={`Use this site's checklist as the ${p.type} template`}>Save as template</button>}<a className="btnlink" href={`#project/${p.code}`}>Project page</a></div>
      </div>
      <Strip items={[['Documents', `${st.done}/${st.items}`, st.items ? `${st.pct}%` : '', st.pct === 100 ? 'g' : ''], ['OUT released', `${st.outed}/${st.outs}`, '', st.outed ? 'g' : ''], ['Key items pending', String(st.keyPending), '', st.keyPending ? 'a' : ''], ['Sections complete', `${secs.filter(s => s.ready).length}/${secs.length}`, '', '']]} />

      {!rows.length ? (
        <div className="card"><Empty icon="documents" title="No checklist for this site yet" hint={edit ? `Load the ${p.type} template, or start blank and add your own sections and rows.` : 'The Documents team has not set up this checklist yet.'}
          action={edit ? <span className="row">{tplRows.length > 0 && <button onClick={load}>Load {p.type} template</button>}<button className={tplRows.length ? 'ghost' : ''} onClick={() => open({ mode: 'section' })}>Start blank · add a section</button></span> : undefined} /></div>
      ) : (
        <div className="xboard">
          {secs.map(s => (
            <div className="xs" key={s.name}>
              <div className="xh"><div><b>{s.name}</b><span className="muted">{s.docs ? `${s.done}/${s.docs} documents` : 'No documents'}</span></div><span className="xcol">OUT</span></div>
              {s.rows.filter(r => !isBlank(r)).map(r => {
                const ready = r.label ? r.status === 'Done' : s.ready
                return (
                  <div className="xr" key={r.id}>
                    <div className={`xd ${r.status === 'Done' ? 'done' : ''} ${r.key === 'yes' ? 'key' : ''}`}>
                      {r.label && <button className="cbx" disabled={!edit} aria-pressed={r.status === 'Done'} aria-label={`Mark ${r.label} done`} onClick={() => toggleDoc(r)}>{r.status === 'Done' && '✓'}</button>}
                      <span className="xl" title={r.remarks ? `${r.label}: ${r.remarks}` : r.label}>{r.label}</span>
                      {r.status === 'Done' && <i className="cd" title={r.date}>{short(r.date)}</i>}
                      {edit && <button className="xe" aria-label="Edit row" title="Edit row" onClick={() => open({ mode: 'edit', rec: r })}>✎</button>}
                    </div>
                    <div className="xo">
                      {r.out && <button disabled={!edit} className={`out ${r.outStatus === 'Out' ? 'on' : ''} ${ready ? 'ready' : ''} ${r.outKey === 'yes' ? 'key' : ''}`} onClick={() => toggleOut(r, ready)} title={r.outStatus === 'Out' ? `Released ${r.outDate}` : 'Click to release'}><span>{r.out}</span>{r.outStatus === 'Out' && <small>{short(r.outDate)}</small>}</button>}
                    </div>
                  </div>)
              })}
              {!s.rows.some(r => !isBlank(r)) && <div className="xr xnone"><div className="xd muted">No rows yet</div><div className="xo" /></div>}
              {edit && <div className="xf"><button className="ghost sm" onClick={() => open({ mode: 'add', section: s.name })}>+ Row</button><span className="grow" /><button className="ghost sm" onClick={() => open({ mode: 'rename', section: s.name })}>Rename</button><button className="ghost sm danger" onClick={() => delSection(s.name)}>Delete</button></div>}
            </div>))}
          {edit && <button className="xadd" onClick={() => open({ mode: 'section' })}>+ Section</button>}
        </div>
      )}

      {dlg && (
        <div className="modal" onClick={() => setDlg(null)}>
          <div className="card" onClick={e => e.stopPropagation()}>
            <h3>{dlg.mode === 'section' ? 'New section' : dlg.mode === 'rename' ? 'Rename section' : dlg.mode === 'add' ? `New row · ${dlg.section}` : 'Edit row'}</h3>
            <label><span className="muted">{isSec ? 'Section name' : 'Document'}</span>
              <input autoFocus list={isSec ? 'ck-sec' : 'ck-doc'} value={form.label} placeholder={isSec ? 'e.g. SAQ2 - Permitting' : 'Document name (leave empty for an OUT-only row)'} onChange={e => setForm({ ...form, label: e.target.value })} /></label>
            {!isSec && <>
              <label className="chk"><input type="checkbox" checked={form.key} onChange={e => setForm({ ...form, key: e.target.checked })} />Key document (shown in red)</label>
              <label><span className="muted">OUT released by this row</span><input list="ck-out" value={form.out} placeholder="Optional, e.g. BP" onChange={e => setForm({ ...form, out: e.target.value })} /></label>
              {form.out.trim() && <label className="chk"><input type="checkbox" checked={form.outKey} onChange={e => setForm({ ...form, outKey: e.target.checked })} />Key OUT (shown in red)</label>}
              {dlg.mode === 'edit' && <div className="g2f">
                {form.label.trim() && <label><span className="muted">Document status</span><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>Pending</option><option>Done</option></select></label>}
                {form.out.trim() && <label><span className="muted">OUT status</span><select value={form.outStatus} onChange={e => setForm({ ...form, outStatus: e.target.value })}><option>Pending</option><option>Out</option></select></label>}
              </div>}
              <label><span className="muted">Remarks</span><input value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} placeholder="Optional note" /></label>
            </>}
            {dlg.mode !== 'edit' && <label className="chk"><input type="checkbox" checked={form.tpl} onChange={e => setForm({ ...form, tpl: e.target.checked })} />{dlg.mode === 'rename' ? `Also rename it in the ${p.type} template` : `Also add it to the ${p.type} template (new sites will get it)`}</label>}
            <datalist id="ck-doc">{suggDoc.map(x => <option key={x} value={x} />)}</datalist>
            <datalist id="ck-out">{suggOut.map(x => <option key={x} value={x} />)}</datalist>
            <datalist id="ck-sec">{suggSec.map(x => <option key={x} value={x} />)}</datalist>
            {err && <p className="formerr">{err}</p>}
            <div className="row end">
              {dlg.mode === 'edit' && dlg.rec && <><button className="ghost sm" title="Move up" onClick={() => dlg.rec && move(dlg.rec, -1)}>↑</button><button className="ghost sm" title="Move down" onClick={() => dlg.rec && move(dlg.rec, 1)}>↓</button><button className="ghost danger" onClick={delRow}>Remove</button></>}
              <span className="grow" /><button className="ghost" onClick={() => setDlg(null)}>Cancel</button><button onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function SiteDocsPage({ type, site }: { type?: string; site?: string }) {
  if (!type) return <Home />
  if (!TYPES.includes(type)) return <><h1>Category not found</h1><a className="btn" href="#sitedocs">Back to site documents</a></>
  if (!site) return <TypePage type={type} />
  return <Board code={site} />
}
