import { useState, useCallback, useEffect, useRef } from 'react'
import type { ChatMessage, ParseResponse, CitationResult } from './types'
import type { IntentId, SourceId } from './components/SourceSelector'
import Sidebar from './components/Sidebar'
import InputBox from './components/InputBox'
import ConfirmBubble from './components/ConfirmBubble'
import CitationCards from './components/CitationCards'
import StepTicker from './components/StepTicker'

const API = 'http://localhost:8000'

const uid = () => Math.random().toString(36).slice(2)

export default function App() {
  const [messages,     setMessages]     = useState<ChatMessage[]>([])
  const [input,        setInput]        = useState('')
  const [file,         setFile]         = useState<File | null>(null)
  const [fileText,     setFileText]     = useState('')
  const [busy,         setBusy]         = useState(false)
  const [inputFocused, setInputFocused] = useState(false)

  const [selectedIntent, setSelectedIntent] = useState<IntentId>('create')
  const [selectedSource, setSelectedSource] = useState<SourceId>('case')

  const [pendingParsed,   setPendingParsed]   = useState<ParseResponse | null>(null)
  const [pendingEdits,    setPendingEdits]     = useState<Record<string, string>>({})
  const [confirmWorking,  setConfirmWorking]   = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMsg = (msg: Omit<ChatMessage, 'id'>) =>
    setMessages(prev => [...prev, { id: uid(), ...msg }])

  const handleNewChat = () => {
    setMessages([]); setInput(''); setFile(null); setFileText(''); setBusy(false)
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setFileText((await f.text()).slice(0, 4000))
  }

  // ── Chat stream ────────────────────────────────────────────────────────────
  const runChat = async (userText: string, content: string) => {
    const thinkId = uid()
    addMsg({ id: thinkId, role: 'assistant', type: 'thinking' } as ChatMessage)

    const history = messages.slice(-10).map(m => ({ role: m.role, content: m.text || '' }))
    history.push({ role: 'user', content })

    const asstId = uid()
    let fullText = ''

    try {
      const res = await fetch(`${API}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:     userText,
          history,
          intent:      selectedIntent,
          source_type: selectedSource,
        }),
      })
      if (!res.ok) throw new Error('chat failed')

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n'); buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim(); if (!payload) continue
          let evt: Record<string, unknown>
          try { evt = JSON.parse(payload) } catch { continue }
          if (evt.type === 'done') break

          if (evt.type === 'step') {
            const { id, status, label } = evt as { id: string; status: string; label?: string }
            setMessages(prev => {
              const without = prev.filter(m => m.id !== thinkId)
              const exists  = without.find(m => m.id === asstId)
              const newStep = { id, label: label ?? id, status: status as 'running' | 'done', icon: '◦' }
              if (exists) {
                return without.map(m => m.id === asstId
                  ? { ...m, steps: (m.steps || []).map((s: any) => s.id === id ? { ...s, status } : s).concat(
                      (m.steps || []).find((s: any) => s.id === id) ? [] : [newStep]
                    )}
                  : m)
              }
              return [...without, { id: asstId, role: 'assistant' as const, type: 'ticker' as const, steps: [newStep] }]
            })
            continue
          }

          if (evt.type === 'confirm') {
            const parsed = evt.parsed as ParseResponse
            setPendingParsed(parsed)
            setPendingEdits({})
            setMessages(prev => prev.map(m =>
              m.id === asstId ? { ...m, type: 'confirm' as const, parsed } : m
            ))
            setBusy(false)
            return
          }

          if (evt.type === 'citation') {
            setMessages(prev => prev.map(m =>
              m.id === asstId ? { ...m, type: 'citation' as const, citation: evt.data as CitationResult } : m
            ))
            setBusy(false)
            return
          }

          if (evt.type === 'token' && typeof evt.token === 'string') {
            fullText += evt.token
            setMessages(prev => {
              const without = prev.filter(m => m.id !== thinkId)
              const exists  = without.find(m => m.id === asstId)
              if (exists) return without.map(m => m.id === asstId ? { ...m, text: fullText, streaming: true } : m)
              return [...without, { id: asstId, role: 'assistant' as const, type: 'text' as const, text: fullText, streaming: true }]
            })
          }
        }
      }
      setMessages(prev =>
        prev.filter(m => m.id !== thinkId).map(m =>
          m.id === asstId ? { ...m, streaming: false } : m
        )
      )
    } catch {
      setMessages(prev => prev.filter(m => m.id !== thinkId))
      addMsg({ role: 'assistant', type: 'text', text: 'Something went wrong — try again.' })
    }
    setBusy(false)
  }

  // ── Confirm → Generate ─────────────────────────────────────────────────────
  const runConfirm = async () => {
    if (!pendingParsed) return
    setConfirmWorking(true)

    const merged  = { ...pendingParsed, ...pendingEdits }
    const tickerId = uid()

    setMessages(prev => prev.map(m =>
      m.type === 'confirm'
        ? { ...m, id: tickerId, type: 'ticker' as const, steps: [] }
        : m
    ))

    try {
      const res = await fetch(`${API}/chat/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsed: merged, source_type: selectedSource }),
      })
      if (!res.ok) throw new Error('generate failed')

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n'); buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim(); if (!payload) continue
          let evt: Record<string, unknown>
          try { evt = JSON.parse(payload) } catch { continue }
          if (evt.type === 'done') break

          if (evt.type === 'step') {
            const { id, status, label } = evt as { id: string; status: string; label?: string }
            const newStep = { id, label: label ?? id, status: status as 'running' | 'done', icon: '◦' }
            setMessages(prev => prev.map(m => {
              if (m.id !== tickerId) return m
              const steps = m.steps || []
              const exists = steps.find((s: any) => s.id === id)
              return { ...m, steps: exists ? steps.map((s: any) => s.id === id ? { ...s, status } : s) : [...steps, newStep] }
            }))
            continue
          }

          if (evt.type === 'citation') {
            setMessages(prev => prev.map(m =>
              m.id === tickerId ? { ...m, type: 'citation' as const, citation: evt.data as CitationResult } : m
            ))
            break
          }
        }
      }
    } catch {
      addMsg({ role: 'assistant', type: 'text', text: 'Generation failed — try again.' })
    }

    setPendingParsed(null)
    setPendingEdits({})
    setConfirmWorking(false)
  }

  // ── Send ───────────────────────────────────────────────────────────────────
  const send = useCallback(async (text?: string) => {
    const userText = (text || input).trim()
    if (!userText || busy) return
    setInput(''); setBusy(true)

    const content = fileText ? `${userText}\n\n[Attached:]\n${fileText}` : userText
    addMsg({ role: 'user', type: 'text', text: userText, fileName: file?.name })
    setFile(null); setFileText('')

    await runChat(userText, content)
  }, [input, busy, messages, file, fileText, selectedIntent, selectedSource])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const noMessages = messages.length === 0
  const canSend    = input.trim().length > 0 && !busy
  const chatInner: React.CSSProperties = { width: '100%', maxWidth: 780, margin: '0 auto' }

  const inputBoxProps = {
    input, setInput, file, setFile, setFileText, busy,
    canSend, selectedIntent, selectedSource,
    setIntent: setSelectedIntent, setSource: setSelectedSource,
    inputRef, fileRef,
    onFocus: () => setInputFocused(true),
    onBlur:  () => setInputFocused(false),
    onSend:  () => send(),
    onKey:   handleKey,
    onFile:  handleFile,
  }

  const s = {
    shell:    { display: 'flex', flexDirection: 'column' as const, flex: 1, minWidth: 0, height: '100vh' },
    header:   { flexShrink: 0, padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'baseline', gap: 10 },
    messages: { flex: 1, overflowY: 'auto' as const, padding: '24px 24px 120px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center' },
    msgCol:   { width: '100%', maxWidth: 780, display: 'flex', flexDirection: 'column' as const, gap: 18 },
    msgRow:   (role: string) => ({ display: 'flex', flexDirection: 'column' as const, gap: 4, alignItems: role === 'user' ? 'flex-end' : 'flex-start', animation: 'msgIn .2s ease both' }),
    bubble:   (role: string) => ({
      maxWidth: '88%', padding: '12px 16px', borderRadius: 12,
      fontFamily: "'Lora', serif", fontSize: 14, lineHeight: 1.75, color: 'var(--text)',
      ...(role === 'user' ? {
        background: 'var(--accent-bg)', border: '1px solid var(--accent-bdr)', borderBottomRightRadius: 4,
      } : {
        background: 'var(--surface)', border: '1px solid var(--border-b)',
        borderBottomLeftRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,.2)',
      }),
    }),
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <style>{`
        @keyframes msgIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
        @keyframes blink  { 0%,100% { opacity:.2; } 50% { opacity:1; } }
        @keyframes glowSpin  { from { transform: translate(-50%,-50%) rotate(0deg); } to { transform: translate(-50%,-50%) rotate(360deg); } }
        @keyframes glowPulse { 0%,100% { opacity:.6; } 50% { opacity:1; } }
      `}</style>

      <Sidebar onNewChat={handleNewChat} />

      <div style={s.shell}>
        <div style={s.header}>
          <span style={{ fontFamily: "'Lora', serif", fontSize: 18, fontWeight: 600, fontStyle: 'italic', letterSpacing: '-.01em' }}>
            <span style={{ color: 'var(--accent)' }}>Lex</span>ter
          </span>
        </div>

        <div style={s.messages}>
          {noMessages ? (
            <div style={{ ...chatInner, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 42 }}>
              <h1 style={{ fontFamily: "'Lora', serif", fontSize: 40, fontWeight: 600, fontStyle: 'italic', color: 'var(--text)', margin: 0, marginBottom: 10, letterSpacing: '-.02em', textAlign: 'center' }}>
                What do you need to cite?
              </h1>
              <p style={{ fontSize: 19, color: 'var(--muted)', lineHeight: 1.65, textAlign: 'center', maxWidth: 500, margin: '0 0 36px', fontFamily: "'Lora', serif" }}>
                Every source type. Every rule. Bluebook 22nd ed.
              </p>
              <div style={{ width: '100%', padding: '0 24px', boxSizing: 'border-box' }}>
                <div style={{ position: 'relative', borderRadius: 22, boxShadow: inputFocused ? '0 0 0 1.5px var(--accent), 0 0 18px 4px color-mix(in srgb, var(--accent) 45%, transparent)' : '0 0 0 0px transparent', transition: 'box-shadow .35s ease' }}>
                  <div style={{ position: 'absolute', inset: -1.5, borderRadius: 22, overflow: 'hidden', zIndex: 0, opacity: inputFocused ? 0 : 1, transition: 'opacity .3s ease', animation: 'glowPulse 3s ease-in-out infinite', pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', width: '200%', height: '200%', background: `conic-gradient(from 0deg, transparent 0deg, var(--accent) 20deg, transparent 110deg, transparent 180deg, var(--accent) 235deg, transparent 290deg, transparent 360deg)`, animation: 'glowSpin 3.6s linear infinite' }} />
                  </div>
                  <div style={{ position: 'relative', zIndex: 1, padding: '14px 14px 12px', background: 'var(--surface)', borderRadius: 22, border: '1px solid var(--border-b)' }}>
                    <InputBox {...inputBoxProps} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ ...s.msgCol, flex: 1 }}>
              {messages.map(msg => (
                <div key={msg.id} style={s.msgRow(msg.role)}>
                  <div style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--dimmer)', padding: '0 4px' }}>
                    {msg.role === 'user' ? 'YOU' : 'ASSISTANT'}
                  </div>
                  {msg.type === 'thinking' ? (
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-b)', borderRadius: 12, borderBottomLeftRadius: 4, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div>
                        {[0,1,2].map(i => (
                          <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', marginRight: 3, animation: `blink 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                        ))}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--faint)', fontFamily: "'DM Mono', monospace" }}>thinking…</span>
                    </div>
                  ) : msg.type === 'ticker' ? (
                    <StepTicker steps={msg.steps || []} done={false} />
                  ) : msg.type === 'confirm' ? (
                    <ConfirmBubble
                      parsed={msg.parsed!}
                      onConfirm={runConfirm}
                      onEdit={(field, value) => setPendingEdits(prev => ({ ...prev, [field]: value }))}
                      working={confirmWorking}
                    />
                  ) : msg.type === 'citation' ? (
                    <CitationCards
                      result={msg.citation!}
                      onEdit={() => {}}
                      sourceUrl={null}
                    />
                  ) : (
                    <div style={s.bubble(msg.role)}>
                      {msg.fileName && <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 6 }}>{msg.fileName}</div>}
                      {msg.text}
                      {msg.streaming && <span className="cursor" />}
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {!noMessages && (
          <div style={{ padding: '12px 24px 24px', background: 'var(--bg)' }}>
            <div style={chatInner}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border-b)', borderRadius: 20, padding: '14px 14px 12px' }}>
                <InputBox {...inputBoxProps} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
