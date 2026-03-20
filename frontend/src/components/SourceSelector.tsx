// src/components/SourceSelector.tsx
export type IntentId = 'create' | 'validate' | 'explain'
export type SourceId = 'case' | 'statute' | 'regulation' | 'lawreview' | 'book' | 'website'

const INTENTS: { id: IntentId; label: string }[] = [
  { id: 'create',   label: 'Create Citation'  },
  { id: 'validate', label: 'Validate Citation' },
  { id: 'explain',  label: 'Explain Citation'  },
]

const SOURCES: { id: SourceId; label: string; active: boolean }[] = [
  { id: 'case',       label: 'Court Case',        active: true  },
  { id: 'statute',    label: 'Statute',            active: false },
  { id: 'regulation', label: 'Regulation',         active: false },
  { id: 'lawreview',  label: 'Law Review Article', active: false },
  { id: 'book',       label: 'Book',               active: false },
  { id: 'website',    label: 'Website',            active: false },
]

interface Props {
  intent:    IntentId
  source:    SourceId
  setIntent: (v: IntentId) => void
  setSource: (v: SourceId) => void
}

export default function SourceSelector({ intent, source, setIntent, setSource }: Props) {
  const pill = (
    active: boolean,
    onClick: () => void,
    label: string,
    disabled = false,
  ): React.ReactNode => (
    <button
      key={label}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        padding: '4px 10px',
        borderRadius: 20,
        border: active ? '1px solid var(--accent-bdr)' : '1px solid var(--border-b)',
        background: active ? 'var(--accent-bg)' : 'transparent',
        color: disabled ? 'var(--dimmer)' : active ? 'var(--accent)' : 'var(--muted)',
        fontFamily: "'DM Mono', monospace",
        fontSize: 10.5,
        letterSpacing: '.03em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap' as const,
        transition: 'background .12s, color .12s, border-color .12s',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      paddingBottom: 10, borderBottom: '1px solid var(--border)',
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {INTENTS.map(i => pill(intent === i.id, () => setIntent(i.id), i.label))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {SOURCES.map(s => pill(
          source === s.id,
          () => setSource(s.id),
          s.label,
          !s.active,
        ))}
      </div>
    </div>
  )
}