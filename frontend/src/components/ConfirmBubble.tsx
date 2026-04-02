// src/components/ConfirmBubble.tsx
import type { ParseResponse } from '../types'

interface Props {
  parsed:    ParseResponse
  onConfirm: () => void
  onEdit:    (field: string, value: string) => void
  working:   boolean
}

const FIELD_LABELS: Record<string, string> = {
  caseName:                 'Case Name',
  volume:                   'Volume',
  reporter:                 'Reporter',
  firstPage:                'First Page',
  court:                    'Court',
  year:                     'Year',
  pincite:                  'Pincite',
  weightParenthetical:      'Weight Parenthetical',
  explanatoryParenthetical: 'Explanatory Parenthetical',
}

// Rows: [caseName], [volume, reporter, firstPage], [court, year, pincite] or [year, pincite], [weight, explanatory]
function buildRows(isScotus: boolean): string[][] {
  return [
    ['caseName'],
    ['volume', 'reporter', 'firstPage'],
    isScotus ? ['year', 'pincite'] : ['court', 'year', 'pincite'],
    ['weightParenthetical', 'explanatoryParenthetical'],
  ]
}

function Field({ k, parsed, onEdit, placeholder }: {
  k: string
  parsed: ParseResponse
  onEdit: (field: string, value: string) => void
  placeholder?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
      <span style={{
        fontSize: 9, letterSpacing: '.1em', color: 'var(--dimmer)',
        fontFamily: "'DM Mono', monospace", textTransform: 'uppercase',
      }}>
        {FIELD_LABELS[k]}
      </span>
      <input
        type="text"
        defaultValue={String(parsed[k as keyof ParseResponse] ?? '')}
        onChange={e => onEdit(k, e.target.value)}
        placeholder={placeholder || '—'}
        style={{
          width: '100%', background: 'var(--bg)', border: '1px solid var(--border-b)',
          borderRadius: 6, padding: '7px 10px', fontFamily: "'DM Mono', monospace",
          fontSize: 12, color: 'var(--text)', outline: 'none',
          caretColor: 'var(--accent)', transition: 'border-color .15s',
          boxSizing: 'border-box',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-bdr)' }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-b)' }}
      />
    </div>
  )
}

export default function ConfirmBubble({ parsed, onConfirm, onEdit, working }: Props) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border-b)',
      borderRadius: 12, borderBottomLeftRadius: 4,
      overflow: 'hidden', width: 560,
      boxShadow: '0 1px 4px rgba(0,0,0,.2)',
    }}>
      <div style={{
        background: 'var(--surface2)',
        borderBottom: '1px solid var(--border)',
        padding: '8px 16px',
      }}>
        <span style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--accent)', fontFamily: "'DM Mono', monospace" }}>
          CASE FOUND. DOES THIS LOOK RIGHT?
        </span>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {buildRows(!!parsed.isScotus).map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: 10 }}>
            {row.map(k => (
              <Field
                key={k} k={k} parsed={parsed} onEdit={onEdit}
                placeholder={
                  k === 'pincite' || k === 'weightParenthetical' || k === 'explanatoryParenthetical'
                    ? 'optional'
                    : '—'
                }
              />
            ))}
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
          <button
            onClick={onConfirm}
            disabled={working}
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 11, letterSpacing: '.08em', fontWeight: 500,
              background: working ? 'var(--surface2)' : 'var(--accent)',
              color: working ? 'var(--faint)' : '#111009',
              border: 'none', borderRadius: 7, padding: '10px 22px',
              cursor: working ? 'not-allowed' : 'pointer',
              transition: 'background .15s',
            }}
          >
            {working ? 'GENERATING…' : 'LOOKS GOOD →'}
          </button>
        </div>
      </div>
    </div>
  )
}