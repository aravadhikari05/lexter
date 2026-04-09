// src/components/StepTicker.tsx
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
      background: 'var(--surface)', border: '1px solid var(--border-b)',
      borderRadius: 10, borderBottomLeftRadius: 4,
      overflow: 'hidden', width: '100%', maxWidth: 360,
      boxShadow: '0 1px 4px rgba(0,0,0,.2)',
    }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
        padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 7,
      }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {done ? (
            <span style={{ fontSize: 10, color: 'var(--green)' }}>✓</span>
          ) : (
            [0, 1, 2].map(i => (
              <span key={i} style={{
                width: 3, height: 3, borderRadius: '50%',
                background: 'var(--accent)', display: 'inline-block',
                animation: `blink 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))
          )}
        </div>
        <span style={{
          fontFamily: "'Inter', sans-serif", fontSize: 8.5, letterSpacing: '.11em',
          color: done ? 'var(--green)' : 'var(--faint)',
        }}>
          {done ? 'DONE' : 'BUILDING'}
        </span>
        <span style={{ marginLeft: 'auto', fontFamily: "'Inter', sans-serif", fontSize: 8.5, color: 'var(--dimmer)' }}>
          {visible.filter(s => s.status === 'done').length}/{steps.length}
        </span>
      </div>

      {/* Steps */}
      <div style={{ padding: '2px 0' }}>
        {recent.map((step, i) => {
          const isActive = step.status === 'running'
          const opacity  = i === recent.length - 1 ? 1 : i === recent.length - 2 ? 0.35 : 0.12
          return (
            <div key={step.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 12px', opacity, transition: 'opacity .3s',
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                background: step.status === 'done' ? 'var(--green)' : 'var(--accent)',
                boxShadow: isActive ? '0 0 5px rgba(200,168,75,.5)' : 'none',
                animation: isActive ? 'pulse 1s ease-in-out infinite' : 'none',
                transition: 'background .2s',
              }} />
              <span style={{
                fontSize: 11, letterSpacing: '.03em',
                fontFamily: "'Inter', sans-serif",
                color: isActive ? 'var(--accent)' : 'var(--muted)',
              }}>
                {step.label}
              </span>
              {step.status === 'done' && (
                <span style={{ marginLeft: 'auto', fontSize: 8.5, color: 'var(--green)', opacity: 0.7 }}>✓</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}