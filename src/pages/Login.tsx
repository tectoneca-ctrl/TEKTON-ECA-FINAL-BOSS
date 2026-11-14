import { isCloud } from '../backend/client'
import { FormEvent, type KeyboardEvent, useEffect, useState } from 'react'
import { DEMO_USERS, useStore } from '../store'
import { ROLES } from '../roles'
import { Ic, PasswordInput } from '../ui'
import { Logo } from '../Logo'
import { Btn, SuccessState, getLatency, sleep } from '../ux'
import { UserAvatar } from '../UserAvatar'

/** Demo build only: set to false before going live so the demo accounts panel disappears. */
const SHOW_DEMO = !isCloud
const MAX_TRIES = 5
const LOCK_SECONDS = 30
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PITCH: [string, string, string][] = [
  ['projects', 'Projects and progress', 'Milestones, tasks and deliveries for every site.'],
  ['billing', 'Billing and cost control', 'Budget vs actual, invoices and collections.'],
  ['attendance', 'Crew and payroll', 'Daily attendance with approval, payroll from approved days.'],
]

export function Login() {
  const { login, requestReset } = useStore()
  const [mode, setMode] = useState<'in' | 'reset' | 'sent'>('in')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [remember, setRemember] = useState(true)
  const [emailErr, setEmailErr] = useState('')
  const [pwErr, setPwErr] = useState('')
  const [formErr, setFormErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [caps, setCaps] = useState(false)
  const [tries, setTries] = useState(0)
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [demo, setDemo] = useState(false)
  const left = Math.max(0, Math.ceil((until - now) / 1000))

  useEffect(() => {
    if (!until) return
    const t = setInterval(() => { const n = Date.now(); setNow(n); if (n >= until) { setUntil(0); setTries(0); setFormErr('') } }, 400)
    return () => clearInterval(t)
  }, [until])

  const shake = () => { setShaking(true); setTimeout(() => setShaking(false), 450) }
  const checkEmail = () => (!email.trim() ? 'Enter your work email.' : !EMAIL.test(email.trim()) ? 'Enter a valid email address.' : '')
  const wait = (ms: number) => sleep(getLatency() ? ms : 150)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || ok || left > 0) return
    setFormErr('')
    const ee = checkEmail(), pe = pw ? '' : 'Enter your password.'
    setEmailErr(ee); setPwErr(pe)
    if (ee || pe) return shake()
    setBusy(true)
    await wait(700)
    try {
      if (await login(email, pw, remember)) {
        setOk(true); location.hash = 'overview'; return
      }
    } catch (error) {
      setBusy(false); shake()
      setFormErr(error instanceof Error ? error.message : 'Sign in failed. Try again.')
      return
    }
    const t = tries + 1
    setTries(t); setBusy(false); shake()
    if (t >= MAX_TRIES) { const u = Date.now() + LOCK_SECONDS * 1000; setUntil(u); setNow(Date.now()); setFormErr('Too many failed attempts.') }
    else setFormErr(`Incorrect email or password. ${MAX_TRIES - t} attempt${MAX_TRIES - t === 1 ? '' : 's'} left.`)
  }
  const submitReset = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const ee = checkEmail()
    setEmailErr(ee)
    if (ee) return shake()
    setBusy(true)
    await wait(600)
    try { await requestReset(email); setMode('sent') }
    catch (e) { setFormErr((e as Error).message) }
    finally { setBusy(false) }
  }
  const caps$ = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState('CapsLock'))
  const back = () => { setMode('in'); setEmailErr(''); setFormErr('') }

  return (
    <div className="lgn">
      <section className="lgn-hero">
        <div className="lgn-grid" />
        <Logo size={46} animate />
        <div className="lgn-pitch">
          <h2>Every site, budget and payroll in one workspace.</h2>
          <p>Project cost control, billing and collections, attendance and documents for Tekton ECA’s office and field teams.</p>
          <ul>{PITCH.map(([k, t, d]) => <li key={k}><span className="lgn-ico"><Ic k={k} /></span><div><b>{t}</b><span>{d}</span></div></li>)}</ul>
        </div>
        <footer>© {new Date().getFullYear()} Tekton ECA Construction Corporation</footer>
      </section>

      <section className="lgn-side">
        <div className="lgn-mobile-brand"><Logo size={38} animate /></div>

        {mode === 'in' && (
          <form className={`card lgn-card ${shaking ? 'shake' : ''}`} onSubmit={submit} noValidate aria-busy={busy}>
            <header><h1>Sign in</h1><p className="muted">Use your Tekton ECA work account.</p></header>
            <label className="fld"><span>Work email</span>
              <input type="email" inputMode="email" autoComplete="username" placeholder="name@company.ph" value={email} aria-invalid={!!emailErr} aria-describedby="lg-e" autoFocus
                onChange={e => { setEmail(e.target.value); setEmailErr('') }} />
              {emailErr && <em className="ferr" id="lg-e">{emailErr}</em>}</label>
            <label className="fld"><span>Password</span>
              <PasswordInput autoComplete="current-password" placeholder="Enter your password" value={pw} aria-invalid={!!pwErr} aria-describedby="lg-p"
                onChange={e => { setPw(e.target.value); setPwErr('') }} onKeyUp={caps$} onKeyDown={caps$} onBlur={() => setCaps(false)} />
              {pwErr && <em className="ferr" id="lg-p">{pwErr}</em>}
              {caps && <em className="fwarn">Caps Lock is on</em>}</label>
            <div className="lgn-row">
              <label className="chk"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />Keep me signed in on this device</label>
              <button type="button" className="linkbtn" onClick={() => { setMode('reset'); setFormErr('') }}>Forgot password?</button>
            </div>
            <div aria-live="polite">{formErr && <div className="lgn-alert" role="alert"><Ic k="alert" s={16} /><span>{formErr}{left > 0 ? ` Try again in ${left}s.` : ''}</span></div>}</div>
            <Btn className={`lgn-submit ${ok ? 'ok' : ''}`} busy={busy && !ok} disabled={left > 0}>
              {ok ? <><Ic k="check" s={16} /> Signed in</> : busy ? 'Signing in…' : left > 0 ? `Locked · ${left}s` : 'Sign in'}</Btn>
            <p className="muted lgn-help">Need access? Ask your administrator to create your account.</p>

            {SHOW_DEMO && (
              <div className="lgn-demo">
                <button type="button" className="demo-toggle" aria-expanded={demo} onClick={() => setDemo(!demo)}><span>Demo accounts</span><Ic k="chev-d" s={14} /></button>
                {demo && <>
                  <p className="demo-note">Demo build only. Click a row to fill the form.</p>
                  <div className="demo-list">{DEMO_USERS.map(u => (
                    <button type="button" key={u.id} onClick={() => { setEmail(u.email); setPw(u.password); setEmailErr(''); setPwErr(''); setFormErr('') }}>
                      <UserAvatar name={u.name} id={u.id} /><span><b>{ROLES[u.role].label}</b><i className="muted">{u.email}</i></span><code>{u.password}</code></button>))}</div>
                </>}
              </div>
            )}
          </form>
        )}

        {mode === 'reset' && (
          <form className={`card lgn-card ${shaking ? 'shake' : ''}`} onSubmit={submitReset} noValidate>
            <header><h1>Reset password</h1><p className="muted">{isCloud ? 'Enter your work email to receive a password reset link.' : 'Enter your work email. Your administrator will be notified and will set a new password for you.'}</p></header>
            <label className="fld"><span>Work email</span>
              <input type="email" inputMode="email" autoComplete="username" placeholder="name@company.ph" value={email} aria-invalid={!!emailErr} autoFocus onChange={e => { setEmail(e.target.value); setEmailErr('') }} />
              {emailErr && <em className="ferr">{emailErr}</em>}</label>
            <div role="alert">{formErr}</div><Btn className="lgn-submit" busy={busy}>{busy ? 'Sending…' : 'Send request'}</Btn>
            <button type="button" className="linkbtn center" onClick={back}>← Back to sign in</button>
          </form>
        )}

        {mode === 'sent' && (
          <div className="card lgn-card">
            <SuccessState title="Request sent" hint={isCloud ? 'If that email belongs to an account, check its inbox for a reset link.' : 'If that email belongs to an account, your administrator has been notified.'} />
            <button type="button" className="lgn-submit" onClick={back}>Back to sign in</button>
          </div>
        )}

        <p className="lgn-foot">{SHOW_DEMO ? 'Demo build · data is stored in this browser only.' : '© Tekton ECA Construction Corporation'}</p>
      </section>
    </div>
  )
}
