import type { CSSProperties } from 'react'

/** Tekton ECA brand: sun rising behind three towers. Re-drawn as SVG so it stays sharp at any size.
 *  variant "dark" = for the dark app UI (lighter blues, light text); "light" = original navy for white backgrounds. */
const CX = 38, CY = 42, R0 = 25
const rays = Array.from({ length: 14 }, (_, i) => {
  const a = ((135 + i * 15) * Math.PI) / 180, L = i % 2 === 0 ? 47 : 42, w = (5.5 * Math.PI) / 180
  const p = [[CX + R0 * Math.cos(a - w), CY + R0 * Math.sin(a - w)], [CX + R0 * Math.cos(a + w), CY + R0 * Math.sin(a + w)], [CX + L * Math.cos(a), CY + L * Math.sin(a)]]
  return p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
})

export function LogoMark({ size = 34, variant = 'dark', animate = false, still = false }: { size?: number; variant?: 'dark' | 'light'; animate?: boolean; still?: boolean }) {
  const dark = variant === 'dark'
  const t1 = dark ? '#5b93ee' : '#2358a8', t2 = dark ? '#1f56b3' : '#0d2a63'
  return (
    <svg className={`lmark ${animate ? 'anim' : ''} ${still ? '' : 'live'}`} width={size} height={Math.round(size * 1.04)} viewBox="-12 -8 108 112" role="img" aria-label="Tekton ECA">
      <defs>
        <linearGradient id={`lt-${variant}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={t1} /><stop offset="1" stopColor={t2} /></linearGradient>
        <linearGradient id="lr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffd428" /><stop offset="1" stopColor="#f59a0a" /></linearGradient>
        <linearGradient id="lsh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".9" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <clipPath id="lclip"><polygon points="24,100 24,53 40,44 40,100" /><polygon points="43,100 43,30 63,19 63,100" /><polygon points="66,100 66,31 82,41 82,100" /><polygon points="9,100 24,91 24,100" /><polygon points="82,91 96,100 82,100" /></clipPath>
        <radialGradient id="ls" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#ffe45c" /><stop offset=".6" stopColor="#fbb812" /><stop offset="1" stopColor="#f08c08" /></radialGradient>
      </defs>
      <g className="lm-rays">{rays.map((p, i) => <polygon key={i} points={p} fill="url(#lr)" style={{ '--i': i } as CSSProperties} />)}</g>
      <circle className="lm-sun" cx={CX} cy={CY} r="22" fill="url(#ls)" stroke={dark ? '#0b2149' : '#14316d'} strokeWidth="1.4" />
      <g fill={`url(#lt-${variant})`}>
        <polygon className="lm-b b1" points="24,100 24,53 40,44 40,100" />
        <polygon className="lm-b b2" points="43,100 43,30 63,19 63,100" />
        <polygon className="lm-b b3" points="66,100 66,31 82,41 82,100" />
        <polygon className="lm-b b1" points="9,100 24,91 24,100" />
        <polygon className="lm-b b3" points="82,91 96,100 82,100" />
      </g>
      <g fill="#000" opacity=".22">
        <polygon className="lm-b b1" points="32,48.5 40,44 40,100 32,100" />
        <polygon className="lm-b b2" points="53,24.5 63,19 63,100 53,100" />
        <polygon className="lm-b b3" points="74,36 82,41 82,100 74,100" />
      </g>
      <g clipPath="url(#lclip)"><rect className="lm-shine" x="0" y="-8" width="16" height="116" fill="url(#lsh)" /></g>
    </svg>
  )
}

export function Logo({ size = 32, variant = 'dark', animate = false, stacked = false, still = false }: { size?: number; variant?: 'dark' | 'light'; animate?: boolean; stacked?: boolean; still?: boolean }) {
  return (
    <span className={`logo-lockup ${variant} ${stacked ? 'stacked' : ''}`} style={{ fontSize: size * 0.55 }}>
      <LogoMark size={size} variant={variant} animate={animate} still={still} />
      <span className="lg-txt"><b className="lg-name">TEKTON ECA</b><span className="lg-sub">CONSTRUCTION<br />CORPORATION</span></span>
    </span>
  )
}
