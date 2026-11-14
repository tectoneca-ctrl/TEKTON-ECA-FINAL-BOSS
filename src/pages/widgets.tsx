import { useMemo, useState, useEffect, useRef, Fragment, ReactNode, CSSProperties } from 'react'
import { ROLES, ROLE_KEYS, Role, Tone } from '../roles'
import { tone, Avatar } from '../ui'
import { Empty, Btn, useAction } from '../ux'
import { UserAvatar } from '../UserAvatar'

export const RANGES = { '7D': 7, '30D': 28, '90D': 30 } as const
export type Range = keyof typeof RANGES
const STEP: Record<Range, number> = { '7D': 1, '30D': 1, '90D': 3 }
const rnd = (s: number) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
const RED = ['Denied', 'Rejected', 'Overdue', 'Blocked', 'Expired', 'Delayed']

export function Trend({ role, range, seed }: { role: Role; range: Range; seed: number }) {
  const cfg = ROLES[role]
  const n = RANGES[range]
  const s0 = ROLE_KEYS.indexOf(role) * 7 + seed
  const { a, b } = useMemo(() => {
    const a = Array.from({ length: n }, (_, i) => Math.round(cfg.base * (0.6 + 0.3 * Math.sin(i / 3 + s0) + 0.3 * rnd(s0 + i))))
    return { a, b: a.map((v, i) => Math.round(v * (0.82 + 0.16 * rnd(s0 * 3 + i)))) }
  }, [n, s0, cfg.base])
  const [hi, setHi] = useState<number | null>(null)
  const W = 640, H = 200, bw = W / n, max = Math.max(...a) * 1.2
  const y = (v: number) => H - 14 - (v / max) * (H - 30)
  const cx = (i: number) => i * bw + bw / 2
  const curve = (s: number[]) => s.reduce((d, v, i) => {
    if (!i) return `M${cx(0)},${y(v)}`
    const mx = (cx(i - 1) + cx(i)) / 2
    return `${d} C${mx},${y(s[i - 1])} ${mx},${y(v)} ${cx(i)},${y(v)}`
  }, '')
  const sum = (s: number[]) => s.reduce((x, v) => x + v, 0)
  const label = (i: number) => new Date(Date.now() - (n - 1 - i) * STEP[range] * 864e5).toLocaleDateString('en', { month: 'short', day: 'numeric' }).toUpperCase()
  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1].map(f => Math.round(f * (n - 1)))
  const diff = sum(a) - sum(b)

  return (
    <>
      <div className="trend-stats">
        <div><span className="muted up">{cfg.legend[0]}</span><b>{sum(a).toLocaleString()}</b></div>
        <div><span className="muted up">{cfg.legend[1]}</span><b>{sum(b).toLocaleString()}</b></div>
        <div><span className="muted up">Variance</span><b className="teal">+{diff}</b></div>
      </div>
      <div className="trend" key={`${range}-${seed}`} onMouseLeave={() => setHi(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect()
          setHi(Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n))))
        }}>
          {a.map((v, i) => <rect key={i} x={i * bw + bw * 0.18} width={bw * 0.64} y={y(v)} height={H - 14 - y(v)} rx="2" className={i === hi ? 'bar on' : 'bar'} style={{ '--i': i } as CSSProperties} />)}
          <path d={curve(a)} className="ln2" />
          <path d={curve(b)} className="ln" pathLength={1} />
          {hi !== null && <circle cx={cx(hi)} cy={y(b[hi])} r="4" className="dot" />}
        </svg>
        {hi !== null && (
          <div className="tt" style={{ left: `${((hi + 0.5) / n) * 100}%`, transform: hi > n * 0.6 ? 'translateX(-105%)' : 'translateX(8px)' }}>
            <span className="muted up">{label(hi)}</span>
            <div><i className="d1" />{cfg.legend[1]} <b>{b[hi]}</b></div>
            <div><i className="d2" />{cfg.legend[0]} <b>{a[hi]}</b></div>
          </div>
        )}
        <div className="xaxis">{ticks.map(i => <span key={i}>{label(i)}</span>)}</div>
      </div>
    </>
  )
}

