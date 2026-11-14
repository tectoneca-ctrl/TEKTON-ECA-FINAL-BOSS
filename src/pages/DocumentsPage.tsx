import { DragEvent, useRef, useState } from 'react'
import { useStore, projectCodes } from '../store'
import { putFile, getFile, delFile } from '../filedb'
import { Ic, tone } from '../ui'
import { localDate } from '../metrics'
import { Empty, ProgressBar, SuccessState, getLatency, sleep, useToast } from '../ux'

const TYPES = ['Permit', 'Contract', 'Plan', 'Certificate']
const STATUSES = ['Review', 'Approved', 'Returned', 'Expired']
const OK = /\.(pdf|png|jpe?g|docx?|xlsx?|dwg|dxf)$/i
const MAX = 25 * 1024 * 1024
const size = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const today = localDate

interface Up { id: string; name: string; size: number; pct: number; state: 'up' | 'done' | 'err'; msg?: string; file: File; retry: boolean }
const readWithProgress = (f: File, on: (p: number) => void) => new Promise<void>((res, rej) => {
  const r = new FileReader()
  r.onprogress = e => { if (e.lengthComputable) on((e.loaded / e.total) * 85) }
  r.onload = () => { on(85); res() }
  r.onerror = () => rej(r.error)
  r.readAsArrayBuffer(f)
})

