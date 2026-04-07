import type { ParseResponse } from '../types'

interface Props {
  parsed:    ParseResponse
  onConfirm: () => void
  onEdit:    (field: string, value: string) => void
  working:   boolean
}

type ParseField = keyof ParseResponse

const FIELD_LABELS: Partial<Record<ParseField, string>> = {
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

function buildRows(isScotus: boolean): ParseField[][] {
  return [
    ['caseName'],
    ['volume', 'reporter', 'firstPage'],
    isScotus ? ['year', 'pincite'] : ['court', 'year', 'pincite'],
    ['weightParenthetical', 'explanatoryParenthetical'],
  ]
}

function Field({ k, parsed, onEdit, placeholder, autoFilledSource }: {
  k:                ParseField
  parsed:           ParseResponse
  onEdit:           (field: string, value: string) => void
  placeholder?:     string
  autoFilledSource?: string | null
}) {
  const autoFilled = !!autoFilledSource
  const borderDefault = autoFilled ? '#7a7a5a' : 'var(--border-b)'
  const val = (parsed as unknown as Record<string, unknown>)[k as string]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
      <span style={{
        fontSize: 9, letterSpacing: '.1em',
        color: autoFilled ? 'var(--muted)' : 'var(--dimmer)',
        fontFamily: "'Inter', sans-serif", textTransform: 'uppercase',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        {FIELD_LABELS[k]}
        {autoFilled && (
          <span style={{
            fontSize: 8, letterSpacing: '.06em',
            background: 'rgba(255,255,255,0.05)',
            color: 'var(--muted)', borderRadius: 3,
            padding: '1px 5px', fontWeight: 600,
            border: '1px solid var(--border)',
          }}>
            {autoFilledSource === 'CL' ? 'COURTLISTENER' : 'LLM'}
          </span>
        )}
      </span>
      <input
        type="text"
        defaultValue={String(val ?? '')}
        onChange={e => onEdit(k as string, e.target.value)}
        placeholder={placeholder || '—'}
        style={{
          width: '100%',
          background: 'var(--bg)',
          border: `1px solid ${borderDefault}`,
          borderRadius: 6, padding: '7px 10px',
          fontFamily: "'Inter', sans-serif",
          fontSize: 12, color: 'var(--text)', outline: 'none',
          caretColor: 'var(--accent)', transition: 'border-color .15s',
          boxSizing: 'border-box',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-bdr)' }}
        onBlur={e =>  { e.currentTarget.style.borderColor = borderDefault }}
      />
    </div>
  )
}

export default function ConfirmBubble({ parsed, onConfirm, onEdit, working }: Props) {
  const autoFilledMap = parsed.autoFilled ?? {}
  const hasAutoFilled = Object.keys(autoFilledMap).length > 0

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
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--accent)', fontFamily: "'Inter', sans-serif" }}>
          CASE FOUND. DOES THIS LOOK RIGHT?
        </span>
        {hasAutoFilled && (
          <span style={{
            fontSize: 8, letterSpacing: '.08em',
            fontFamily: "'Inter', sans-serif",
            color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            some fields were filled in automatically
          </span>
        )}
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {buildRows(!!parsed.isScotus).map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: 10 }}>
            {row.map(k => (
              <Field
                key={k as string} k={k} parsed={parsed} onEdit={onEdit}
                autoFilledSource={autoFilledMap[k as string] ?? null}
                placeholder={
                  k === 'pincite' || k === 'weightParenthetical' || k === 'explanatoryParenthetical'
                    ? 'optional' : '—'
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
              fontFamily: "'Inter', sans-serif",
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