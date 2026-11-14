import { useState, InputHTMLAttributes } from 'react'

const BAD = ['Overdue', 'Delayed', 'Over', 'Rejected', 'High', 'Expired', 'Repair', 'Open', 'Resigned', 'Denied', 'Returned']
const WARN = ['Pending', 'Warning', 'Review', 'Expiring', 'Draft', 'Medium', 'Expected', 'Todo', 'Maintenance']
export const tone = (v: string) => (BAD.includes(v) ? 'bad' : WARN.includes(v) ? 'warn' : '')

export function Avatar({ name, src, size }: { name: string; src?: string; size?: number }) {
  const ini = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const h = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 5
  const st = size ? { width: size, height: size, fontSize: Math.round(size * 0.38) } : undefined
  return <span className={`av av${h}`} style={st}>{src ? <img src={src} alt="" /> : ini}</span>
}

const P: Record<string, string> = {
  overview: 'M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z',
  projects: 'M4 20V8l8-4 8 4v12M9 20v-6h6v6M8 10h.01M12 10h.01M16 10h.01',
  approvals: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l3 3 5-6',
  documents: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  sitedocs: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M9 12l1.5 1.5L13 11M9 17h6',
  templates: 'M4 4h16v6H4zM4 14h7v6H4zM15 14h5v6h-5z',
  budgets: 'M12 3v9h9a9 9 0 1 1-9-9zM15 3.5A9 9 0 0 1 20.5 9H15z',
  assets: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  employees: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5a6.5 6.5 0 0 1 3.5 5.5',
  billing: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  'finance-view': 'M4 5h16v14H4zM8 9h8M8 13h5M8 17h3',
  reports: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3',
  audit: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  users: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  settings: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M10 10v4M16 16v4',
  tasks: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  incidents: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  attendance: 'M5 5h14v15H5zM5 9h14M9 3v4M15 3v4M9 14l2 2 4-4',
  deliveries: 'M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8',
  purchases: 'M3 4h2l2.5 11h10l2-8H6M9 20h.01M17 20h.01',
  cashadvance: 'M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l2-3h12M16 14h.01',
  progress: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  permits: 'M5 21h14M8 17h8M9 17V9a3 3 0 1 1 6 0v8',
  transfers: 'M7 4L3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7',
  payroll: 'M2 6h20v12H2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 10h.01M18 14h.01',
  leaves: 'M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9zM12 12v6a2 2 0 0 0 4 0',
  payments: 'M3 6h18v12H3zM3 10h18M7 15h4',
  expenses: 'M12 3v18M16 7.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.8 3 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  'chev-l': 'M11 7l-5 5 5 5M18 7l-5 5 5 5',
  'chev-r': 'M13 7l5 5-5 5M6 7l5 5-5 5',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeoff: 'M3 3l18 18M10.6 6.2A9.8 9.8 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 7.6C3.8 9.3 2 12 2 12s3.5 6 10 6c1.5 0 2.8-.3 4-.8M9.9 9.9a3 3 0 0 0 4.2 4.2',
  bell: 'M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0',
  check: 'M5 12.5l4.5 4.5L19 7',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  'chev-d': 'M6 9l6 6 6-6',
  alert: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  x: 'M6 6l12 12M18 6L6 18',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
}
export function Ic({ k, s = 18 }: { k: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[k] ?? P.overview} />
    </svg>
  )
}

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false)
  return (
    <span className="pwi">
      <input {...props} type={show ? 'text' : 'password'} />
      <button type="button" className="eye" aria-label={show ? 'Hide password' : 'Show password'} title={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}><Ic k={show ? 'eyeoff' : 'eye'} /></button>
    </span>
  )
}

export function Strength({ v }: { v: string }) {
  const score = Math.min(4, (v.length >= 6 ? 1 : 0) + (v.length >= 10 ? 1 : 0) + (/[A-Z]/.test(v) && /[a-z]/.test(v) ? 1 : 0) + (/\d/.test(v) && /[^A-Za-z0-9]/.test(v) ? 1 : 0))
  const label = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][score]
  return <div className={`str s${score}`}>{[1, 2, 3, 4].map(i => <i key={i} className={i <= score ? 'on' : ''} />)}<span className="muted">{label}</span></div>
}
