import { useEffect, useState } from 'react'
import { ROLES } from './roles'
import { NAV, READ_ONLY, MODULES, GROUPS, can, titleOf } from './modules'
import { StoreProvider, useStore } from './store'
import { Overview } from './pages/Overview'
import { ModulePage } from './pages/ModulePage'
import { DocumentsPage } from './pages/DocumentsPage'
import { ProjectPage } from './pages/ProjectPage'
import { SiteDocsPage } from './pages/SiteDocs'
import { FinanceView } from './pages/FinanceView'
import { UsersPage, AuditPage, ReportsPage, SettingsPage } from './pages/Admin'
import { Avatar, Ic } from './ui'
import { Logo, LogoMark } from './Logo'
import { UserAvatar } from './UserAvatar'
import { Login } from './pages/Login'
import { ToastProvider, Splash, PageSkeleton, PageBoundary, getLatency } from './ux'
import { NotifBell, AvatarMenu } from './pages/TopBar'
import { ProfilePage } from './pages/Profile'
import { Palette } from './pages/Palette'

const useHash = () => {
  const read = () => location.hash.slice(1) || 'overview'
  const [h, setH] = useState(read)
  useEffect(() => { const f = () => setH(read()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  return h
}
const OPEN = ['Pending', 'Open', 'Review']
const COMING_SOON = [
  'Estimating & BOQ / quotation',
  'Change orders',
  'Progress billing with retention',
  'Purchase orders & receiving',
  'Statutory payroll & payslips',
  'Daily site reports',
  'Material inventory',
  'Multi-level approvals',
  'Schedule / Gantt',
  'Accounting export',
  'E-signatures',
  'Offline / PWA',
]
const groupsFor = (keys: string[]) => keys.length <= 7 ? [{ label: '', keys }] : [{ label: '', keys: ['overview'] }, ...GROUPS.map(g => ({ label: g.label, keys: g.keys.filter(k => keys.includes(k)) })).filter(g => g.keys.length)]

function Shell() {
  const { me, data, logout, settings, proj } = useStore()
  const page = useHash()
  const [clock] = useState(() => new Date().toLocaleString('en', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).toUpperCase())
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('tk_sb') === 'open' } catch { return false } })
  const toggle = () => setOpen(o => { const n = !o; try { localStorage.setItem('tk_sb', n ? 'open' : 'closed') } catch { /* ignore */ } return n })
  const [soonOpen, setSoonOpen] = useState(() => { try { return localStorage.getItem('tk_soon') === 'open' } catch { return false } })
  const toggleSoon = () => setSoonOpen(o => { const n = !o; try { localStorage.setItem('tk_soon', n ? 'open' : 'closed') } catch { /* ignore */ } return n })

  const [shut, setShut] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('tk_sbg') || '[]') as string[] } catch { return [] } })
  const flip = (l: string) => setShut(s => { const n = s.includes(l) ? s.filter(x => x !== l) : [...s, l]; try { localStorage.setItem('tk_sbg', JSON.stringify(n)) } catch { /* ignore */ } return n })
  const [pal, setPal] = useState(false)
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPal(true) } }
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k)
  }, [])
  useEffect(() => {
    if (!me) return
    const g = groupsFor(NAV[me.role]).find(x => x.label && x.keys.includes(page.split('/')[0]))
    if (g) setShut(s => (s.includes(g.label) ? s.filter(x => x !== g.label) : s))
  }, [page, me?.role])
  const [loading, setLoading] = useState(false)
  useEffect(() => { const l = getLatency(); if (!l) return; setLoading(true); const t = setTimeout(() => setLoading(false), Math.min(l, 380)); return () => clearTimeout(t) }, [page, proj, me?.id])
  if (!me) return <Login />

  const cfg = ROLES[me.role]
  const [root, arg, arg2] = page.split('/')
  const readOnly = READ_ONLY.includes(me.role)
  const badge = (k: string) => (data[k] ?? []).filter(r => OPEN.includes(r.status)).length
  const link = (n: string) => (
    <a key={n} href={`#${n}`} title={titleOf(n)} className={n === root ? 'on' : ''}><Ic k={n} /><span className="lbl">{titleOf(n)}</span>{badge(n) > 0 && <i className="bdg">{badge(n)}</i>}</a>)
  let view
  if (root === 'project') view = <ProjectPage code={arg ?? ''} />
  else if (root === 'sitedocs') view = can(me.role, 'sitedocs') ? <SiteDocsPage type={arg} site={arg2} /> : <><h1>Access denied</h1><div className="card muted">Walang access ang role na {cfg.label} sa page na ito.</div></>
  else if (page === 'profile') view = <ProfilePage />
  else if (page === 'finance-view' && me.role === 'documents' && me.financeViewProject) view = <FinanceView />
  else if (!can(me.role, page)) view = <><h1>Access denied</h1><div className="card muted">Walang access ang role na {cfg.label} sa page na ito.</div></>
  else if (page === 'overview') view = <Overview role={me.role} name={me.name} />
  else if (page === 'users') view = <UsersPage />
  else if (page === 'audit') view = <AuditPage />
  else if (page === 'reports') view = <ReportsPage />
  else if (page === 'settings') view = <SettingsPage />
  else if (page === 'documents') view = <DocumentsPage readOnly={readOnly} />
  else if (MODULES[page]) view = <ModulePage key={page} k={page} readOnly={readOnly} />
  else view = <h1>Not found</h1>

  const nav = me.role === 'documents' && me.financeViewProject ? [...NAV[me.role], 'finance-view'] : NAV[me.role]
  const groups = groupsFor(nav)
  const mobile = typeof matchMedia !== 'undefined' && matchMedia('(max-width:820px)').matches
  return (
    <div className={`shell ${open ? 'open' : ''}`}>
      <aside>
        <div className="sbtop">
          <a className="brandlink" href="#overview" title={`${settings.company} · ${cfg.sub}`}>{open ? <Logo size={28} /> : <LogoMark size={34} />}</a>
          <button className="sbtog" onClick={toggle} aria-expanded={open} aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'} title={open ? 'Collapse sidebar' : 'Expand sidebar'}><Ic k={open ? 'chev-l' : 'chev-r'} /></button>
        </div>
        {groups.map(g => {
          const closed = !mobile && open && !!g.label && shut.includes(g.label)
          const cnt = g.keys.reduce((a, k) => a + badge(k), 0)
          return (
            <div className="sg" key={g.label || 'top'}>
              {g.label ? (open && !mobile
                ? <button className="grp gbtn" aria-expanded={!closed} onClick={() => flip(g.label)}><span>{g.label}</span>{closed && cnt > 0 && <i className="bdg">{cnt}</i>}<Ic k="chev-d" s={12} /></button>
                : <span className="grp" />) : null}
              {!closed && <nav>{g.keys.map(link)}</nav>}
            </div>)
        })}
        {me.role === 'admin' && <div className="sg soon-group">
          {open || mobile
            ? <button className="grp gbtn soon-heading" aria-expanded={soonOpen} aria-controls="coming-soon-links" onClick={toggleSoon}>
                <span>COMING SOON</span><Ic k="chev-d" s={12} />
              </button>
            : <span className="grp" title="Coming soon features" />}
          {soonOpen && (open || mobile) && <nav id="coming-soon-links" aria-label="Coming soon features">
            {COMING_SOON.map(item => <div className="soon-link" key={item} aria-disabled="true" title={`${item} — Coming soon`}>
              <Ic k="info" s={15} />
              <span className="lbl">{item}</span>
              <span className="soon-status">SOON</span>
            </div>)}
          </nav>}
        </div>}
        <div className="qa"><div className="row" title={`${me.name} · ${cfg.label}`}><UserAvatar name={me.name} id={me.id} /><div className="lbl"><b>{me.name}</b><span className="muted">{cfg.label}</span></div></div>
          <button className="ghost" onClick={logout} title="Log out" aria-label="Log out"><Ic k="logout" /><span className="lbl">Log out</span></button></div>
      </aside>
      <div className="body">
        <header className="top">
          <button className="search" onClick={() => setPal(true)} aria-label="Search"><Ic k="search" s={16} /><span>Search pages, projects, people…</span><kbd>Ctrl K</kbd></button>
          <span className="spacer" /><span className="pill">● {clock}</span>
          <NotifBell /><AvatarMenu />
        </header>
        <main>{loading ? <PageSkeleton /> : <PageBoundary resetKey={page}>{view}</PageBoundary>}</main>
      </div>
      {pal && <Palette onClose={() => setPal(false)} />}
    </div>
  )
}

export default function App() {
  const [booting, setBooting] = useState(true)
  const [gone, setGone] = useState(false)
  useEffect(() => {
    const fast = !getLatency()
    const a = setTimeout(() => setBooting(false), fast ? 250 : 1200), b = setTimeout(() => setGone(true), fast ? 700 : 1700)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [])
  return <ToastProvider><StoreProvider><Shell />{!gone && <Splash done={!booting} />}</StoreProvider></ToastProvider>
}
