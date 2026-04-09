// src/components/CitationCards.tsx
import { useState, useCallback } from 'react'
import { Pencil, AlertTriangle, ChevronDown, ThumbsUp, ThumbsDown, X } from 'lucide-react'
import type { CitationResult } from '../types'

interface Tab { key: string; label: string; dot: string; html: string }

interface Props {
  result:      CitationResult
  onEdit:      () => void
  sourceUrl?:  string | null
  prompt?:     string
  onFeedback?: (rating: 'approved' | 'rejected', feedbackText?: string) => Promise<void>
}

export default function CitationCards({ result, onEdit, sourceUrl, onFeedback }: Props) {
  const [tab, setTab]           = useState('acad')
  const [copied, setCopied]     = useState<string | null>(null)
  const [warnOpen, setWarnOpen] = useState(false)
  const [feedbackState, setFeedbackState] = useState<'idle' | 'open' | 'done'>('idle')
  const [feedbackText, setFeedbackText]   = useState('')
  const [submitting, setSubmitting]       = useState(false)
  const [submitted, setSubmitted]         = useState<'approved' | 'rejected' | null>(null)

  const warnings = result.validationWarnings ?? []

  const TABS: Tab[] = [
    { key: 'acad',  label: 'ACADEMIC',     dot: 'var(--accent)', html: result.academicFull },
    { key: 'short', label: 'SHORT',        dot: 'var(--muted)',  html: result.shortForm },
    { key: 'full',  label: 'PRACTITIONER', dot: 'var(--green)',  html: result.fullCitation },
  ]

  const copy = useCallback((html: string, key: string) => {
    navigator.clipboard?.writeText(html.replace(/<[^>]+>/g, ''))
    setCopied(key)
    setTimeout(() => setCopied(null), 1600)
  }, [])

  const handleThumbsUp = async () => {
    if (submitted || !onFeedback) return
    setSubmitting(true)
    await onFeedback('approved')
    setSubmitting(false)
    setSubmitted('approved')
  }

  const handleThumbsDown = () => { if (!submitted) setFeedbackState('open') }

  const handleSubmit = async () => {
    if (!onFeedback) return
    setSubmitting(true)
    await onFeedback('rejected', feedbackText.trim())
    setSubmitting(false)
    setSubmitted('rejected')
    setFeedbackState('done')
  }

  const dismiss = () => { setFeedbackState('idle'); setFeedbackText('') }

  const thumbBtn = (active: boolean): React.CSSProperties => ({
    width: 26, height: 26, borderRadius: 6,
    border: `1px solid ${active ? 'var(--accent-bdr)' : 'var(--border-b)'}`,
    background: active ? 'var(--accent-bg)' : 'none',
    color: active ? 'var(--accent)' : 'var(--faint)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'color .15s, border-color .15s, background .15s', flexShrink: 0,
  })

  return (
    <div style={{ width: '100%', maxWidth: '92%' }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border-b)',
        borderRadius: 8, overflow: 'hidden',
        boxShadow: '0 1px 6px rgba(0,0,0,.25)',
      }}>

        {/* Tab bar */}
        <div style={{
          background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 2, padding: '4px 6px',
          overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
        }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              fontFamily: "'Inter', sans-serif", fontSize: 8.5, letterSpacing: '.09em',
              padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
              background: tab === t.key ? 'var(--bg)' : 'none',
              color:      tab === t.key ? 'var(--text)' : 'var(--faint)',
              border:     tab === t.key ? '1px solid var(--border-b)' : '1px solid transparent',
              transition: 'color .15s, background .15s',
              display: 'flex', alignItems: 'center', gap: 4,
              whiteSpace: 'nowrap', flexShrink: 0, minHeight: 26,
            }}>
              <span style={{
                width: 4, height: 4, borderRadius: '50%', flexShrink: 0,
                background: tab === t.key ? t.dot : 'var(--dimmer)',
                transition: 'background .15s',
              }} />
              {t.label}
            </button>
          ))}
          <button onClick={onEdit} title="Edit" style={{
            marginLeft: 'auto', width: 26, height: 26, borderRadius: 5,
            border: '1px solid var(--border-b)', background: 'none',
            color: 'var(--faint)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Pencil size={10} style={{ transform: 'rotate(170deg)' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'grid' }}>
          {TABS.map(t => (
            <div key={t.key} style={{
              gridArea: '1/1', padding: '10px 12px',
              display: 'flex', flexDirection: 'column', gap: 8,
              opacity:       t.key === tab ? 1 : 0,
              pointerEvents: t.key === tab ? 'auto' : 'none',
              visibility:    t.key === tab ? 'visible' : 'hidden',
              transition: 'opacity .15s',
            }}>
              <p style={{
                fontFamily: "'Inter', sans-serif", fontSize: 13, lineHeight: 1.75,
                color: 'var(--text)', margin: 0,
              }} dangerouslySetInnerHTML={{ __html: t.html }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => copy(t.html, t.key)} style={{
                  fontFamily: "'Inter', sans-serif", fontSize: 9, letterSpacing: '.06em',
                  background: copied === t.key ? 'var(--green-bg)' : 'var(--accent-bg)',
                  color:      copied === t.key ? 'var(--green)'    : 'var(--accent)',
                  border:    `1px solid ${copied === t.key ? 'var(--green-bdr)' : 'var(--accent-bdr)'}`,
                  borderRadius: 4, padding: '4px 12px', cursor: 'pointer',
                  transition: 'background .15s', whiteSpace: 'nowrap', minHeight: 26,
                }}>
                  {copied === t.key ? '✓ COPIED' : 'COPY'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <button onClick={() => setWarnOpen(o => !o)} style={{
              width: '100%', cursor: 'pointer', background: 'none', border: 'none',
              padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5,
              color: 'var(--amber, #d4a017)', minHeight: 28,
            }}>
              <AlertTriangle size={10} style={{ flexShrink: 0 }} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 8.5, letterSpacing: '.08em' }}>
                {warnings.length} {warnings.length === 1 ? 'WARNING' : 'WARNINGS'}
              </span>
              <ChevronDown size={10} style={{
                marginLeft: 'auto', flexShrink: 0,
                transform: warnOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform .15s',
              }} />
            </button>
            {warnOpen && (
              <ul style={{ margin: 0, padding: '0 12px 8px 28px', listStyle: 'disc' }}>
                {warnings.map((w, i) => (
                  <li key={i} style={{
                    fontFamily: "'Inter', sans-serif", fontSize: 11, lineHeight: 1.6,
                    color: 'var(--amber, #d4a017)',
                  }}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Source */}
        {sourceUrl && (
          <div style={{
            borderTop: '1px solid var(--border)', padding: '5px 12px',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 8.5, color: 'var(--dimmer)', letterSpacing: '.08em' }}>SOURCE:</span>
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" style={{
              fontFamily: "'Inter', sans-serif", fontSize: 8.5, letterSpacing: '.06em',
              color: 'var(--accent)', textDecoration: 'none', opacity: .7, transition: 'opacity .15s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '.7' }}
            >COURTLISTENER ↗</a>
          </div>
        )}

        {/* Feedback */}
        {onFeedback && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '5px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 8.5, letterSpacing: '.07em', color: 'var(--dimmer)' }}>
                {submitted === 'approved' ? 'THANKS!' : submitted === 'rejected' ? 'NOTED' : 'HELPFUL?'}
              </span>
              {!submitted && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                  <button onClick={handleThumbsUp} disabled={submitting || feedbackState === 'open'}
                    style={{ ...thumbBtn(false), opacity: feedbackState === 'open' ? 0.3 : 1 }}
                    onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = 'var(--green)'; b.style.borderColor = 'var(--green-bdr)'; b.style.background = 'var(--green-bg)' }}
                    onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = 'var(--faint)'; b.style.borderColor = 'var(--border-b)'; b.style.background = 'none' }}
                  ><ThumbsUp size={11} /></button>
                  <button onClick={handleThumbsDown} disabled={submitting} style={thumbBtn(feedbackState === 'open')}
                    onMouseEnter={e => { if (feedbackState !== 'open') { const b = e.currentTarget as HTMLButtonElement; b.style.color = 'var(--accent)'; b.style.borderColor = 'var(--accent-bdr)'; b.style.background = 'var(--accent-bg)' }}}
                    onMouseLeave={e => { if (feedbackState !== 'open') { const b = e.currentTarget as HTMLButtonElement; b.style.color = 'var(--faint)'; b.style.borderColor = 'var(--border-b)'; b.style.background = 'none' }}}
                  ><ThumbsDown size={11} /></button>
                </div>
              )}
              {submitted === 'approved' && <div style={{ marginLeft: 'auto', color: 'var(--green)' }}><ThumbsUp size={11} /></div>}
              {submitted === 'rejected' && <div style={{ marginLeft: 'auto', color: 'var(--accent)' }}><ThumbsDown size={11} /></div>}
            </div>

            <div style={{ display: 'grid', gridTemplateRows: feedbackState === 'open' ? '1fr' : '0fr', transition: 'grid-template-rows .2s ease' }}>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 2 }}>
                  <div style={{ position: 'relative' }}>
                    <textarea
                      autoFocus={feedbackState === 'open'}
                      value={feedbackText}
                      onChange={e => setFeedbackText(e.target.value)}
                      placeholder="What went wrong? (optional)"
                      rows={2}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: 'var(--bg)', border: '1px solid var(--border-b)',
                        borderRadius: 5, padding: '6px 28px 6px 10px',
                        fontFamily: "'Inter', sans-serif", fontSize: 12, lineHeight: 1.5,
                        color: 'var(--text)', caretColor: 'var(--accent)',
                        outline: 'none', resize: 'none', scrollbarWidth: 'none',
                        transition: 'border-color .15s',
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-bdr)' }}
                      onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--border-b)' }}
                    />
                    <button onClick={dismiss} style={{
                      position: 'absolute', top: 5, right: 6,
                      width: 16, height: 16, borderRadius: 3,
                      border: 'none', background: 'none', color: 'var(--dimmer)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                    }}><X size={10} /></button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 5 }}>
                    <button onClick={dismiss} style={{
                      fontFamily: "'Inter', sans-serif", fontSize: 9, letterSpacing: '.06em',
                      background: 'none', border: '1px solid var(--border-b)',
                      color: 'var(--faint)', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', minHeight: 24,
                    }}>CANCEL</button>
                    <button onClick={handleSubmit} disabled={submitting} style={{
                      fontFamily: "'Inter', sans-serif", fontSize: 9, letterSpacing: '.06em',
                      background: submitting ? 'var(--surface2)' : 'var(--accent)',
                      color: submitting ? 'var(--faint)' : '#111009',
                      border: 'none', borderRadius: 4, padding: '3px 12px',
                      cursor: submitting ? 'not-allowed' : 'pointer', minHeight: 24,
                    }}>{submitting ? 'SENDING…' : 'SEND'}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}