export function DocumentsPage({ readOnly }: { readOnly: boolean }) {
  const { me, data, add, update, remove } = useStore()
  const toast = useToast()
  const docs = data.documents ?? []
  const sites = projectCodes(data.projects ?? [])
  const [project, setProject] = useState(sites[0]?.code ?? 'P-001')
  const [type, setType] = useState(TYPES[0])
  const [expires, setExpires] = useState('')
  const [drag, setDrag] = useState(false)
  const [ups, setUps] = useState<Up[]>([])
  const [q, setQ] = useState('')
  const [flt, setFlt] = useState('All')
  const input = useRef<HTMLInputElement>(null)
  const patch = (id: string, p: Partial<Up>) => setUps(x => x.map(u => (u.id === id ? { ...u, ...p } : u)))

  const send = async (u: Up) => {
    patch(u.id, { pct: 2, state: 'up', msg: undefined })
    try {
      await readWithProgress(u.file, p => patch(u.id, { pct: p }))
      if (getLatency()) await sleep(250)
      const fid = `f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      await putFile(fid, u.file)
      add('documents', { title: u.file.name.replace(/\.[^.]+$/, ''), project, type, expires, status: 'Review', fileId: fid, fileName: u.file.name, size: String(u.file.size), mime: u.file.type, by: me?.name ?? '', date: today() }, true)
      patch(u.id, { pct: 100, state: 'done' })
      toast.success(`${u.file.name} uploaded · sent for review`)
    } catch {
      patch(u.id, { state: 'err', msg: 'Upload failed. Check your connection or storage space.', retry: true })
    }
  }
  const upload = (files: FileList | File[]) => {
    const list = Array.from(files).map<Up>(f => {
      const id = `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const bad = !OK.test(f.name) ? 'Unsupported file type' : f.size > MAX ? 'Larger than 25 MB' : undefined
      return { id, name: f.name, size: f.size, pct: bad ? 100 : 0, state: bad ? 'err' : 'up', msg: bad, file: f, retry: false }
    })
    if (!list.length) return
    setUps(x => [...list, ...x].slice(0, 8))
    list.filter(u => u.state === 'up').forEach(u => void send(u))
    if (input.current) input.current.value = ''
  }
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); if (!readOnly) upload(e.dataTransfer.files) }
  const view = async (id: string, download?: string) => {
    const b = await getFile(id)
    if (!b) return toast.error('File not found in this browser.')
    const u = URL.createObjectURL(b)
    if (download) { const a = document.createElement('a'); a.href = u; a.download = download; a.click() } else window.open(u, '_blank')
    setTimeout(() => URL.revokeObjectURL(u), 60000)
  }
  const del = async (id: string, fileId?: string) => {
    if (!confirm('Delete this document?')) return
    try { if (fileId) await delFile(fileId); remove('documents', id) } catch { toast.error('Could not delete the file.', () => void del(id, fileId)) }
  }
  const rows = docs.filter(d => (flt === 'All' || d.status === flt) && JSON.stringify(d).toLowerCase().includes(q.toLowerCase()))
  const allDone = ups.length > 0 && ups.every(u => u.state === 'done')

  return (
    <>
      <h1>Documents</h1>
      <p className="muted">{docs.length} records · {docs.filter(d => d.fileId).length} with uploaded files{readOnly ? ' · view only' : ''}</p>

      {!readOnly && (
        <div className="card">
          <div className="row">
            <select value={project} onChange={e => setProject(e.target.value)}>{sites.map(s => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}</select>
            <select value={type} onChange={e => setType(e.target.value)}>{TYPES.map(t => <option key={t}>{t}</option>)}</select>
            <label className="inl"><span className="muted">Expires</span><input type="date" value={expires} onChange={e => setExpires(e.target.value)} /></label>
          </div>
          <div className={`updz ${drag ? 'drag' : ''}`} onClick={() => input.current?.click()} onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={onDrop} role="button" tabIndex={0}>
            <Ic k="upload" s={28} />
            <b>Drop PDF or files here, or click to browse</b>
            <span className="muted">PDF, images, Word, Excel, DWG · up to 25 MB each · goes to Review after upload</span>
            <input ref={input} type="file" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.dwg,.dxf" onChange={e => e.target.files && upload(e.target.files)} />
          </div>
          {ups.length > 0 && (
            <div className="uplist">
              {ups.map(u => (
                <div className="upitem" key={u.id}>
                  <div className="upmeta"><b>{u.name}</b><span className="muted">{size(u.size)}{u.msg ? ` · ${u.msg}` : u.state === 'done' ? ' · Uploaded' : ' · Uploading…'}</span></div>
                  <ProgressBar value={u.pct} state={u.state === 'done' ? 'done' : u.state === 'err' ? 'err' : undefined} />
                  {u.state === 'err' && <span className="row">{u.retry && <button className="sm" onClick={() => void send(u)}>Retry</button>}<button className="ghost sm" onClick={() => setUps(x => x.filter(y => y.id !== u.id))}>Dismiss</button></span>}
                </div>))}
              {allDone && <SuccessState title="Upload complete" hint="Sent to the Documents officer for review." action={<button className="ghost sm" onClick={() => setUps([])}>Clear</button>} />}
            </div>
          )}
        </div>
      )}

      <div className="card toolbar">
        <input placeholder="Search documents…" value={q} onChange={e => setQ(e.target.value)} />
        <select value={flt} onChange={e => setFlt(e.target.value)}><option>All</option>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
      </div>
      <div className="card scroll">
        <table>
          <thead><tr><th>Document</th><th>Project</th><th>Type</th><th>Size</th><th>Uploaded</th><th>Expires</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map(d => (
              <tr key={d.id}>
                <td><span className="clock"><span className="ext">{(d.fileName?.split('.').pop() ?? 'rec').toUpperCase()}</span>{d.title}</span></td>
                <td>{d.project}</td><td className="muted">{d.type}</td>
                <td className="muted">{d.size ? size(Number(d.size)) : '—'}</td>
                <td className="muted">{d.by ? `${d.by.split(' ')[0]} · ${d.date}` : 'Sample record'}</td>
                <td className="muted">{d.expires || '—'}</td>
                <td>{readOnly ? <span className={`chip ${tone(d.status)}`}>{d.status}</span>
                  : <select className={`chip ${tone(d.status)}`} value={d.status} onChange={e => update('documents', d.id, { status: e.target.value })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>}</td>
                <td><span className="row">
                  <button className="ghost sm" disabled={!d.fileId} onClick={() => d.fileId && view(d.fileId)}>Open</button>
                  <button className="ghost sm" disabled={!d.fileId} onClick={() => d.fileId && view(d.fileId, d.fileName)}>Download</button>
                  {!readOnly && <button className="ghost sm" onClick={() => del(d.id, d.fileId)}>Delete</button>}</span></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8}><Empty icon="documents" title={docs.length ? 'No matches' : 'No documents yet'} hint={docs.length ? 'Try a different search or filter.' : readOnly ? 'Nothing has been shared with you yet.' : 'Upload the first file above.'} /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
