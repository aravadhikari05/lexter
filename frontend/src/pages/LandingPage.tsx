// src/pages/LandingPage.tsx
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthMode = 'login' | 'signup'

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

const mono = "'DM Mono', monospace"
const serif = "'Lora', serif"

const S = {
  // Layout
  root: {
    minHeight: '100vh',
    background: 'var(--bg)',
    display: 'grid',
    gridTemplateColumns: '1fr 390px',
    overflow: 'hidden',
  } satisfies React.CSSProperties,

  // Left panel
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
    fontStyle: 'italic',
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
    fontStyle: 'italic',
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

  eyebrowLine: {
    width: 18,
    height: 1,
    background: 'var(--accent)',
  } satisfies React.CSSProperties,

  eyebrowText: {
    fontFamily: mono,
    fontSize: 9,
    letterSpacing: '.2em',
    color: 'var(--accent)',
  } satisfies React.CSSProperties,

  headline: {
    fontFamily: serif,
    fontSize: 64,
    fontWeight: 600,
    fontStyle: 'italic',
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

  stats: { display: 'flex', gap: 0 } satisfies React.CSSProperties,

  // Ticker
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

  // Right panel
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
    fontStyle: 'italic',
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

  // Done state
  doneWrap: { textAlign: 'center', padding: '24px 0' } satisfies React.CSSProperties,

  doneIcon: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-bdr)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 14px',
    fontSize: 18,
  } satisfies React.CSSProperties,

  doneTitle: {
    fontFamily: serif,
    fontSize: 15,
    color: 'var(--text)',
    margin: '0 0 6px',
    fontStyle: 'italic',
  } satisfies React.CSSProperties,

  doneSub: {
    fontFamily: mono,
    fontSize: 9,
    color: 'var(--dimmer)',
    margin: 0,
    letterSpacing: '.04em',
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

function statItemStyle(i: number): React.CSSProperties {
  return {
    padding: '16px 32px',
    background: 'var(--surface)',
    border: '1px solid var(--border-b)',
    borderLeft: i > 0 ? 'none' : '1px solid var(--border-b)',
    borderRadius:
      i === 0 ? '8px 0 0 8px'
      : i === STATS.length - 1 ? '0 8px 8px 0'
      : '0',
  }
}

function modeButtonStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '8px 12px',
    fontFamily: mono,
    fontSize: 9,
    letterSpacing: '.12em',
    background: active ? 'var(--surface)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--dimmer)',
    border: active ? '1px solid var(--border-b)' : '1px solid transparent',
    borderRadius: 7,
    cursor: 'pointer',
    transition: 'all .15s',
    textTransform: 'uppercase',
  }
}

function submitButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    marginTop: 32,
    width: '100%',
    padding: '13px',
    fontFamily: mono,
    fontSize: 10,
    letterSpacing: '.14em',
    fontWeight: 600,
    background: disabled ? 'var(--surface2)' : 'var(--accent)',
    color: disabled ? 'var(--dimmer)' : '#111009',
    border: 'none',
    borderRadius: 10,
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

  // Run the full demo sequence
  useEffect(() => {
    clear()
    setTyped(''); setStepIdx(0); setDoneSteps([]); setPhase('typing')

    // Type the input char by char
    let i = 0
    const typeNext = () => {
      if (i < ex.input.length) {
        setTyped(ex.input.slice(0, ++i))
        delay(typeNext, 42 + Math.random() * 28)
      } else {
        delay(startSteps, 400)
      }
    }

    // Cycle through steps
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
      background: 'var(--surface)',
      border: '1px solid var(--border-b)',
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,.25)',
      width: '100%',
    }}>
      {/* Header bar */}
      <div style={{
        background: 'var(--surface2)',
        borderBottom: '1px solid var(--border)',
        padding: '7px 12px',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {['#e05c5c','#d4a017','#4caf50'].map(c => (
          <div key={c} style={{ width: 7, height: 7, borderRadius: '50%', background: c, opacity: .6 }} />
        ))}
        <span style={{ fontFamily: mono, fontSize: 8, letterSpacing: '.14em', color: 'var(--dimmer)', marginLeft: 4 }}>
          LEXTER · LIVE DEMO
        </span>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>

        {/* Input */}
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

        {/* Steps — fixed height, items fade in */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, height: 76 }}>
          {ex.steps.map((step, i) => {
            const isDone    = doneSteps.includes(i)
            const isRunning = stepIdx === i && !isDone
            const visible   = showSteps && i <= stepIdx
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                opacity: visible ? (isDone ? .7 : 1) : 0,
                transition: 'opacity .2s',
              }}>
                <div style={{
                  width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                  background: isDone || isRunning ? 'var(--accent)' : 'var(--border-b)',
                  animation: isRunning ? 'demoPing .8s ease-in-out infinite' : 'none',
                  transition: 'background .2s',
                }} />
                <span style={{
                  fontFamily: mono, fontSize: 9, letterSpacing: '.06em',
                  color: isRunning ? 'var(--accent)' : 'var(--muted)',
                  transition: 'color .2s',
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

        {/* Output — fixed height, fades in */}
        <div style={{ height: 52, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{
            fontFamily: mono, fontSize: 8, letterSpacing: '.12em', color: 'var(--accent)',
            opacity: showResult ? 1 : 0, transition: 'opacity .3s',
          }}>OUTPUT</span>
          <div style={{
            background: 'var(--accent-bg)', border: '1px solid var(--accent-bdr)',
            borderRadius: 6, padding: '7px 10px',
            fontFamily: serif, fontSize: 12, color: 'var(--text)', lineHeight: 1.5,
            opacity: showResult ? 1 : 0,
            transition: 'opacity .35s ease',
          }}
            dangerouslySetInnerHTML={{ __html: ex.output }}
          />
        </div>

      </div>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [mode,     setMode]     = useState<AuthMode>('signup')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)
  const [mounted,  setMounted]  = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(t)
  }, [])

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setDone(true)
    }

    setLoading(false)
  }

  const switchMode = (m: AuthMode) => { setMode(m); setError(null); setDone(false) }

  // Staggered fade-in
  const tr = (delay: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'none' : 'translateY(12px)',
    transition: `opacity .55s ${delay}s ease, transform .55s ${delay}s ease`,
  })

  const isDisabled = loading || !email || !password
  const tickerItems = [...TICKER_CITES, ...TICKER_CITES] // doubled for seamless loop

  return (
    <div style={S.root}>
      <style>{`
        @keyframes ticker   { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes demoBlink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes demoPing  { 0%,100% { transform: scale(1); opacity: .5; } 50% { transform: scale(1.6); opacity: 1; } }
      `}</style>

      {/* ── Left panel ── */}
      <div style={S.left}>
        <div style={S.grid} />
        <div style={S.ghost}>Lex</div>

        {/* Nav */}
        <div style={{ ...S.nav, ...tr(0) }}>
          <span style={S.logo}>
            <span style={S.logoAccent}>Lex</span>ter
          </span>
          <span style={S.edition}>BLUEBOOK 22ND EDITION</span>
        </div>

        {/* Hero content — stacked */}
        <div style={S.content}>

          <div style={{ ...S.eyebrow, ...tr(.1) }}>
            <div style={S.eyebrowLine} />
            <span style={S.eyebrowText}>LEGAL CITATION ASSISTANT</span>
          </div>

          <h1 style={{ ...S.headline, ...tr(.15) }}>
            Bluebook citations.<br />
            <span style={S.headlineAccent}>Done right.</span>
          </h1>

          <p style={{ ...S.subtext, ...tr(.2) }}>
            Paste any citation info, and Lexter verifies it against
            real legal databases and returns a Bluebook-accurate
            result in seconds.
          </p>

          {/* Demo below text */}
          <div style={{ ...tr(.25) }}>
            <CitationDemo />
          </div>

        </div>

        {/* Ticker */}
        <div style={{ ...S.tickerWrap, opacity: mounted ? .45 : 0, transition: 'opacity .8s .5s ease' }}>
          <div style={S.tickerTrack}>
            {tickerItems.map((cite, i) => (
              <span key={i}>
                <span style={S.tickerDot}>◦</span>{cite}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — auth ── */}
      <div style={{ ...S.right, opacity: mounted ? 1 : 0, transition: 'opacity .6s .25s ease' }}>

        {/* Mode switcher */}
        <div style={S.modeSwitcher}>
          {(['signup', 'login'] as AuthMode[]).map(m => (
            <button key={m} onClick={() => switchMode(m)} style={modeButtonStyle(mode === m)}>
              {m === 'signup' ? 'Sign Up' : 'Sign In'}
            </button>
          ))}
        </div>

        <h2 style={S.authTitle}>{mode === 'signup' ? 'Start for free.' : 'Welcome back.'}</h2>
        <p style={S.authSub}>{mode === 'signup' ? 'No credit card required' : 'Sign in to your account'}</p>

        {done ? (
          <div style={S.doneWrap}>
            <div style={S.doneIcon}>✉</div>
            <p style={S.doneTitle}>Check your inbox</p>
            <p style={S.doneSub}>Sent to {email}</p>
          </div>
        ) : (
          <>
            {/* Fields */}
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

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={isDisabled}
              onMouseDown={e => { if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(.98)' }}
              onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'none' }}
              style={submitButtonStyle(isDisabled)}
            >
              {loading ? 'PLEASE WAIT…' : mode === 'signup' ? 'GET STARTED →' : 'SIGN IN →'}
            </button>

            {/* Mode switch link */}
            <p style={S.switchText}>
              {mode === 'signup' ? 'Have an account? ' : 'No account? '}
              <span onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')} style={S.switchLink}>
                {mode === 'signup' ? 'Sign in' : 'Sign up free'}
              </span>
            </p>

            {/* Trust bullets */}
            <div style={S.trustList}>
              {TRUST_BULLETS.map(t => <span key={t} style={S.trustItem}>{t}</span>)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}