export function Gauge({ pct }: { pct: number }) {
  const N = 44, cx = 110, cy = 112
  return (
    <svg viewBox="0 0 220 125" className="gauge">
      {Array.from({ length: N }, (_, i) => {
        const f = i / (N - 1), t = Math.PI + f * Math.PI, long = i % 5 === 0
        const r1 = long ? 66 : 72, r2 = 92
        return <line key={i} x1={cx + r1 * Math.cos(t)} y1={cy + r1 * Math.sin(t)} x2={cx + r2 * Math.cos(t)} y2={cy + r2 * Math.sin(t)} className={f * 100 <= pct ? 'tk on' : 'tk'} style={{ '--i': i } as CSSProperties} />
      })}
      <text x="108" y="108" textAnchor="middle" className="g-num">{pct}<tspan className="g-pc">%</tspan></text>
    </svg>
  )
}


export const RANGE_KEYS = Object.keys(RANGES) as Range[]
export const peso = (n: number) => (n < 0 ? '-' : '') + '₱' + Math.abs(n).toLocaleString()

export function Card({ t, r, c, children }: { t?: string; r?: ReactNode; c?: string; children: ReactNode }) {
  return <div className={`card ${c ?? ''}`}>{(t || r) && <div className="ch"><h3>{t}</h3>{r}</div>}{children}</div>
}
export function Strip({ items }: { items: [string, string, string, Tone][] }) {
  return (
    <div className="card strip" style={{ '--n': items.length } as CSSProperties}>
      {items.map(([l, v, d, t]) => <div key={l}><span className="muted up">{l}</span><div className="kv"><b><Count v={v} /></b>{d && <i className={`chip t${t}`}>{d}</i>}</div></div>)}
    </div>
  )
}
export function Pipeline({ role }: { role: Role }) {
  const cfg = ROLES[role]
  const max = Math.max(...cfg.stages.map(s => s[1])), total = cfg.stages.reduce((x, s) => x + s[1], 0)
  return (
    <Card t={cfg.pipeTitle}>
      <p className="muted">{total} active · {cfg.stages.length} stages</p>
      <div className="pcols">{cfg.stages.map(([l, c], si) => (
        <div key={l} className="pcw"><div className={`pcol ${RED.includes(l) ? 'red' : ''}`}>{Array.from({ length: Math.max(1, Math.round((c / max) * 22)) }, (_, i) => <i key={i} style={{ '--i': i, '--c': si } as CSSProperties} />)}</div>
          <span className="muted pl">{l}</span><b>{c}</b></div>))}</div>
    </Card>
  )
}
export function Attn({ role }: { role: Role }) {
  const cfg = ROLES[role]
  const [tab, setTab] = useState(0)
  const tabs = ['All', 'Due today', 'Overdue']
  const f = (t: number) => cfg.rows.filter(r => t === 0 || r[4] === (t === 1 ? 'today' : 'overdue'))
  return (
    <Card t={cfg.attnTitle} r={<div className="tabs">{tabs.map((t, i) => <button key={t} className={i === tab ? 'on' : ''} onClick={() => setTab(i)}>{t} <i>{f(i).length}</i></button>)}</div>}>
      <table><thead><tr><th>Item</th><th>Owner</th><th>Status</th><th>Clock</th></tr></thead>
        <tbody>{f(tab).map(r => (
          <tr key={r[0]}><td>{r[0]}</td><td className="muted">{r[1]}</td><td><span className={`chip ${tone(r[2])}`}>{r[2]}</span></td><td><span className="clock">{r[3]} <UserAvatar name={r[1]} /></span></td></tr>))}
          {!f(tab).length && <tr><td colSpan={4} className="muted">Nothing here. All clear.</td></tr>}</tbody></table>
    </Card>
  )
}
export function AI({ role }: { role: Role }) {
  const cfg = ROLES[role]
  return (
    <div className="card ai"><div className="ring" /><span className="muted up">Tekton assistant</span><p>{cfg.ai}</p>
      <div className="row"><a className="btn" href={`#${cfg.actionTo}`}>{cfg.aiBtn}</a><button className="ghost">Dismiss</button></div></div>
  )
}
export function HBars({ rows }: { rows: { l: string; v: number; max: number; note?: string }[] }) {
  return <div className="hbs">{rows.map((r, i) => <div className="hb" key={r.l}><span>{r.l}</span><div className="trk"><i className={r.v > r.max ? 'red' : ''} style={{ width: `${Math.min(100, (r.v / r.max) * 100)}%`, '--i': i } as CSSProperties} /></div><b>{r.note ?? r.v}</b></div>)}</div>
}
export function Prog({ v, bad }: { v: number; bad?: boolean }) {
  return <span className="prog"><i className={bad ? 'red' : ''} style={{ width: `${Math.min(100, v)}%` }} /></span>
}
export function Donut({ d, center }: { d: [string, number, string][]; center: string }) {
  const T = d.reduce((a, x) => a + x[1], 0), R = 42, C = 2 * Math.PI * R
  let off = 0
  return (
    <div className="donut">
      <svg viewBox="0 0 120 120" width="130" height="130"><circle cx="60" cy="60" r={R} fill="none" stroke="#12201f" strokeWidth="14" />
        {d.map(([l, v, c]) => { const len = (v / T) * C; const el = <circle key={l} cx="60" cy="60" r={R} fill="none" stroke={c} strokeWidth="14" strokeDasharray={`${Math.max(len - 2, 0)} ${C}`} strokeDashoffset={-off} transform="rotate(-90 60 60)" />; off += len; return el })}
        <text x="60" y="66" textAnchor="middle" className="dn">{center}</text></svg>
      <div className="leg">{d.map(([l, v, c]) => <div key={l}><i style={{ background: c }} />{l}<b>{v}</b></div>)}</div>
    </div>
  )
}
export function StackBar({ d, fmt = String }: { d: [string, number, string][]; fmt?: (n: number) => string }) {
  return (
    <><div className="stack">{d.map(([l, v, c]) => <i key={l} style={{ flex: v, background: c }} />)}</div>
      <div className="leg">{d.map(([l, v, c]) => <div key={l}><i style={{ background: c }} />{l}<b>{fmt(v)}</b></div>)}</div></>
  )
}
export function Heat({ rows, cols, seed }: { rows: string[]; cols: string[]; seed: number }) {
  return (
    <div className="heat" style={{ gridTemplateColumns: `96px repeat(${cols.length},1fr)` }}><span />
      {cols.map(c => <span key={c} className="muted hc">{c}</span>)}
      {rows.map((r, ri) => <Fragment key={r}><span className="muted hl">{r}</span>
        {cols.map((c, ci) => <i key={r + c} style={{ background: `rgba(53,224,181,${0.1 + 0.85 * rnd(seed + ri * 17 + ci)})`, '--i': ci + ri * 2 } as CSSProperties} />)}</Fragment>)}
    </div>
  )
}
export function Steps({ s, at }: { s: string[]; at: number }) {
  return <div className="steps">{s.map((x, i) => <div key={x} className={i < at ? 'done' : i === at ? 'now' : ''}><i>{i < at ? '✓' : i + 1}</i><span>{x}</span></div>)}</div>
}
export function Feed({ items }: { items: { a: string; t: string; s: string; r?: ReactNode }[] }) {
  return (
    <div className="feed">{items.length ? items.map((x, i) => <div key={i}><UserAvatar name={x.a} /><div><span>{x.t}</span><span className="muted">{x.s}</span></div>{x.r}</div>) : <Empty icon="check" title="All clear" hint="Nothing to show right now." />}</div>
  )
}
export function Btns({ a, b, la = 'Approve', lb = 'Reject' }: { a: () => void; b: () => void; la?: string; lb?: string }) {
  const { run, pending } = useAction()
  return <span className="row"><Btn className="sm" busy={pending} onClick={() => void run(a)}>{la}</Btn><Btn className="ghost sm" disabled={pending} onClick={() => void run(b)}>{lb}</Btn></span>
}

