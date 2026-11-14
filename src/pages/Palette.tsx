import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, SCOPED } from '../store'
import { NAV, MODULES, titleOf } from '../modules'
import { Ic } from '../ui'
import { Empty } from '../ux'

interface Hit { id: string; title: string; sub: string; href: string; icon: string }

/** Ctrl/Cmd+K quick search over the pages and records this role is allowed to open. */
export function Palette({ onClose }: { onClose: () => void }) {
  const { me, data } = useStore()
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])

  const hits = useMemo<Hit[]>(() => {
    if (!me) return []
    const t = q.trim().toLowerCase()
    const pages: Hit[] = NAV[me.role].filter(k => !t || titleOf(k).toLowerCase().includes(t)).slice(0, t ? 6 : 10).map(k => ({ id: `p:${k}`, title: titleOf(k), sub: 'Page', href: `#${k}`, icon: k }))
    if (!t) return pages
    const scope = SCOPED.includes(me.role) ? me.project : undefined
    const recs: Hit[] = []
    for (const k of NAV[me.role]) {
      const def = MODULES[k]
      if (!def || recs.length >= 12) continue
      const hasProject = def.fields.some(f => f.type === 'project')
      const vis = def.fields.filter(f => !f.hidden)
      const tf = vis.find(f => f.type === 'text' || f.type === 'employee') ?? vis[0]
      for (const r of data[k] ?? []) {
        if (recs.length >= 12) break
        if (scope && hasProject && r.project !== scope) continue
        if (!vis.map(f => r[f.k] ?? '').join(' ').toLowerCase().includes(t)) continue
        const isProj = k === 'projects'
        recs.push({ id: `${k}:${r.id}`, title: isProj ? r.name : r[tf.k], sub: `${def.title}${isProj ? ` · ${r.code}` : r.project ? ` · ${r.project}` : ''}`, href: isProj ? `#project/${r.code}` : `#${k}`, icon: k })
      }
    }
    return [...pages, ...recs]
  }, [q, me, data])

  const go = (h?: Hit) => { if (!h) return; location.hash = h.href.slice(1); onClose() }
  const onKey = (e: { key: string; preventDefault: () => void }) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setI(Math.min(i + 1, hits.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI(Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') go(hits[i])
    else if (e.key === 'Escape') onClose()
  }
  return (
    <div className="pal-bg" onMouseDown={onClose}>
      <div className="pal" role="dialog" aria-label="Quick search" onMouseDown={e => e.stopPropagation()}>
        <div className="pal-in"><Ic k="search" /><input ref={ref} placeholder="Search pages, projects, invoices, people…" value={q} onChange={e => { setQ(e.target.value); setI(0) }} onKeyDown={onKey} /></div>
        <div className="pal-list">
          {hits.map((h, n) => (
            <button key={h.id} className={`pal-it ${n === i ? 'on' : ''}`} onMouseEnter={() => setI(n)} onClick={() => go(h)}>
              <Ic k={h.icon} /><span className="ph"><b>{h.title}</b><span>{h.sub}</span></span></button>))}
          {!hits.length && <Empty icon="search" title="No results" hint="Try a project name, invoice number or employee." />}
        </div>
        <div className="pal-foot"><span>↑ ↓ move</span><span>Enter open</span><span>Esc close</span></div>
      </div>
    </div>
  )
}
