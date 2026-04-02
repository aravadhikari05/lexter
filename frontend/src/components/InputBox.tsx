import { Paperclip, ArrowUp } from 'lucide-react'
import SourceSelector from './SourceSelector'
import type { IntentId, SourceId } from './SourceSelector'

export interface InputBoxProps {
  input:           string
  setInput:        (v: string) => void
  file:            File | null
  setFile:         (v: File | null) => void
  setFileText:     (v: string) => void
  busy:            boolean
  canSend:         boolean
  selectedIntent:  IntentId
  selectedSource:  SourceId
  setIntent:       (v: IntentId) => void
  setSource:       (v: SourceId) => void
  inputRef:        React.RefObject<HTMLTextAreaElement>
  fileRef:         React.RefObject<HTMLInputElement>
  onFocus:         () => void
  onBlur:          () => void
  onSend:          () => void
  onKey:           (e: React.KeyboardEvent) => void
  onFile:          (e: React.ChangeEvent<HTMLInputElement>) => void
}

const placeholderByIntent: Record<IntentId, string> = {
  create:   'Paste a case name, citation, or both\u2026',
  validate: 'Paste a citation to validate\u2026',
  explain:  'Paste a citation to explain\u2026',
}

export default function InputBox({
  input, setInput, file, setFile, setFileText, busy, canSend,
  selectedIntent, selectedSource, setIntent, setSource,
  inputRef, fileRef, onFocus, onBlur, onSend, onKey, onFile,
}: InputBoxProps) {
  return (
    <>
      <SourceSelector
        intent={selectedIntent} source={selectedSource}
        setIntent={setIntent} setSource={setSource}
      />
      {file && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--accent-bg)', border: '1px solid var(--accent-bdr)', borderRadius: 5, padding: '3px 8px', fontSize: 10, color: 'var(--accent)' }}>
            {file.name}
            <span onClick={() => { setFile(null); setFileText('') }} style={{ cursor: 'pointer', opacity: .6, marginLeft: 2 }}>{'\u2715'}</span>
          </span>
        </div>
      )}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-b)', borderRadius: 20, padding: '14px 14px 10px 20px', boxShadow: '0 1px 6px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <textarea
          ref={inputRef} rows={2} value={input}
          onChange={e => {
            setInput(e.target.value)
            e.currentTarget.style.height = 'auto'
            e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 160) + 'px'
          }}
          onKeyDown={onKey}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholderByIntent[selectedIntent]}
          disabled={busy}
          style={{ width: '100%', background: 'none', border: 'none', outline: 'none', resize: 'none', fontFamily: "'Lora', serif", fontSize: 15, color: 'var(--text)', caretColor: 'var(--accent)', lineHeight: 1.6, scrollbarWidth: 'none' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <input ref={fileRef} type="file" accept=".txt,.pdf,.doc,.docx" style={{ display: 'none' }} onChange={onFile} />
          <button onClick={() => fileRef.current?.click()} title="Attach file" style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'none', color: 'var(--faint)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Paperclip size={16} />
          </button>
          <button onClick={onSend} disabled={!canSend} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: canSend ? 'var(--accent)' : 'var(--surface2)', color: canSend ? '#111009' : 'var(--dimmer)', cursor: canSend ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s', flexShrink: 0 }}>
            <ArrowUp size={17} />
          </button>
        </div>
      </div>
    </>
  )
}
