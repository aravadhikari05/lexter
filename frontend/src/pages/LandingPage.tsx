// src/pages/LandingPage.tsx
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthMode = 'login' | 'signup'

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useWindowWidth() {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  )
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return width
}

// ─── Data ────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '99.8%', label: 'Accuracy' },
  { value: '3s',    label: 'Avg. time' },
  { value: 'B22',   label: 'Bluebook ed.' },
]

const TICKER_CITES = [
  'Brown v. Bd. of Educ., 347 U.S. 483 (1954)',
  'Miranda v. Arizona, 384 U.S. 436 (1966)',
  'Marbury v. Madison, 5 U.S. 137 (1803)',
  'Roe v. Wade, 410 U.S. 113 (1973)',
  'United States v. Nixon, 418 U.S. 683 (1974)',
  'Pennoyer v. Neff, 95 U.S. 714 (1877)',
]

const DEMO_EXAMPLES = [
  {
    input:  'brown v board of education 1954',
    steps:  ['Parsing input…', 'Verifying via CourtListener…', 'Applying Rule 10…', 'Formatting citation…'],
    output: 'Brown v. Bd. of Educ., <em>347 U.S. 483</em> (1954).',
  },
  {
    input:  'miranda arizona 384 us 436',
    steps:  ['Parsing input…', 'Verifying case details…', 'Checking reporter…', 'Formatting citation…'],
    output: 'Miranda v. Arizona, <em>384 U.S. 436</em> (1966).',
  },
  {
    input:  'marbury v madison pinpoint 137',
    steps:  ['Parsing input…', 'Resolving pincite…', 'Applying Rule 10.9…', 'Formatting citation…'],
    output: 'Marbury v. Madison, <em>5 U.S. 137</em>, 137 (1803).',
  },
]

const TRUST_BULLETS = [
  '✓  99.8% citation accuracy',
  '✓  Verified against real legal databases',
  '✓  All Bluebook source types',
]

// ─── Styles ──────────────────────────────────────────────────────────────────

const mono  = "'Inter', sans-serif"
const serif = "'Inter', sans-serif"

