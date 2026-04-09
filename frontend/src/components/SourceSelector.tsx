// src/components/SourceSelector.tsx
export type IntentId = 'create' | 'validate' | 'explain'
export type SourceId = 'case' | 'statute' | 'regulation' | 'lawreview' | 'book' | 'website'

const INTENTS: { id: IntentId; label: string; active: boolean }[] = [
  { id: 'create',   label: 'Create',   active: true  },
  { id: 'validate', label: 'Validate', active: false },
  { id: 'explain',  label: 'Explain',  active: false },
]

const SOURCES: { id: SourceId; label: string; active: boolean }[] = [
  { id: 'case',       label: 'Case',       active: true  },
  { id: 'statute',    label: 'Statute',    active: false },
  { id: 'regulation', label: 'Regulation', active: false },
  { id: 'lawreview',  label: 'Law Review', active: false },
  { id: 'book',       label: 'Book',       active: false },
  { id: 'website',    label: 'Website',    active: false },
]

interface Props {
  intent:    IntentId
  source:    SourceId
  setIntent: (v: IntentId) => void
  setSource: (v: SourceId) => void
}

export default function SourceSelector({ intent, source, setIntent, setSource }: Props) {
  const pill = (active: boolean, onClick: () => void, label: string, disabled = false): React.ReactNode => (
    <button
      key={label}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        padding: '3px 9px', minHeight: 24, borderRadius: 20,
        border: active ? '1px solid var(--accent-bdr)' : '1px solid var(--border-b)',
        background: active ? 'var(--accent-bg)' : 'transparent',
        color: disabled ? 'var(--dimmer)' : active ? 'var(--accent)' : 'var(--muted)',
        fontFamily: "'Inter', sans-serif",
        fontSize: 10, letterSpacing: '.03em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap' as const, flexShrink: 0,
        transition: 'background .12s, color .12s, border-color .12s',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      paddingBottom: 8, borderBottom: '1px solid var(--border)', marginBottom: 8,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
      }}>
        {INTENTS.map(i => pill(intent === i.id, () => setIntent(i.id), i.label, !i.active))}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
      }}>
        {SOURCES.map(s => pill(source === s.id, () => setSource(s.id), s.label, !s.active))}
      </div>
    </div>
  )
}