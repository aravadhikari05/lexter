import type { TickerStep } from '../types'

interface Props {
  steps: TickerStep[]
  done:  boolean
}

export default function StepTicker({ steps, done }: Props) {
  const visible = steps.filter(s => s.status !== 'pending')
  if (!visible.length) return null
  const recent = visible.slice(-3)

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border-b)',
      borderRadius: 12,
      borderBottomLeftRadius: 4,
      overflow: 'hidden',
      minWidth: 280,
      maxWidth: '88%',
      boxShadow: '0 1px 4px rgba(0,0,0,.2)',
    }} className="animate-msg-in">
      {/* Bar */}
      <div style={{
        background: 'var(--surface2)',
        borderBottom: '1px solid var(--border)',
        padding: '7px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {done ? (
            <span style={{ fontSize: 11, color: 'var(--green)' }}>✓</span>
          ) : (
            [0, 1, 2].map(i => (
              <span key={i} style={{
                width: 4, height: 4, borderRadius: '50%',
                background: 'var(--accent)', display: 'inline-block',
                animation: `blink 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))
          )}
        </div>
        <span style={{
          fontSize: 9, letterSpacing: '.12em',
          color: done ? 'var(--green)' : 'var(--faint)',
        }}>
          {done ? 'CITATION BUILT' : 'BUILDING CITATION'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--dimmer)' }}>
          {visible.filter(s => s.status === 'done').length} / {steps.length}
        </span>
      </div>

      {/* Steps */}
      <div style={{ padding: '4px 0' }}>
        {recent.map((step, i) => {
          const isActive = step.status === 'running'
          const opacity  = i === recent.length - 1 ? 1 : i === recent.length - 2 ? 0.38 : 0.14
          return (
            <div key={step.id} className="animate-slide-up" style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '5px 14px', opacity,
              transition: 'opacity .3s',
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: step.status === 'done' ? 'var(--green)' : 'var(--accent)',
                boxShadow: isActive ? '0 0 6px rgba(200,168,75,.5)' : 'none',
                animation: isActive ? 'pulse 1s ease-in-out infinite' : 'none',
                transition: 'background .2s',
              }} />
              <span style={{
                fontSize: 11, letterSpacing: '.05em',
                fontFamily: "'DM Mono', monospace",
                color: isActive ? 'var(--accent)' : 'var(--muted)',
              }}>
                {step.label}
              </span>
              {step.status === 'done' && (
                <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--green)', opacity: 0.7 }}>✓</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