const S = {
  root: {
    minHeight: '100vh',
    background: 'var(--bg)',
    display: 'grid',
    gridTemplateColumns: '1fr 390px',
    overflow: 'hidden',
  } satisfies React.CSSProperties,

  left: {
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid var(--border)',
    position: 'relative',
    overflow: 'hidden',
    height: '100vh',
  } satisfies React.CSSProperties,

  grid: {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    backgroundImage: `
      linear-gradient(var(--border) 1px, transparent 1px),
      linear-gradient(90deg, var(--border) 1px, transparent 1px)
    `,
    backgroundSize: '60px 60px',
    opacity: 0.22,
    pointerEvents: 'none',
  } satisfies React.CSSProperties,

  ghost: {
    position: 'absolute',
    bottom: -10,
    left: 24,
    zIndex: 0,
    fontFamily: serif,
    fontSize: 210,
    fontWeight: 700,
    color: 'transparent',
    WebkitTextStroke: '1px rgba(200,168,75,0.055)',
    lineHeight: 1,
    pointerEvents: 'none',
    userSelect: 'none',
    letterSpacing: '-.04em',
  } satisfies React.CSSProperties,

  nav: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '36px 52px',
  } satisfies React.CSSProperties,

  logo: {
    fontFamily: serif,
    fontSize: 21,
    fontWeight: 600,
    letterSpacing: '-.01em',
  } satisfies React.CSSProperties,

  logoAccent: { color: 'var(--accent)' } satisfies React.CSSProperties,

  edition: {
    fontFamily: mono,
    fontSize: 8,
    letterSpacing: '.18em',
    color: 'var(--dimmer)',
  } satisfies React.CSSProperties,

  content: {
    position: 'relative',
    zIndex: 1,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '0 52px',
  } satisfies React.CSSProperties,

  eyebrow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 26,
  } satisfies React.CSSProperties,

  eyebrowLine:  { width: 18, height: 1, background: 'var(--accent)' } satisfies React.CSSProperties,
  eyebrowText:  { fontFamily: mono, fontSize: 9, letterSpacing: '.2em', color: 'var(--accent)' } satisfies React.CSSProperties,

  headline: {
    fontFamily: serif,
    fontSize: 64,
    fontWeight: 600,
    color: 'var(--text)',
    margin: '0 0 26px',
    lineHeight: 1.1,
    letterSpacing: '-.025em',
    maxWidth: 560,
  } satisfies React.CSSProperties,

  headlineAccent: { color: 'var(--accent)' } satisfies React.CSSProperties,

  subtext: {
    fontSize: 16,
    color: 'var(--muted)',
    lineHeight: 1.85,
    margin: '0 0 48px',
    maxWidth: 460,
  } satisfies React.CSSProperties,

  tickerWrap: {
    position: 'relative',
    zIndex: 1,
    overflow: 'hidden',
    borderTop: '1px solid var(--border)',
    padding: '11px 0',
    flexShrink: 0,
  } satisfies React.CSSProperties,

  tickerTrack: {
    display: 'flex',
    gap: 48,
    width: 'max-content',
    animation: 'ticker 30s linear infinite',
    fontFamily: mono,
    fontSize: 9,
    letterSpacing: '.06em',
    color: 'var(--dimmer)',
    whiteSpace: 'nowrap',
  } satisfies React.CSSProperties,

  tickerDot: { color: 'var(--accent)', marginRight: 10 } satisfies React.CSSProperties,

  right: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '56px 42px',
    background: 'var(--surface)',
    height: '100vh',
    overflowY: 'auto',
  } satisfies React.CSSProperties,

  modeSwitcher: {
    display: 'flex',
    background: 'var(--bg)',
    border: '1px solid var(--border-b)',
    borderRadius: 10,
    padding: 3,
    marginBottom: 32,
  } satisfies React.CSSProperties,

  authTitle: {
    fontFamily: serif,
    fontSize: 24,
    fontWeight: 600,
    color: 'var(--text)',
    margin: '0 0 4px',
    letterSpacing: '-.01em',
  } satisfies React.CSSProperties,

  authSub: {
    fontSize: 10,
    color: 'var(--dimmer)',
    margin: '0 0 32px',
    fontFamily: mono,
    letterSpacing: '.05em',
  } satisfies React.CSSProperties,

  fields: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  } satisfies React.CSSProperties,

  fieldLabel: {
    fontFamily: mono,
    fontSize: 8,
    letterSpacing: '.14em',
    color: 'var(--dimmer)',
    textTransform: 'uppercase',
  } satisfies React.CSSProperties,

  input: {
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--border-b)',
    padding: '9px 0',
    fontFamily: mono,
    fontSize: 13,
    color: 'var(--text)',
    outline: 'none',
    caretColor: 'var(--accent)',
    width: '100%',
    transition: 'border-color .2s',
    borderRadius: 0,
  } satisfies React.CSSProperties,

  error: {
    fontFamily: mono,
    fontSize: 10,
    color: '#e05c5c',
    margin: '14px 0 0',
    letterSpacing: '.03em',
  } satisfies React.CSSProperties,

  switchText: {
    marginTop: 16,
    fontFamily: mono,
    fontSize: 9,
    letterSpacing: '.06em',
    color: 'var(--dimmer)',
    textAlign: 'center',
  } satisfies React.CSSProperties,

  switchLink: {
    color: 'var(--accent)',
    cursor: 'pointer',
    textDecoration: 'underline',
  } satisfies React.CSSProperties,

  trustList: {
    marginTop: 36,
    paddingTop: 22,
    borderTop: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  } satisfies React.CSSProperties,

  trustItem: {
    fontFamily: mono,
    fontSize: 9,
    letterSpacing: '.05em',
    color: 'var(--dimmer)',
  } satisfies React.CSSProperties,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function modeButtonStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, padding: '8px 12px',
    fontFamily: mono, fontSize: 9, letterSpacing: '.12em',
    background: active ? 'var(--surface)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--dimmer)',
    border: active ? '1px solid var(--border-b)' : '1px solid transparent',
    borderRadius: 7, cursor: 'pointer', transition: 'all .15s',
    textTransform: 'uppercase',
  }
}

function submitButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    marginTop: 32, width: '100%', padding: '13px',
    fontFamily: mono, fontSize: 10, letterSpacing: '.14em', fontWeight: 600,
    background: disabled ? 'var(--surface2)' : 'var(--accent)',
    color: disabled ? 'var(--dimmer)' : '#111009',
    border: 'none', borderRadius: 10,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background .15s, transform .1s',
    textTransform: 'uppercase',
  }
}

// ─── Demo Component ───────────────────────────────────────────────────────────

type DemoPhase = 'typing' | 'steps' | 'result' | 'pause'

function CitationDemo() {
  const [exIndex,   setExIndex]   = useState(0)
  const [phase,     setPhase]     = useState<DemoPhase>('typing')
  const [typed,     setTyped]     = useState('')
  const [stepIdx,   setStepIdx]   = useState(0)
  const [doneSteps, setDoneSteps] = useState<number[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ex = DEMO_EXAMPLES[exIndex]

  const clear = () => { if (timerRef.current) clearTimeout(timerRef.current) }
  const delay = (fn: () => void, ms: number) => { timerRef.current = setTimeout(fn, ms) }

  useEffect(() => {
    clear()
    setTyped(''); setStepIdx(0); setDoneSteps([]); setPhase('typing')

    let i = 0
    const typeNext = () => {
      if (i < ex.input.length) {
        setTyped(ex.input.slice(0, ++i))
        delay(typeNext, 42 + Math.random() * 28)
      } else {
        delay(startSteps, 400)
      }
    }

    const startSteps = () => {
      setPhase('steps')
      let s = 0
      const nextStep = () => {
        if (s < ex.steps.length) {
          setStepIdx(s)
          delay(() => {
            setDoneSteps(prev => [...prev, s])
            s++
            delay(nextStep, 180)
          }, 700)
        } else {
          delay(() => setPhase('result'), 300)
          delay(advance, 3200)
        }
      }
      nextStep()
    }

    const advance = () => {
      setPhase('pause')
      delay(() => setExIndex(prev => (prev + 1) % DEMO_EXAMPLES.length), 600)
    }

    delay(typeNext, 300)
    return clear
  }, [exIndex])

  const showSteps  = phase === 'steps' || phase === 'result'
  const showResult = phase === 'result'

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border-b)',
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,.25)', width: '100%',
    }}>
      <div style={{
        background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
        padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {['#e05c5c','#d4a017','#4caf50'].map(c => (
          <div key={c} style={{ width: 7, height: 7, borderRadius: '50%', background: c, opacity: .6 }} />
        ))}
        <span style={{ fontFamily: mono, fontSize: 8, letterSpacing: '.14em', color: 'var(--dimmer)', marginLeft: 4 }}>
          LEXTER · LIVE DEMO
        </span>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontFamily: mono, fontSize: 8, letterSpacing: '.12em', color: 'var(--dimmer)' }}>INPUT</span>
          <div style={{
            background: 'var(--bg)', border: '1px solid var(--border-b)',
            borderRadius: 6, padding: '7px 10px',
            fontFamily: mono, fontSize: 11, color: 'var(--text)',
            height: 32, display: 'flex', alignItems: 'center',
          }}>
            <span>{typed}</span>
            <span style={{
              display: 'inline-block', width: 1, height: 12,
              background: 'var(--accent)', marginLeft: 1,
              animation: phase === 'typing' ? 'demoBlink .7s step-end infinite' : 'none',
              opacity: phase === 'typing' ? 1 : 0,
              transition: 'opacity .15s',
            }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, height: 76 }}>
          {ex.steps.map((step, i) => {
            const isDone    = doneSteps.includes(i)
            const isRunning = stepIdx === i && !isDone
            const visible   = showSteps && i <= stepIdx
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                opacity: visible ? (isDone ? .7 : 1) : 0, transition: 'opacity .2s',
              }}>
                <div style={{
                  width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                  background: isDone || isRunning ? 'var(--accent)' : 'var(--border-b)',
                  animation: isRunning ? 'demoPing .8s ease-in-out infinite' : 'none',
                  transition: 'background .2s',
                }} />
                <span style={{
                  fontFamily: mono, fontSize: 9, letterSpacing: '.06em',
                  color: isRunning ? 'var(--accent)' : 'var(--muted)', transition: 'color .2s',
                }}>
                  {step}
                </span>
                {isDone && (
                  <span style={{ fontFamily: mono, fontSize: 8, color: 'var(--accent)', marginLeft: 'auto' }}>✓</span>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ height: 52, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{
            fontFamily: mono, fontSize: 8, letterSpacing: '.12em', color: 'var(--accent)',
            opacity: showResult ? 1 : 0, transition: 'opacity .3s',
          }}>OUTPUT</span>
          <div style={{
            background: 'var(--accent-bg)', border: '1px solid var(--accent-bdr)',
            borderRadius: 6, padding: '7px 10px',
            fontFamily: serif, fontSize: 12, color: 'var(--text)', lineHeight: 1.5,
            opacity: showResult ? 1 : 0, transition: 'opacity .35s ease',
          }}
            dangerouslySetInnerHTML={{ __html: ex.output }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Email Confirmation Modal ─────────────────────────────────────────────────

interface ConfirmModalProps {
  email: string
  resent: boolean
  onResend: () => void
  onSignIn: () => void
  onStartOver: () => void
}

function ConfirmModal({ email, resent, onResend, onSignIn, onStartOver }: ConfirmModalProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: visible ? 1 : 0,
      transition: 'opacity .25s ease',
      padding: '16px',
    }}>
      {/* Backdrop */}
      <div
        onClick={onSignIn}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(8,7,5,.82)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: 'var(--surface)',
        border: '1px solid var(--border-b)',
        borderRadius: 16,
        width: '100%',
        maxWidth: 400,
        boxShadow: '0 0 0 1px rgba(200,168,75,.08), 0 32px 80px rgba(0,0,0,.6)',
        overflow: 'hidden',
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(16px) scale(.97)',
        transition: 'transform .3s cubic-bezier(.16,1,.3,1)',
      }}>

        {/* Top accent bar */}
        <div style={{
          height: 2,
          background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
          opacity: .7,
        }} />

        {/* Header bar */}
        <div style={{
          background: 'var(--surface2)',
          borderBottom: '1px solid var(--border)',
          padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {['#e05c5c','#d4a017','#4caf50'].map(c => (
            <div key={c} style={{ width: 7, height: 7, borderRadius: '50%', background: c, opacity: .5 }} />
          ))}
          <span style={{ fontFamily: mono, fontSize: 8, letterSpacing: '.16em', color: 'var(--dimmer)', marginLeft: 4 }}>
            LEXTER · EMAIL CONFIRMATION
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '40px 40px 36px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

          {/* Icon */}
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--accent-bg)',
            border: '1px solid var(--accent-bdr)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, marginBottom: 22,
            boxShadow: '0 0 20px rgba(200,168,75,.1)',
          }}>
            ✉
          </div>

          {/* Title */}
          <h2 style={{
            fontFamily: serif, fontSize: 22, fontWeight: 600,
            color: 'var(--text)', margin: '0 0 10px', letterSpacing: '-.01em',
          }}>
            Check your inbox
          </h2>

          {/* Body copy */}
          <p style={{
            fontFamily: mono, fontSize: 10, color: 'var(--dimmer)',
            letterSpacing: '.04em', lineHeight: 2, margin: 0,
          }}>
            We sent a confirmation link to
          </p>
          <p style={{
            fontFamily: mono, fontSize: 11, color: 'var(--accent)',
            letterSpacing: '.04em', margin: '2px 0 6px', fontWeight: 600,
          }}>
            {email}
          </p>
          <p style={{
            fontFamily: mono, fontSize: 10, color: 'var(--dimmer)',
            letterSpacing: '.04em', lineHeight: 2, margin: '0 0 28px',
          }}>
            Click the link to activate your account,<br />then come back here to sign in.
          </p>

          {/* Divider */}
          <div style={{ width: '100%', height: 1, background: 'var(--border)', marginBottom: 28 }} />

          {/* CTA */}
          <button
            onClick={onSignIn}
            style={{
              width: '100%', padding: '13px',
              fontFamily: mono, fontSize: 10, letterSpacing: '.14em', fontWeight: 600,
              background: 'var(--accent)', color: '#111009',
              border: 'none', borderRadius: 10,
              cursor: 'pointer', transition: 'opacity .15s, transform .1s',
              textTransform: 'uppercase',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '.88' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
            onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(.98)' }}
            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'none' }}
          >
            I'VE CONFIRMED — SIGN IN →
          </button>

          {/* Secondary actions */}
          <div style={{
            marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center',
          }}>
            <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: '.05em', color: 'var(--dimmer)', margin: 0 }}>
              Didn't get it?{' '}
              <span
                onClick={onResend}
                style={{
                  color: resent ? 'var(--muted)' : 'var(--accent)',
                  cursor: resent ? 'default' : 'pointer',
                  textDecoration: resent ? 'none' : 'underline',
                  transition: 'color .2s',
                }}
              >
                {resent ? '✓ Sent!' : 'Resend email'}
              </span>
            </p>
            <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: '.05em', color: 'var(--dimmer)', margin: 0 }}>
              Wrong address?{' '}
              <span
                onClick={onStartOver}
                style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Start over
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [mode,         setMode]         = useState<AuthMode>('signup')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [error,        setError]        = useState<string | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [mounted,      setMounted]      = useState(false)
  const [confirmed,    setConfirmed]    = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')
  const [resent,       setResent]       = useState(false)

  const windowWidth = useWindowWidth()
  const isMobile    = windowWidth < 768

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(t)
  }, [])

  const handleResend = async () => {
    setResent(false)
    await supabase.auth.resend({ type: 'signup', email: pendingEmail })
    setResent(true)
  }

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        // Email confirmation is enabled — show modal
        setPendingEmail(email)
        setResent(false)
        setConfirmed(true)
      }
    }

    setLoading(false)
  }

  const switchMode = (m: AuthMode) => { setMode(m); setError(null) }

  const handleModalSignIn = () => { setConfirmed(false); switchMode('login') }
  const handleModalStartOver = () => {
    setConfirmed(false)
    setEmail('')
    setPassword('')
    switchMode('signup')
  }

  const tr = (delay: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'none' : 'translateY(12px)',
    transition: `opacity .55s ${delay}s ease, transform .55s ${delay}s ease`,
  })

  const isDisabled  = loading || !email || !password
  const tickerItems = [...TICKER_CITES, ...TICKER_CITES]

  // ─── Mobile overrides ───────────────────────────────────────────────────────

  const rootStyle: React.CSSProperties = isMobile
    ? {
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }
    : S.root

  const leftStyle: React.CSSProperties = isMobile
    ? {
        display: 'flex',
        flexDirection: 'column',
        borderRight: 'none',
        borderBottom: '1px solid var(--border)',
        position: 'relative',
        overflow: 'hidden',
        height: 'auto',
        flexShrink: 0,
      }
    : S.left

  const navStyle: React.CSSProperties = isMobile
    ? {
        ...S.nav,
        padding: '24px 24px 20px',
      }
    : S.nav

  const contentStyle: React.CSSProperties = isMobile
    ? {
        ...S.content,
        padding: '0 24px 28px',
        justifyContent: 'flex-start',
      }
    : S.content

  const headlineStyle: React.CSSProperties = isMobile
    ? {
        ...S.headline,
        fontSize: 38,
        margin: '0 0 16px',
        maxWidth: '100%',
      }
    : S.headline

  const subtextStyle: React.CSSProperties = isMobile
    ? {
        ...S.subtext,
        fontSize: 14,
        margin: '0 0 28px',
        maxWidth: '100%',
        lineHeight: 1.7,
      }
    : S.subtext

  const eyebrowStyle: React.CSSProperties = isMobile
    ? { ...S.eyebrow, marginBottom: 16 }
    : S.eyebrow

  const rightStyle: React.CSSProperties = isMobile
    ? {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        padding: '36px 24px 48px',
        background: 'var(--surface)',
        height: 'auto',
        overflowY: 'visible',
        flex: 1,
      }
    : S.right

  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div style={rootStyle}>
      <style>{`
        @keyframes ticker    { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes demoBlink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes demoPing  { 0%,100% { transform: scale(1); opacity: .5; } 50% { transform: scale(1.6); opacity: 1; } }
      `}</style>

      {/* ── Left panel ── */}
      <div style={leftStyle}>
        <div style={S.grid} />
        {/* Hide giant ghost text on mobile — too large and clips badly */}
        {!isMobile && <div style={S.ghost}>Lex</div>}

        <div style={{ ...navStyle, ...tr(0) }}>
          <span style={S.logo}>
            <span style={S.logoAccent}>Lex</span>ter
          </span>
          <span style={S.edition}>BLUEBOOK 22ND EDITION</span>
        </div>

        <div style={contentStyle}>
          <div style={{ ...eyebrowStyle, ...tr(.1) }}>
            <div style={S.eyebrowLine} />
            <span style={S.eyebrowText}>LEGAL CITATION ASSISTANT</span>
          </div>

          <h1 style={{ ...headlineStyle, ...tr(.15) }}>
            Bluebook citations.<br />
            <span style={{ ...S.headlineAccent, fontStyle: 'italic' }}>Done right.</span>
          </h1>

          <p style={{ ...subtextStyle, ...tr(.2) }}>
            Paste any citation info, and Lexter verifies it against
            real legal databases and returns a Bluebook-accurate
            result in seconds.
          </p>

          <div style={{ ...tr(.25) }}>
            <CitationDemo />
          </div>
        </div>

        {/* Ticker — hidden on mobile to keep things clean */}
        {!isMobile && (
          <div style={{ ...S.tickerWrap, opacity: mounted ? .45 : 0, transition: 'opacity .8s .5s ease' }}>
            <div style={S.tickerTrack}>
              {tickerItems.map((cite, i) => (
                <span key={i}>
                  <span style={S.tickerDot}>◦</span>{cite}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Right panel — auth ── */}
      <div style={{ ...rightStyle, opacity: mounted ? 1 : 0, transition: 'opacity .6s .25s ease' }}>
        <div style={S.modeSwitcher}>
          {(['signup', 'login'] as AuthMode[]).map(m => (
            <button key={m} onClick={() => switchMode(m)} style={modeButtonStyle(mode === m)}>
              {m === 'signup' ? 'Sign Up' : 'Sign In'}
            </button>
          ))}
        </div>

        <h2 style={S.authTitle}>{mode === 'signup' ? 'Start for free.' : 'Welcome back.'}</h2>
        <p style={S.authSub}>{mode === 'signup' ? 'No credit card required' : 'Sign in to your account'}</p>

        <div style={S.fields}>
          {[
            { label: 'Email',    type: 'email',    val: email,    set: setEmail,    ph: 'you@example.com' },
            { label: 'Password', type: 'password', val: password, set: setPassword, ph: '••••••••' },
          ].map(f => (
            <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={S.fieldLabel}>{f.label}</label>
              <input
                type={f.type}
                value={f.val}
                onChange={e => f.set(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder={f.ph}
                style={S.input}
                onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--accent)' }}
                onBlur={e =>  { e.currentTarget.style.borderBottomColor = 'var(--border-b)' }}
              />
            </div>
          ))}
        </div>

        {error && <p style={S.error}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={isDisabled}
          onMouseDown={e => { if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(.98)' }}
          onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'none' }}
          style={submitButtonStyle(isDisabled)}
        >
          {loading ? 'PLEASE WAIT…' : mode === 'signup' ? 'GET STARTED →' : 'SIGN IN →'}
        </button>

        <p style={S.switchText}>
          {mode === 'signup' ? 'Have an account? ' : 'No account? '}
          <span onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')} style={S.switchLink}>
            {mode === 'signup' ? 'Sign in' : 'Sign up free'}
          </span>
        </p>

        <div style={S.trustList}>
          {TRUST_BULLETS.map(t => <span key={t} style={S.trustItem}>{t}</span>)}
        </div>
      </div>

      {/* ── Email confirmation modal ── */}
      {confirmed && (
        <ConfirmModal
          email={pendingEmail}
          resent={resent}
          onResend={handleResend}
          onSignIn={handleModalSignIn}
          onStartOver={handleModalStartOver}
        />
      )}
    </div>
  )
}