/* ---------- count-up for KPI numbers (first mount only) ---------- */
function useCountUp(target: string) {
  const [out, setOut] = useState(target)
  const done = useRef(false)
  useEffect(() => {
    const m = /-?[\d,]*\.?\d+/.exec(target)
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!m || reduce || done.current) { done.current = true; setOut(target); return }
    const raw = m[0], num = parseFloat(raw.replace(/,/g, '')), dec = (raw.split('.')[1] || '').length, comma = raw.includes(',')
    const t0 = performance.now()
    let id = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - p, 3)
      let s = (num * e).toFixed(dec)
      if (comma) s = Number(s).toLocaleString('en', { minimumFractionDigits: dec, maximumFractionDigits: dec })
      setOut(target.replace(raw, s))
      if (p < 1) id = requestAnimationFrame(tick)
      else done.current = true
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [target])
  return out
}
export function Count({ v }: { v: string }) { return <>{useCountUp(v)}</> }

/* ---------- Expense vs. collected (grouped bars + net cash line + figures) ---------- */
export function CashChart({ seed, title = 'Expense vs. collected', labels = ['Collected', 'Actual expense', 'Net cash'], live }: { seed: number; title?: string; labels?: [string, string, string]; live?: { m: string; c: number; e: number }[] }) {
  const mock = useMemo(() => ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'].map((m, i) => {
    const c = Math.round((900000 + 700000 * rnd(seed * 5 + i + 3)) / 1000) * 1000
    const e = Math.round((c * (0.55 + 0.4 * rnd(seed * 7 + i + 11))) / 1000) * 1000
    return { m, c, e, n: c - e }
  }), [seed])
  const rows = live ? live.map(r => ({ ...r, n: r.c - r.e })) : mock
  const [hi, setHi] = useState<number | null>(null)
  const W = 520, H = 180, n = rows.length, bw = W / n
  const max = (Math.max(...rows.map(r => Math.max(r.c, r.e))) || 1) * 1.15
  const y = (v: number) => H - 8 - (Math.max(0, v) / max) * (H - 20)
  const cx = (i: number) => i * bw + bw / 2
  const line = rows.reduce((d, r, i) => {
    if (!i) return `M${cx(0)},${y(r.n)}`
    const mx = (cx(i - 1) + cx(i)) / 2
    return `${d} C${mx},${y(rows[i - 1].n)} ${mx},${y(r.n)} ${cx(i)},${y(r.n)}`
  }, '')
  const sum = (k: 'c' | 'e' | 'n') => rows.reduce((a, r) => a + r[k], 0)
  const tn = sum('n')
  return (
    <Card t={title} c="cc" r={<span className="legend"><i className="lg1" />{labels[0]}<i className="lg2" />{labels[1]}<i className="lg3" />{labels[2]}</span>}>
      <div className="trend" key={seed} onMouseLeave={() => setHi(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect()
          setHi(Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n))))
        }}>
          {[0.25, 0.5, 0.75].map(f => <line key={f} x1="0" x2={W} y1={H - 8 - f * (H - 20)} y2={H - 8 - f * (H - 20)} className="gl" />)}
          {rows.map((r, i) => (
            <Fragment key={r.m}>
              <rect x={i * bw + bw * 0.16} width={bw * 0.32} y={y(r.c)} height={H - 8 - y(r.c)} rx="2" className={`bar c ${hi === i ? 'hot' : ''}`} style={{ '--i': i * 2 } as CSSProperties} />
              <rect x={i * bw + bw * 0.52} width={bw * 0.32} y={y(r.e)} height={H - 8 - y(r.e)} rx="2" className={`bar e ${hi === i ? 'hot' : ''}`} style={{ '--i': i * 2 + 1 } as CSSProperties} />
            </Fragment>
          ))}
          <path d={line} className="ln net" pathLength={1} />
          {hi !== null && <circle cx={cx(hi)} cy={y(rows[hi].n)} r="4" className="dot" />}
        </svg>
        {hi !== null && (
          <div className="tt" style={{ left: `${((hi + 0.5) / n) * 100}%`, transform: hi > n * 0.55 ? 'translateX(-105%)' : 'translateX(8px)' }}>
            <span className="muted up">{rows[hi].m}</span>
            <div><i className="d1" />{labels[0]} <b>{peso(rows[hi].c)}</b></div>
            <div><i className="d3" />{labels[1]} <b>{peso(rows[hi].e)}</b></div>
            <div><i className="d2" />{labels[2]} <b>{peso(rows[hi].n)}</b></div>
          </div>
        )}
        <div className="xaxis even">{rows.map(r => <span key={r.m}>{r.m}</span>)}</div>
      </div>
      <div className="cc-fig"><b className="teal"><Count v={peso(sum('c'))} /></b><b className="blu"><Count v={peso(sum('e'))} /></b><b className={tn < 0 ? 'neg' : 'teal'}><Count v={peso(tn)} /></b></div>
      <div className="cc-lbl"><span>{labels[0]}</span><span>{labels[1]}</span><span>{labels[2]}</span></div>
      <details className="figs"><summary>View chart figures</summary>
        <table><thead><tr><th>Month</th><th>{labels[0]}</th><th>{labels[1]}</th><th>{labels[2]}</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.m}><td>{r.m}</td><td>{peso(r.c)}</td><td>{peso(r.e)}</td><td className={r.n < 0 ? 'neg' : 'teal'}>{peso(r.n)}</td></tr>)}</tbody></table></details>
    </Card>
  )
}

