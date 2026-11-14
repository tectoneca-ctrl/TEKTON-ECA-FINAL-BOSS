import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { ROLES } from '../roles'
import { notifications, projectMetrics } from '../metrics'
import { Avatar, Ic } from '../ui'
import { Empty } from '../ux'
import { UserAvatar } from '../UserAvatar'

function useOutside(ref: { current: HTMLElement | null }, fn: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) fn() }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') fn() }
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  })
}

export function NotifBell() {
  const { me, data, proj, read, markRead } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(ref, () => setOpen(false))
  if (!me) return null
  const items = notifications(me.role, data, proj, projectMetrics(data))
  const unread = items.filter(i => !read.includes(i.id))
  return (
    <div className="pop" ref={ref}>
      <button className="ib" aria-label={`Notifications, ${unread.length} unread`} aria-expanded={open} title="Notifications" onClick={() => setOpen(!open)}>
        <Ic k="bell" />{unread.length > 0 && <i className="cnt">{unread.length > 9 ? '9+' : unread.length}</i>}
      </button>
      {open && (
        <div className="menu notif" role="dialog" aria-label="Notifications">
          <div className="mh"><b>Notifications</b>{unread.length > 0 && <button className="ghost sm" onClick={() => markRead(items.map(i => i.id))}>Mark all read</button>}</div>
          <div className="nlist">
            {items.map(i => (
              <a key={i.id} href={i.href} className={`ni ${read.includes(i.id) ? '' : 'new'}`} onClick={() => { markRead([i.id]); setOpen(false) }}>
                <i className={`nd t${i.tone}`} /><div><b>{i.title}</b><span className="muted">{i.sub}</span></div></a>))}
            {!items.length && <Empty icon="check" title="You’re all caught up" hint="New alerts will show here." />}
          </div>
        </div>
      )}
    </div>
  )
}

export function AvatarMenu() {
  const { me, logout } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(ref, () => setOpen(false))
  if (!me) return null
  const cfg = ROLES[me.role]
  return (
    <div className="pop" ref={ref}>
      <button className="avbtn" aria-label="Account menu" aria-expanded={open} title={me.name} onClick={() => setOpen(!open)}><UserAvatar name={me.name} id={me.id} /></button>
      {open && (
        <div className="menu umenu" role="menu">
          <div className="uhead"><UserAvatar name={me.name} id={me.id} size={40} /><div><b>{me.name}</b><span className="muted">{me.email}</span><span className="chip">{cfg.label}{me.project ? ` · ${me.project}` : ''}</span></div></div>
          <a className="mi" href="#profile" role="menuitem" onClick={() => setOpen(false)}><Ic k="users" />My profile</a>
          {me.role === 'admin' && <a className="mi" href="#settings" role="menuitem" onClick={() => setOpen(false)}><Ic k="settings" />Settings</a>}
          <button className="mi" role="menuitem" onClick={logout}><Ic k="logout" />Log out</button>
        </div>
      )}
    </div>
  )
}
