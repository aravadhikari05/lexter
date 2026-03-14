import { useState, useCallback } from 'react'
import { Pencil } from 'lucide-react'
import type { CitationResult } from '../types'

interface Tab {
  key:   string
  label: string
  rule:  string
  dot:   string
  html:  string
}

interface Props {
  result:     CitationResult
  onEdit:     () => void
  sourceUrl?: string | null
}

export default function CitationCards({ result, onEdit, sourceUrl }: Props) {
  const [tab, setTab]       = useState<string>('acad')
  const [copied, setCopied] = useState<string | null>(null)

  const TABS: Tab[] = [
    { key: 'acad',  label: 'ACADEMIC',     rule: 'Rule 10 · small caps', dot: 'var(--accent)', html: result.academicFull },
    { key: 'short', label: 'SHORT FORM',   rule: 'Rule 10.9',            dot: 'var(--muted)',  html: result.shortForm },
    { key: 'full',  label: 'PRACTITIONER', rule: 'Rule 10 · italics',    dot: 'var(--green)',  html: result.fullCitation },
  ]
  const active = TABS.find(t => t.key === tab)!

  const copy = useCallback((html: string, key: string) => {
    navigator.clipboard?.writeText(html.replace(/<[^>]+>/g, ''))
    setCopied(key)
    setTimeout(() => setCopied(null), 1600)
  }, [])

  return (
    <div className="animate-fade-up" style={{ maxWidth: '92%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-b)',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 0 0 1px rgba(74,74,50,.1), 0 2px 8px rgba(0,0,0,.3)',
      }}>

        {/* ── Tab switcher ── */}
        <div style={{
          background: 'var(--surface2)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px',
        }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 9, letterSpacing: '.1em',
                padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                background: tab === t.key ? 'var(--bg)' : 'none',
                color:      tab === t.key ? 'var(--text)' : 'var(--faint)',
                border:     tab === t.key ? '1px solid var(--border-b)' : '1px solid transparent',
                transition: 'color .15s, background .15s',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                flexShrink: 0, display: 'inline-block',
                background: tab === t.key ? t.dot : 'var(--dimmer)',
                transition: 'background .15s',
              }} />
              {t.label}
            </button>
          ))}

          {/* Edit button */}
          <button
            onClick={onEdit}
            title="Edit fields"
            style={{
              marginLeft: 'auto',
              width: 30, height: 30, borderRadius: 7,
              border: '1px solid var(--border-b)',
              background: 'none', color: 'var(--faint)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color .15s',
            }}
          >
            <Pencil size={12} style={{ transform: 'rotate(170deg)' }} />
          </button>
        </div>

        {/* ── Grid-stacked bodies ── */}
        <div style={{ display: 'grid' }}>
          {TABS.map(t => (
            <div
              key={t.key}
              style={{
                gridArea: '1/1',
                padding: '12px 14px',
                display: 'flex', alignItems: 'flex-start', gap: 10,
                opacity:       t.key === tab ? 1 : 0,
                pointerEvents: t.key === tab ? 'auto' : 'none',
                visibility:    t.key === tab ? 'visible' : 'hidden',
                transition: 'opacity .18s ease',
              }}
            >
              <p
                style={{
                  fontFamily: "'Lora', serif",
                  fontSize: 14, lineHeight: 1.85,
                  color: 'var(--text)', flex: 1, minWidth: 0,
                  margin: 0,
                }}
                dangerouslySetInnerHTML={{ __html: t.html }}
              />
              <button
                onClick={() => copy(t.html, t.key)}
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10, letterSpacing: '.06em',
                  background: copied === t.key ? 'var(--green-bg)' : 'var(--accent-bg)',
                  color:      copied === t.key ? 'var(--green)'    : 'var(--accent)',
                  border:    `1px solid ${copied === t.key ? 'var(--green-bdr)' : 'var(--accent-bdr)'}`,
                  borderRadius: 5, padding: '4px 10px', cursor: 'pointer',
                  transition: 'background .15s', whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                {copied === t.key ? '✓' : 'COPY'}
              </button>
            </div>
          ))}
        </div>

        {/* ── Footer: rules + optional CourtListener source ── */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '7px 14px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: '.08em' }}>
            RULES USED:
          </span>
          <span style={{ fontSize: 9, color: 'var(--faint)', letterSpacing: '.06em' }}>
            {active.rule}
          </span>

          {sourceUrl && (
            <>
              <span style={{ fontSize: 9, color: 'var(--dimmer)' }}>·</span>
              <span style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: '.08em' }}>
                SOURCE:
              </span>
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 9, letterSpacing: '.06em',
                  color: 'var(--accent)', textDecoration: 'none', opacity: .7,
                  transition: 'opacity .15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '.7' }}
              >
                COURTLISTENER ↗
              </a>
            </>
          )}
        </div>

      </div>
    </div>
  )
}