/* ---------- Budget vs actual: grouped bars, budget cap marker, tooltip, variance list ---------- */
const niceMax = (v: number) => { const m = 10 ** Math.floor(Math.log10(v)); return (Math.ceil((v / m) * 4) / 4) * m }
const short$ = (v: number) => (v >= 1e6 ? `₱${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M` : v >= 1e3 ? `₱${Math.round(v / 1e3)}K` : `₱${Math.round(v)}`)
export function BudgetChart({ rows }: { rows: { l: string; b: number; a: number }[] }) {
  const [hi, setHi] = useState<number | null>(null)
  const W = 480, H = 200, TOP = 16, k = rows.length, gw = W / k
  const max = niceMax(Math.max(...rows.map(r => Math.max(r.b, r.a)), 1) * 1.08)
  const y = (v: number) => H - (v / max) * (H - TOP)
  const bw = Math.min(gw * 0.26, 44)
  const status = (r: { b: number; a: number }) => (r.a > r.b ? 'over' : r.b && r.a / r.b >= 0.9 ? 'warn' : '')
  return (
    <>
      <div className="bchart">
        <div className="yax">{[0, 0.25, 0.5, 0.75, 1].map(f => <span key={f} style={{ bottom: `${(f * (H - TOP)) / H * 100}%` }}>{short$(f * max)}</span>)}</div>
        <div className="plot" key={rows.length} onMouseLeave={() => setHi(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onMouseMove={e => {
            const r = e.currentTarget.getBoundingClientRect()
            setHi(Math.max(0, Math.min(k - 1, Math.floor(((e.clientX - r.left) / r.width) * k))))
          }}>
            {[0, 0.25, 0.5, 0.75, 1].map(f => <line key={f} x1="0" x2={W} y1={y(f * max)} y2={y(f * max)} className="gl" />)}
            {rows.map((r, i) => {
              const cx = i * gw + gw / 2
              return (
                <Fragment key={r.l}>
                  <rect x={cx - bw - 3} width={bw} y={y(r.b)} height={H - y(r.b)} rx="3" className={`bar bb ${hi === i ? 'hot' : ''}`} style={{ '--i': i * 2 } as CSSProperties} />
                  <rect x={cx + 3} width={bw} y={y(r.a)} height={H - y(r.a)} rx="3" className={`bar ba ${status(r)} ${hi === i ? 'hot' : ''}`} style={{ '--i': i * 2 + 1 } as CSSProperties} />
                  <line x1={cx + 3 - 4} x2={cx + 3 + bw + 4} y1={y(r.b)} y2={y(r.b)} className="cap" />
                </Fragment>
              )
            })}
          </svg>
          {hi !== null && (
            <div className="tt" style={{ left: `${((hi + 0.5) / k) * 100}%`, transform: 'translateX(-50%)', top: 0 }}>
              <span className="muted up">{rows[hi].l}</span>
              <div><i className="d3" />Budget <b>{peso(rows[hi].b)}</b></div>
              <div><i className="d1" />Actual <b>{peso(rows[hi].a)}</b></div>
              <div className={rows[hi].a > rows[hi].b ? 'neg' : 'teal'}>{rows[hi].a > rows[hi].b ? 'Over by' : 'Remaining'} <b>{peso(Math.abs(rows[hi].b - rows[hi].a))}</b></div>
            </div>
          )}
          <div className="xaxis even">{rows.map(r => <span key={r.l}><b>{r.l}</b><i>{short$(r.a)} of {short$(r.b)}</i></span>)}</div>
        </div>
      </div>
      <div className="bvl">
        {rows.map(r => { const u = r.b ? Math.round((r.a / r.b) * 100) : 0; const s = status(r); return (
          <div className="bvr" key={r.l}><span>{r.l}</span><Prog v={u} bad={u > 100} /><span className={`chip ${s === 'over' ? 'bad' : s === 'warn' ? 'warn' : ''}`}>{s === 'over' ? `Over by ${short$(r.a - r.b)}` : s === 'warn' ? `${u}% · near limit` : `${u}% · on track`}</span></div>) })}
      </div>
    </>
  )
}
