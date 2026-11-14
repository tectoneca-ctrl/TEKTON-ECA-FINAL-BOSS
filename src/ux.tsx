import { ButtonHTMLAttributes, Component, ReactNode, createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { Ic } from './ui'
import { LogoMark } from './Logo'

/* ===== network simulation (frontend-only). A real backend replaces the sleep with the actual request. ===== */
export const getLatency = () => { try { return localStorage.getItem('tk_latency') === 'off' ? 0 : 450 } catch { return 450 } }
export const setLatency = (on: boolean) => { try { localStorage.setItem('tk_latency', on ? 'on' : 'off') } catch { /* ignore */ } }
export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

/* ===== Spinner + Button with pending/disabled state ===== */
export const Spinner = ({ s = 14 }: { s?: number }) => <span className="spin" style={{ width: s, height: s }} role="status" aria-label="Loading" />
export function Btn({ busy, children, className = '', ...rest }: { busy?: boolean; children: ReactNode; className?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...rest} className={className} disabled={busy || rest.disabled} aria-busy={busy}>{busy && <Spinner />}{children}</button>
}

/* ===== Toasts ===== */
type Kind = 'success' | 'error' | 'info'
interface T { id: number; kind: Kind; msg: string; retry?: () => void }
interface ToastApi { success: (m: string) => void; error: (m: string, retry?: () => void) => void; info: (m: string) => void }
const ToastCtx = createContext<ToastApi>({ success() { /* noop */ }, error() { /* noop */ }, info() { /* noop */ } })
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([])
  const seq = useRef(0)
  const dismiss = useCallback((id: number) => setItems(x => x.filter(t => t.id !== id)), [])
  const push = useCallback((kind: Kind, msg: string, retry?: () => void) => {
    const id = ++seq.current
    setItems(x => [...x.filter(t => t.msg !== msg), { id, kind, msg, retry }].slice(-4))
    setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 3800)
  }, [dismiss])
  const api = useMemo<ToastApi>(() => ({ success: m => push('success', m), error: (m, r) => push('error', m, r), info: m => push('info', m) }), [push])
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map(t => (
          <div key={t.id} className={`toast ${t.kind}`} role="status">
            <Ic k={t.kind === 'success' ? 'check' : t.kind === 'error' ? 'alert' : 'info'} />
            <span>{t.msg}</span>
            {t.retry && <button className="ghost sm" onClick={() => { t.retry?.(); dismiss(t.id) }}>Retry</button>}
            <button className="x" aria-label="Dismiss" onClick={() => dismiss(t.id)}><Ic k="x" s={14} /></button>
          </div>))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ===== useAction: pending state + (simulated) latency + success toast + error toast with Retry ===== */
export function useAction() {
  const toast = useToast()
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  const run = async (fn: () => unknown, ok?: string, fail = 'Action failed'): Promise<boolean> => {
    if (busy.current) return false
    busy.current = true; setPending(true)
    try {
      const l = getLatency()
      if (l) await sleep(l)
      await fn()
      if (ok) toast.success(ok)
      return true
    } catch (e) {
      toast.error(`${fail}${e instanceof Error && e.message ? `: ${e.message}` : ''}`, () => { void run(fn, ok, fail) })
      return false
    } finally { busy.current = false; setPending(false) }
  }
  return { run, pending }
}

/* ===== Skeleton loaders ===== */
export const Sk = ({ w, h = 14, r = 8 }: { w?: number | string; h?: number; r?: number }) => <span className="sk" style={{ width: w ?? '100%', height: h, borderRadius: r }} />
export function PageSkeleton() {
  return (
    <>
      <div className="skhead"><Sk w={180} h={26} /><Sk w={280} h={12} /></div>
      <div className="card strip" aria-busy="true" aria-label="Loading">{[0, 1, 2, 3, 4].map(i => <div key={i}><Sk w={70} h={10} /><Sk w={96} h={28} /></div>)}</div>
      <div className="g2">{[0, 1].map(i => <div className="card skcard" key={i}><Sk w={140} h={14} /><Sk h={160} r={12} /></div>)}</div>
      <div className="g3">{[0, 1, 2].map(i => <div className="card skcard" key={i}><Sk w={120} h={14} />{[0, 1, 2, 3].map(j => <Sk key={j} h={12} />)}</div>)}</div>
    </>
  )
}

/* ===== Empty / Error / Success states ===== */
export function Empty({ icon = 'documents', title, hint, action }: { icon?: string; title: string; hint?: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="eico"><Ic k={icon} s={22} /></span><b>{title}</b>{hint && <span className="muted">{hint}</span>}{action}</div>
}
export function ErrorState({ title = 'Something went wrong', message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <div className="card"><div className="empty-state err"><span className="eico"><Ic k="alert" s={22} /></span><b>{title}</b>{message && <span className="muted">{message}</span>}
      <div className="row">{onRetry && <button onClick={onRetry}>Try again</button>}<a className="btn ghostbtn" href="#overview">Go to overview</a></div></div></div>
  )
}
export function SuccessState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="success-state"><svg viewBox="0 0 52 52" width="44" height="44" aria-hidden="true"><circle cx="26" cy="26" r="23" pathLength={1} /><path d="M15 27l8 8 14-16" pathLength={1} /></svg>
      <div><b>{title}</b>{hint && <span className="muted">{hint}</span>}</div>{action}</div>
  )
}
interface BProps { children: ReactNode; resetKey?: string }
interface BState { err: Error | null; key?: string }
export class PageBoundary extends Component<BProps, BState> {
  state: BState = { err: null, key: this.props.resetKey }
  static getDerivedStateFromError(err: Error): Partial<BState> { return { err } }
  static getDerivedStateFromProps(p: BProps, s: BState): Partial<BState> | null { return p.resetKey !== s.key ? { err: null, key: p.resetKey } : null }
  render() { return this.state.err ? <ErrorState message={this.state.err.message} onRetry={() => this.setState({ err: null })} /> : this.props.children }
}

/* ===== Progress bar (uploads) ===== */
export function ProgressBar({ value, state }: { value: number; state?: 'done' | 'err' }) {
  return <div className="pbar" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}><i className={state ?? ''} style={{ width: `${value}%` }} /><span>{Math.round(value)}%</span></div>
}

/* ===== Splash screen ===== */
export function Splash({ done }: { done: boolean }) {
  return (
    <div className={`splash ${done ? 'out' : ''}`} aria-hidden={done}>
      <div className="splash-grid" />
      <div className="splash-core">
        <div className="splash-halo" />
        <LogoMark size={150} animate />
        <div className="splash-word"><b>TEKTON ECA</b><span>CONSTRUCTION CORPORATION</span></div>
      </div>
      <div className="splash-foot"><div className="splash-bar"><i /></div><span>Loading your workspace</span></div>
    </div>
  )
}
