import type { ParsedCase, CaseFields } from '../types'
import { FIELD_META, REPORTER_GROUP } from '../lib/constants'

interface Props {
  parsed:    ParsedCase
  fields:    CaseFields
  setFields: React.Dispatch<React.SetStateAction<CaseFields>>
  onSubmit:  () => void
  working:   boolean
}

export default function GapBubble({ parsed, fields, setFields, onSubmit, working }: Props) {
  const gapFields  = (parsed.missingFields  || []).filter(f => f !== 'docket')
  const warnFields = (parsed.needsConfirmation || []).filter(f => f !== 'docket')
  const editFields = [...new Set([...gapFields, ...warnFields])]
  const lockedFields = Object.keys(FIELD_META).filter(k => parsed[k as keyof ParsedCase] && !editFields.includes(k))
  const allFilled  = gapFields.filter(f => f !== 'docket').every(f => fields[f]?.trim())
  const setF = (k: string, v: string) => setFields(prev => ({ ...prev, [k]: v }))

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--warn-bdr)',
      borderRadius: 12, borderBottomLeftRadius: 4,
      overflow: 'hidden', maxWidth: '92%',
      boxShadow: '0 1px 6px rgba(0,0,0,.3)',
    }} className="animate-msg-in">
      {/* Header */}
      <div style={{
        background: 'var(--warn-bg)',
        borderBottom: '1px solid var(--warn-bdr)',
        padding: '8px 14px',
        display: 'flex', alignItems: 'center', gap: 7,
      }}>
        <span style={{ color: 'var(--warn)', fontSize: 12 }}>◎</span>
        <span style={{ fontSize: 10, letterSpacing: '.08em', color: 'var(--warn)' }}>
          {gapFields.length > 0
            ? `Need ${gapFields.length} more field${gapFields.length > 1 ? 's' : ''} to continue`
            : 'Please confirm these fields'}
        </span>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Locked pills */}
        {lockedFields.filter(k => parsed[k as keyof ParsedCase]).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {lockedFields.filter(k => parsed[k as keyof ParsedCase]).map(k => (
              <span key={k} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'var(--green-bg)', border: '1px solid var(--green-bdr)',
                borderRadius: 4, padding: '2px 8px', margin: '2px 3px 2px 0',
                fontSize: 10, color: 'var(--green)',
              }}>
                <span style={{ color: 'var(--faint)', marginRight: 2 }}>{FIELD_META[k]?.label}</span>
                {String(parsed[k as keyof ParsedCase])}
              </span>
            ))}
          </div>
        )}

        {warnFields.length > 0 && (
          <div style={{ fontSize: 10, color: 'var(--warn)', lineHeight: 1.6 }}>
            ⚠ These fields were guessed — please confirm or correct.
          </div>
        )}

        {/* Reporter group */}
        {editFields.some(f => REPORTER_GROUP.includes(f as typeof REPORTER_GROUP[number])) && (
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px', gap: 8 }}>
            {REPORTER_GROUP.map(k => (
              <div key={k}>
                <label style={{ fontSize: 9, letterSpacing: '.14em', color: 'var(--faint)', display: 'block', marginBottom: 4 }}>
                  {FIELD_META[k].label}
                  {warnFields.includes(k) && <span style={{ color: 'var(--warn)' }}> · confirm</span>}
                </label>
                <input
                  className={`form-input ${warnFields.includes(k) ? 'warn' : ''}`}
                  type="text"
                  value={fields[k] || ''}
                  onChange={e => setF(k, e.target.value)}
                  placeholder={FIELD_META[k].placeholder}
                />
              </div>
            ))}
          </div>
        )}

        {/* Other fields */}
        {editFields.filter(k => !REPORTER_GROUP.includes(k as typeof REPORTER_GROUP[number])).map(k => (
          <div key={k}>
            <label style={{ fontSize: 9, letterSpacing: '.14em', color: 'var(--faint)', display: 'block', marginBottom: 4 }}>
              {FIELD_META[k]?.label || k}
              {warnFields.includes(k) && <span style={{ color: 'var(--warn)' }}> · confirm</span>}
            </label>
            <input
              className={`form-input ${warnFields.includes(k) ? 'warn' : ''}`}
              type="text"
              value={fields[k] || ''}
              onChange={e => setF(k, e.target.value)}
              placeholder={FIELD_META[k]?.placeholder || ''}
            />
          </div>
        ))}

        {/* Pincite — always optional */}
        <div>
          <label style={{ fontSize: 9, letterSpacing: '.14em', color: 'var(--faint)', display: 'block', marginBottom: 4 }}>
            PINCITE <span style={{ color: 'var(--dimmer)' }}>· optional</span>
          </label>
          <input
            className="form-input"
            type="text"
            value={fields.pincite || ''}
            onChange={e => setF('pincite', e.target.value)}
            placeholder="e.g. 132"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
          <button
            onClick={onSubmit}
            disabled={!allFilled || working}
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 11, letterSpacing: '.08em', fontWeight: 500,
              background: (!allFilled || working) ? 'var(--surface2)' : 'var(--accent)',
              color: (!allFilled || working) ? 'var(--faint)' : '#111009',
              border: 'none', borderRadius: 7, padding: '9px 20px',
              cursor: (!allFilled || working) ? 'not-allowed' : 'pointer',
              transition: 'opacity .15s',
              boxShadow: (!allFilled || working) ? 'none' : '0 1px 4px rgba(200,168,75,.3)',
            }}
          >
            {working ? 'GENERATING…' : 'GENERATE →'}
          </button>
        </div>
      </div>
    </div>
  )
}
