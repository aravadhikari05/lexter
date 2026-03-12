import { useState, useCallback, useEffect, useRef } from 'react'
import { Paperclip, ArrowUp } from 'lucide-react'
import type { ChatMessage, CitPhase, ParsedCase, CaseFields, CitationResult, TickerStep } from './types'
import { parseCase, generateCitation, sendChatMessage } from './lib/api'
import { applyPincite } from './lib/pincite'
import { PARSE_STEPS, GENERATE_STEPS, SUGGESTIONS } from './lib/constants'
import StepTicker from './components/StepTicker'
import GapBubble  from './components/GapBubble'
import CitationCards from './components/CitationCards'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2)
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

function makeSteps(templates: typeof PARSE_STEPS): TickerStep[] {
  return templates.map(s => ({ ...s, status: 'pending' as const }))
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [messages,  setMessages]  = useState<ChatMessage[]>([])
  const [input,     setInput]     = useState('')
  const [file,      setFile]      = useState<File | null>(null)
  const [fileText,  setFileText]  = useState('')
  const [busy,      setBusy]      = useState(false)

  // Citation flow state
  const [citPhase,  setCitPhase]  = useState<CitPhase>('idle')
  const [citSteps,  setCitSteps]  = useState<TickerStep[]>([])
  const [citParsed, setCitParsed] = useState<ParsedCase | null>(null)
  const [citFields, setCitFields] = useState<CaseFields>({})
  const [citResult, setCitResult] = useState<CitationResult | null>(null)
  const [citBase,   setCitBase]   = useState<CitationResult | null>(null)
  const [gapFading, setGapFading] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)
  const abortRef  = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, citPhase, citSteps, citResult])

  // ── Helpers ──
  const addMsg = (msg: Omit<ChatMessage, 'id'>) =>
    setMessages(prev => [...prev, { id: uid(), ...msg }])

  const tickStep = (id: string, status: TickerStep['status']) =>
    setCitSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s))

  const resetCit = () => {
    setCitPhase('idle'); setCitSteps([]); setCitParsed(null)
    setCitFields({}); setCitResult(null); setCitBase(null); setGapFading(false)
  }

  // ── File upload ──
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const text = await f.text()
    setFileText(text.slice(0, 4000))
  }

  // ── Citation flow ──
  const runCitation = async (rawInput: string, extraFields: CaseFields = {}) => {
    setCitPhase('ticker')
    setCitResult(null); setCitBase(null)

    const parseSteps = makeSteps(PARSE_STEPS)
    setCitSteps(parseSteps)

    const apiCall = parseCase(rawInput)

    const advanceParse = async (currentId: string, nextId: string, ms: number) => {
      tickStep(currentId, 'running')
      await delay(ms)
      tickStep(currentId, 'done')
      tickStep(nextId, 'running')
    }

    tickStep('read', 'running')
    await delay(300)
    tickStep('read', 'done')
    await advanceParse('name', 'reporter', 350)
    await advanceParse('reporter', 'court', 300)
    await advanceParse('court', 'fields', 280)

    let parsed: ParsedCase
    try {
      parsed = await apiCall
    } catch {
      addMsg({ role: 'assistant', type: 'text', text: 'Sorry, had trouble parsing that. Try again?' })
      setCitPhase('idle'); setBusy(false); return
    }

    tickStep('fields', 'done')

    const pre: CaseFields = {}
    ;(['caseName','volume','reporter','firstPage','court','year'] as const).forEach(k => {
      if (parsed[k]) pre[k] = String(parsed[k])
    })
    if (parsed.pincite) pre.pincite = parsed.pincite

    setCitParsed(parsed)
    setCitFields({ ...pre, ...extraFields })

    const missing = (parsed.missingFields || []).filter(f => f !== 'docket')
    const warn    = (parsed.needsConfirmation || []).filter(f => f !== 'docket')

    if (missing.length > 0 || warn.length > 0) {
      setCitPhase('gaps')
      setBusy(false)
      return
    }

    await doGenerate(parsed, { ...pre, ...extraFields })
  }

  const doGenerate = async (
    parsedOverride?: ParsedCase | null,
    fieldsOverride?: CaseFields | null,
  ) => {
    const p = parsedOverride || citParsed!
    const f = fieldsOverride || citFields
    const pin = f.pincite || ''

    setCitPhase('ticker')

    const genSteps = makeSteps(GENERATE_STEPS)
    setCitSteps(prev => [...prev, ...genSteps])

    const apiCall = generateCitation(p, f as Record<string, string>, pin)

    const tick = async (id: string, nextId: string, ms: number) => {
      tickStep(id, 'running')
      await delay(ms)
      tickStep(id, 'done')
      tickStep(nextId, 'running')
    }

    await tick('rule', 'paren', 320)
    await tick('paren', 'format', 290)
    await tick('format', 'shortform', 270)
    await tick('shortform', 'render', 250)

    let result: CitationResult
    try {
      result = await apiCall
    } catch {
      addMsg({ role: 'assistant', type: 'text', text: "Couldn't generate that citation. Try again?" })
      setCitPhase('idle'); setBusy(false); return
    }

    tickStep('render', 'done')
    await delay(100)

    setCitBase(result)
    setCitResult(pin ? applyPincite(result, f.firstPage || p.firstPage || '', pin) : result)
    setCitPhase('done')
    setBusy(false)
  }

  const handleGapSubmit = () => {
    setBusy(true)
    setGapFading(true)
    setTimeout(() => {
      setGapFading(false)
      doGenerate()
    }, 350)
  }

  const handleEditFields = () => {
    setCitPhase('gaps')
    setCitResult(null)
    setCitBase(null)
  }

  // ── Send message ──
  const send = useCallback(async (text?: string) => {
    const userText = (text || input).trim()
    if (!userText || busy) return
    setInput('')
    setBusy(true)
    resetCit()

    const content = fileText ? `${userText}\n\n[Attached:]\n${fileText}` : userText
    addMsg({ role: 'user', type: 'text', text: userText, fileName: file?.name })
    setFile(null); setFileText('')

    const thinkId = uid()
    addMsg({ id: thinkId, role: 'assistant', type: 'thinking' } as ChatMessage)

    const history = messages.slice(-10).map(m => ({ role: m.role, content: m.text || '' }))
    history.push({ role: 'user', content })

    const asstId   = uid()
    let   fullText = ''

    try {
      const outcome = await sendChatMessage(userText, history, (token: string) => {
        fullText += token
        setMessages(prev => {
          const without = prev.filter(m => m.id !== thinkId)
          const exists  = without.find(m => m.id === asstId)
          if (exists) return without.map(m => m.id === asstId ? { ...m, text: fullText, streaming: true } : m)
          return [...without, { id: asstId, role: 'assistant' as const, type: 'text' as const, text: fullText, streaming: true }]
        })
      })

      if (outcome.isCite) {
        setMessages(prev => prev.filter(m => m.id !== thinkId && m.id !== asstId))
        addMsg({ role: 'assistant', type: 'text', text: 'Got it — generating your Bluebook citation now.' })
        await delay(300)
        await runCitation(outcome.citeInput || userText)
      } else {
        setMessages(prev => {
          const without = prev.filter(m => m.id !== thinkId)
          return without.map(m => m.id === asstId ? { ...m, streaming: false } : m)
        })
        setBusy(false)
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== thinkId))
      addMsg({ role: 'assistant', type: 'text', text: 'Something went wrong — try again.' })
      setBusy(false)
    }
  }, [input, busy, messages, file, fileText])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const noMessages = messages.length === 0 && citPhase === 'idle'
  const canSend    = input.trim().length > 0 && !busy

  // ─── Styles ───────────────────────────────────────────────────────────────
  const s = {
    shell: {
      display: 'flex', flexDirection: 'column' as const, height: '100vh',
      maxWidth: 760, margin: '0 auto',
    },
    header: {
      flexShrink: 0, padding: '18px 20px 14px',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'baseline', gap: 10,
    },
    messages: {
      flex: 1, overflowY: 'auto' as const, padding: '24px 20px 8px',
      display: 'flex', flexDirection: 'column' as const, gap: 18,
    },
    msgRow: (role: string) => ({
      display: 'flex', flexDirection: 'column' as const, gap: 4,
      alignItems: role === 'user' ? 'flex-end' : 'flex-start',
      animation: 'msgIn .2s ease both',
    }),
    bubble: (role: string) => ({
      maxWidth: '88%', padding: '12px 16px', borderRadius: 12,
      fontFamily: "'Lora', serif", fontSize: 14, lineHeight: 1.75, color: 'var(--text)',
      ...(role === 'user' ? {
        background: 'var(--accent-bg)', border: '1px solid var(--accent-bdr)',
        borderBottomRightRadius: 4,
      } : {
        background: 'var(--surface)', border: '1px solid var(--border-b)',
        borderBottomLeftRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,.2)',
      }),
    }),
  }

  return (
    <div style={s.shell}>
      {/* Header */}
      <div style={s.header}>
        <span style={{ fontFamily: "'Lora', serif", fontSize: 18, fontWeight: 600, fontStyle: 'italic', letterSpacing: '-.01em' }}>
          § <span style={{ color: 'var(--accent)' }}>Citation</span> Assistant
        </span>
        <span style={{ fontSize: 10, color: 'var(--faint)', letterSpacing: '.06em' }}>BLUEBOOK 21ST ED.</span>
      </div>

      {/* Messages */}
      <div style={s.messages}>
        {noMessages ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 10, textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 52, color: 'var(--border)', lineHeight: 1, marginBottom: 4 }}>§</div>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 18, fontStyle: 'italic', color: 'var(--muted)' }}>What do you need to cite?</div>
            <div style={{ fontSize: 10, color: 'var(--dimmer)', lineHeight: 1.7, maxWidth: 360 }}>
              Paste a case name, citation, or ask anything about Bluebook formatting.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 8 }}>
              {SUGGESTIONS.map(sg => (
                <button key={sg} onClick={() => send(sg)} style={{
                  fontSize: 12, color: 'var(--faint)', background: 'var(--surface)',
                  border: '1px solid var(--border-b)', borderRadius: 20, padding: '5px 14px',
                  cursor: 'pointer', transition: 'color .15s',
                  fontFamily: "'Lora', serif",
                }}>
                  {sg}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <div key={msg.id} style={s.msgRow(msg.role)}>
                <div style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--dimmer)', padding: '0 4px' }}>
                  {msg.role === 'user' ? 'YOU' : 'ASSISTANT'}
                </div>
                {msg.type === 'thinking' ? (
                  <div style={{
                    background: 'var(--surface)', border: '1px solid var(--border-b)',
                    borderRadius: 12, borderBottomLeftRadius: 4,
                    padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <div>
                      {[0,1,2].map(i => (
                        <span key={i} style={{
                          width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)',
                          display: 'inline-block', marginRight: 3,
                          animation: `blink 1.2s ease-in-out ${i * 0.2}s infinite`,
                        }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--faint)', fontFamily: "'DM Mono', monospace" }}>thinking…</span>
                  </div>
                ) : (
                  <div style={s.bubble(msg.role)}>
                    {msg.fileName && (
                      <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 6 }}>📄 {msg.fileName}</div>
                    )}
                    {msg.text}
                    {msg.streaming && <span className="cursor" />}
                  </div>
                )}
              </div>
            ))}

            {/* Step ticker */}
            {citPhase === 'ticker' && (
              <div style={s.msgRow('assistant')}>
                <div style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--dimmer)', padding: '0 4px' }}>ASSISTANT</div>
                <StepTicker steps={citSteps} done={false} />
              </div>
            )}

            {/* Gap form */}
            {(citPhase === 'gaps' || gapFading) && citParsed && (
              <div style={{
                ...s.msgRow('assistant'),
                opacity: gapFading ? 0 : 1,
                transform: gapFading ? 'translateY(-4px)' : 'none',
                transition: 'opacity .3s ease, transform .3s ease',
              }}>
                <div style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--dimmer)', padding: '0 4px' }}>ASSISTANT</div>
                <GapBubble
                  parsed={citParsed}
                  fields={citFields}
                  setFields={setCitFields}
                  onSubmit={handleGapSubmit}
                  working={busy}
                />
              </div>
            )}

            {/* Citation cards */}
            {citPhase === 'done' && citResult && (
              <div style={s.msgRow('assistant')}>
                <div style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--dimmer)', padding: '0 4px' }}>ASSISTANT</div>
                <CitationCards result={citResult} onEdit={handleEditFields} />
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{ padding: '12px 20px 24px', background: 'var(--bg)' }}>
        {file && (
          <div style={{ marginBottom: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'var(--accent-bg)', border: '1px solid var(--accent-bdr)',
              borderRadius: 5, padding: '3px 8px', fontSize: 10, color: 'var(--accent)',
            }}>
              📄 {file.name}
              <span onClick={() => { setFile(null); setFileText('') }} style={{ cursor: 'pointer', opacity: .6, marginLeft: 2 }}>✕</span>
            </span>
          </div>
        )}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border-b)',
          borderRadius: 20, padding: '14px 14px 10px 20px',
          boxShadow: '0 1px 6px rgba(0,0,0,.3)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <textarea
            ref={inputRef}
            rows={2}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              e.currentTarget.style.height = 'auto'
              e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 160) + 'px'
            }}
            onKeyDown={handleKey}
            placeholder="Paste a citation, ask a question, or say 'cite Brown v Board…'"
            disabled={busy}
            style={{
              width: '100%', background: 'none', border: 'none', outline: 'none', resize: 'none',
              fontFamily: "'Lora', serif", fontSize: 15, color: 'var(--text)',
              caretColor: 'var(--accent)', lineHeight: 1.6,
              scrollbarWidth: 'none',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <input ref={fileRef} type="file" accept=".txt,.pdf,.doc,.docx" style={{ display: 'none' }} onChange={handleFile} />
            <button
              onClick={() => fileRef.current?.click()}
              title="Attach file"
              style={{
                width: 34, height: 34, borderRadius: '50%', border: 'none',
                background: 'none', color: 'var(--faint)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Paperclip size={16} />
            </button>
            <button
              onClick={() => send()}
              disabled={!canSend}
              style={{
                width: 38, height: 38, borderRadius: '50%', border: 'none',
                background: canSend ? 'var(--accent)' : 'var(--surface2)',
                color: canSend ? '#111009' : 'var(--dimmer)',
                cursor: canSend ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background .15s', flexShrink: 0,
              }}
            >
              <ArrowUp size={17} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}