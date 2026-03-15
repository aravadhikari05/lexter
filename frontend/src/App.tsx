import { useState, useCallback, useEffect, useRef } from 'react'
import { Paperclip, ArrowUp, Plus, ChevronRight, MessageSquare } from 'lucide-react'
import type { ChatMessage, CitPhase, ParsedCase, CaseFields, CitationResult, TickerStep } from './types'
import { applyPincite } from './lib/pincite'
import { PARSE_STEPS, GENERATE_STEPS } from './lib/constants'
import StepTicker from './components/StepTicker'
import GapBubble  from './components/GapBubble'
import CitationCards from './components/CitationCards'

// ─── Config ───────────────────────────────────────────────────────────────────
const API = 'http://localhost:8000'
// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2)
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

function makeSteps(templates: typeof PARSE_STEPS): TickerStep[] {
  return templates.map(s => ({ ...s, status: 'pending' as const }))
}

// ─── API calls (direct FastAPI) ───────────────────────────────────────────────

async function apiParseCase(rawInput: string): Promise<ParsedCase> {
  const res = await fetch(`${API}/citation/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_input: rawInput }),
  })
  if (!res.ok) throw new Error(`parse failed: ${res.status}`)
  return res.json()
}

async function apiGenerateCitation(
  parsed: ParsedCase,
  fields: Record<string, string>,
  pincite: string,
): Promise<CitationResult> {
  const res = await fetch(`${API}/citation/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parsed, fields, pincite }),
  })
  if (!res.ok) throw new Error(`generate failed: ${res.status}`)
  return res.json()
}

async function apiStreamChat(
  message: string,
  history: { role: string; content: string }[],
  onChunk: (token: string) => void,
): Promise<{ isCite: boolean; citeInput?: string }> {
  const res = await fetch(`${API}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  })
  if (!res.ok) throw new Error(`chat failed: ${res.status}`)

  const reader  = res.body!.getReader()
  const decoder = new TextDecoder()
  let   buffer  = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6).trim()
      if (!payload) continue
      let msg: Record<string, unknown>
      try { msg = JSON.parse(payload) } catch { continue }

      if (msg.done) {
        return { isCite: Boolean(msg.isCite), citeInput: msg.citeInput as string | undefined }
      }
      if (typeof msg.token === 'string') onChunk(msg.token)
    }
  }
  return { isCite: false }
}

// ─── Fake past chats ──────────────────────────────────────────────────────────
interface FakeChat { id: string; title: string; group: string }

const PAST_CHATS: FakeChat[] = [
  { id: '1', title: 'Brown v. Board of Education',  group: 'Today' },
  { id: '2', title: 'Roe v. Wade — full cite',      group: 'Today' },
  { id: '3', title: 'Bluebook short form rules',    group: 'Today' },
  { id: '4', title: 'Marbury v. Madison pincite',   group: 'Yesterday' },
  { id: '5', title: 'Law Review formatting help',   group: 'Yesterday' },
  { id: '6', title: 'Miranda v. Arizona 384 U.S.',  group: 'This Week' },
  { id: '7', title: 'Secondary sources — treatise', group: 'This Week' },
  { id: '8', title: 'Obergefell v. Hodges',         group: 'This Week' },
]
const CHAT_GROUPS = ['Today', 'Yesterday', 'This Week']

// ─── Person icon ──────────────────────────────────────────────────────────────
const PersonIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
)

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ onNewChat }: { onNewChat: () => void }) {
  const [expanded,   setExpanded]   = useState(false)
  const [activeChat, setActiveChat] = useState<string | null>(null)
  const [hoveredId,  setHoveredId]  = useState<string | null>(null)

  const TRANSITION = 'width .26s cubic-bezier(.4,0,.2,1)'

  const iconBtn: React.CSSProperties = {
    width: 34, height: 34, borderRadius: 8,
    background: 'transparent', border: 'none',
    color: 'var(--faint)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background .15s, color .15s',
    flexShrink: 0,
  }

  return (
    <div style={{
      width: expanded ? 248 : 52,
      flexShrink: 0, height: '100vh',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg)',
      borderRight: '1px solid var(--border)',
      transition: TRANSITION,
      overflow: 'hidden',
    }}>
      {/* ── Top row ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '14px 9px 10px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0, gap: 6, minHeight: 52,
      }}>
        <button
          onClick={() => setExpanded(v => !v)}
          title={expanded ? 'Collapse' : 'Expand'}
          style={iconBtn}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        >
          <ChevronRight size={17} style={{
            transition: 'transform .26s cubic-bezier(.4,0,.2,1)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }} />
        </button>
        <span style={{
          fontFamily: "'Lora', serif",
          fontSize: 14, fontWeight: 600, fontStyle: 'italic',
          color: 'var(--text)', letterSpacing: '-.01em',
          whiteSpace: 'nowrap',
          opacity: expanded ? 1 : 0,
          transition: 'opacity .2s ease',
          pointerEvents: 'none',
        }}>
          <span style={{ color: 'var(--accent)' }}>Lex</span>ter
        </span>
      </div>

      {/* ── New chat ── */}
      <div style={{ padding: '10px 9px 6px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        {expanded ? (
          <button
            onClick={onNewChat}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 9,
              padding: '9px 12px', borderRadius: 9,
              background: 'var(--surface)', border: '1px solid var(--border-b)',
              color: 'var(--text)', cursor: 'pointer',
              fontFamily: "'Lora', serif", fontSize: 13,
              transition: 'background .15s, border-color .15s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.background = 'var(--surface2)'; b.style.borderColor = 'var(--accent-bdr)'
            }}
            onMouseLeave={e => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.background = 'var(--surface)'; b.style.borderColor = 'var(--border-b)'
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: 6,
              background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Plus size={13} color="#111009" strokeWidth={2.5} />
            </div>
            New chat
          </button>
        ) : (
          <button
            onClick={onNewChat}
            title="New chat"
            style={{
              width: 34, height: 34, borderRadius: 8,
              background: 'var(--surface)', border: '1px solid var(--border-b)',
              color: 'var(--accent)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background .15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)' }}
          >
            <Plus size={15} strokeWidth={2.2} />
          </button>
        )}
      </div>

      {/* ── Chat list ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '4px 6px 8px',
        scrollbarWidth: 'none',
        opacity: expanded ? 1 : 0, transition: 'opacity .18s ease',
        pointerEvents: expanded ? 'auto' : 'none',
      }}>
        {CHAT_GROUPS.map(group => {
          const chats = PAST_CHATS.filter(c => c.group === group)
          if (!chats.length) return null
          return (
            <div key={group} style={{ marginBottom: 4 }}>
              <div style={{
                fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase',
                color: 'var(--dimmer)', padding: '8px 8px 4px', whiteSpace: 'nowrap',
              }}>
                {group}
              </div>
              {chats.map(chat => {
                const isActive  = activeChat === chat.id
                const isHovered = hoveredId  === chat.id
                return (
                  <button
                    key={chat.id}
                    onClick={() => setActiveChat(chat.id)}
                    onMouseEnter={() => setHoveredId(chat.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px', borderRadius: 7,
                      border: isActive ? '1px solid var(--accent-bdr)' : '1px solid transparent',
                      background: isActive ? 'var(--accent-bg)' : isHovered ? 'var(--surface)' : 'transparent',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'background .12s', whiteSpace: 'nowrap',
                    }}
                  >
                    <MessageSquare size={13} style={{
                      color: isActive ? 'var(--accent)' : 'var(--dimmer)',
                      flexShrink: 0, marginTop: 1, transition: 'color .12s',
                    }} />
                    <span style={{
                      fontFamily: "'Lora', serif", fontSize: 12.5,
                      color: isActive ? 'var(--text)' : 'var(--muted)',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      flex: 1, transition: 'color .12s',
                    }}>
                      {chat.title}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* ── Profile ── */}
      <div style={{
        flexShrink: 0, padding: '10px 9px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: expanded ? 'flex-start' : 'center',
      }}>
        {expanded ? (
          <button
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 9,
              background: 'transparent', border: 'none', cursor: 'pointer',
              transition: 'background .15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'var(--surface2)', border: '1px solid var(--border-b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, color: 'var(--faint)',
            }}>
              <PersonIcon size={16} />
            </div>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1,
              opacity: expanded ? 1 : 0, transition: 'opacity .15s ease',
            }}>
              <span style={{ fontFamily: "'Lora', serif", fontSize: 12.5, color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                My Account
              </span>
              <span style={{ fontSize: 9.5, color: 'var(--dimmer)', letterSpacing: '.03em', whiteSpace: 'nowrap' }}>
                Free plan
              </span>
            </div>
          </button>
        ) : (
          <button
            title="Profile"
            style={{
              width: 34, height: 34, borderRadius: 8,
              background: 'transparent', border: 'none',
              color: 'var(--faint)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background .15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            <PersonIcon size={17} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [messages,      setMessages]      = useState<ChatMessage[]>([])
  const [input,         setInput]         = useState('')
  const [file,          setFile]          = useState<File | null>(null)
  const [fileText,      setFileText]      = useState('')
  const [busy,          setBusy]          = useState(false)
  const [inputFocused,  setInputFocused]  = useState(false)

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, citPhase, citSteps, citResult])

  const addMsg = (msg: Omit<ChatMessage, 'id'>) =>
    setMessages(prev => [...prev, { id: uid(), ...msg }])

  const tickStep = (id: string, status: TickerStep['status']) =>
    setCitSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s))

  const resetCit = () => {
    setCitPhase('idle'); setCitSteps([]); setCitParsed(null)
    setCitFields({}); setCitResult(null); setCitBase(null); setGapFading(false)
  }

  const handleNewChat = () => {
    setMessages([]); setInput(''); setFile(null); setFileText('')
    setBusy(false); resetCit()
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const text = await f.text()
    setFileText(text.slice(0, 4000))
  }

  const runCitation = async (rawInput: string, extraFields: CaseFields = {}) => {
    setCitPhase('ticker'); setCitResult(null); setCitBase(null)
    const parseSteps = makeSteps(PARSE_STEPS)
    setCitSteps(parseSteps)
    const apiCall = apiParseCase(rawInput)

    const adv = async (cur: string, nxt: string, ms: number) => {
      tickStep(cur, 'running'); await delay(ms); tickStep(cur, 'done'); tickStep(nxt, 'running')
    }
    tickStep('read', 'running'); await delay(300); tickStep('read', 'done')
    await adv('name', 'reporter', 350)
    await adv('reporter', 'court', 300)
    await adv('court', 'fields', 280)

    let parsed: ParsedCase
    try { parsed = await apiCall }
    catch {
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

    if (missing.length > 0 || warn.length > 0) { setCitPhase('gaps'); setBusy(false); return }
    await doGenerate(parsed, { ...pre, ...extraFields })
  }

  const doGenerate = async (parsedOverride?: ParsedCase | null, fieldsOverride?: CaseFields | null) => {
    const p = parsedOverride || citParsed!
    const f = fieldsOverride || citFields
    const pin = f.pincite || ''

    setCitPhase('ticker')
    const genSteps = makeSteps(GENERATE_STEPS)
    setCitSteps(prev => [...prev, ...genSteps])
    const apiCall = apiGenerateCitation(p, f as Record<string, string>, pin)

    const tick = async (id: string, nxt: string, ms: number) => {
      tickStep(id, 'running'); await delay(ms); tickStep(id, 'done'); tickStep(nxt, 'running')
    }
    await tick('rule', 'paren', 320)
    await tick('paren', 'format', 290)
    await tick('format', 'shortform', 270)
    await tick('shortform', 'render', 250)

    let result: CitationResult
    try { result = await apiCall }
    catch {
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
    setBusy(true); setGapFading(true)
    setTimeout(() => { setGapFading(false); doGenerate() }, 350)
  }

  const handleEditFields = () => { setCitPhase('gaps'); setCitResult(null); setCitBase(null) }

  const send = useCallback(async (text?: string) => {
    const userText = (text || input).trim()
    if (!userText || busy) return
    setInput(''); setBusy(true); resetCit()

    const content = fileText ? `${userText}\n\n[Attached:]\n${fileText}` : userText
    addMsg({ role: 'user', type: 'text', text: userText, fileName: file?.name })
    setFile(null); setFileText('')

    const thinkId = uid()
    addMsg({ id: thinkId, role: 'assistant', type: 'thinking' } as ChatMessage)

    const history = messages.slice(-10).map(m => ({ role: m.role, content: m.text || '' }))
    history.push({ role: 'user', content })

    const asstId = uid()
    let fullText = ''

    try {
      const outcome = await apiStreamChat(userText, history, (token: string) => {
        fullText += token
        setMessages(prev => {
          const without = prev.filter(m => m.id !== thinkId)
          const exists  = without.find(m => m.id === asstId)
          if (exists) return without.map(m => m.id === asstId ? { ...m, text: fullText, streaming: true } : m)
          return [...without, { id: asstId, role: 'assistant' as const, type: 'text' as const, text: fullText, streaming: true }]
        })
      })

      if (outcome.isCite) {
        setMessages(prev => prev.filter(m => m.id !== thinkId).map(m => m.id === asstId ? { ...m, streaming: false } : m))
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

  const chatInner: React.CSSProperties = { width: '100%', maxWidth: 780, margin: '0 auto' }

  const s = {
    shell: { display: 'flex', flexDirection: 'column' as const, flex: 1, minWidth: 0, height: '100vh' },
    header: {
      flexShrink: 0, padding: '18px 20px 14px',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'baseline', gap: 10,
    },
    messages: {
      flex: 1, overflowY: 'auto' as const, padding: '24px 24px 120px',
      display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    },
    msgCol: { width: '100%', maxWidth: 780, display: 'flex', flexDirection: 'column' as const, gap: 18 },
    msgRow: (role: string) => ({
      display: 'flex', flexDirection: 'column' as const, gap: 4,
      alignItems: role === 'user' ? 'flex-end' : 'flex-start',
      animation: 'msgIn .2s ease both',
    }),
    bubble: (role: string) => ({
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

  // ─── Input box ────────────────────────────────────────────────────────────────
  const InputBox = () => (
    <>
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
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          placeholder="Cite something or ask a question…"
          disabled={busy}
          style={{
            width: '100%', background: 'none', border: 'none', outline: 'none', resize: 'none',
            fontFamily: "'Lora', serif", fontSize: 15, color: 'var(--text)',
            caretColor: 'var(--accent)', lineHeight: 1.6, scrollbarWidth: 'none',
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
    </>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Keyframe injections */}
      <style>{`
        @keyframes glowSpin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to   { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1; }
        }

      `}</style>

      <Sidebar onNewChat={handleNewChat} />

      <div style={s.shell}>
        {/* Header */}
        <div style={s.header}>
          <span style={{ fontFamily: "'Lora', serif", fontSize: 18, fontWeight: 600, fontStyle: 'italic', letterSpacing: '-.01em' }}>
            <span style={{ color: 'var(--accent)' }}>Lex</span>ter
          </span>
        </div>

        {/* Messages */}
        <div style={s.messages}>
          {noMessages ? (
            /* ── Empty / landing state ── */
            <div style={{
              ...chatInner, flex: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              paddingBottom: 42, gap: 0,
            }}>
              <h1 style={{
                fontFamily: "'Lora', serif", fontSize: 40, fontWeight: 600, fontStyle: 'italic',
                color: 'var(--text)', margin: 0, marginBottom: 10,
                letterSpacing: '-.02em', textAlign: 'center',
              }}>
                What do you need to cite?
              </h1>
   <p style={{
                fontSize: 19, color: 'var(--muted)', lineHeight: 1.65,
                textAlign: 'center', maxWidth: 500, margin: '0 0 36px',
                fontFamily: "'Lora', serif",
              }}>
                Every source type. Every rule. Bluebook 21st ed.
              </p>

              {/* ── Input with glow ── */}
              <div style={{ width: '100%', padding: '0 24px', boxSizing: 'border-box' }}>
                <div style={{
                  position: 'relative', borderRadius: 22,
                  // all-around glow on focus, spinning-sweep shadow idle
                  boxShadow: inputFocused
                    ? '0 0 0 1.5px var(--accent), 0 0 18px 4px color-mix(in srgb, var(--accent) 45%, transparent)'
                    : '0 0 0 0px transparent',
                  transition: 'box-shadow .35s ease',
                }}>

                  {/* Spinning conic ring — hidden when focused */}
                  <div style={{
                    position: 'absolute', inset: -1.5,
                    borderRadius: 22, overflow: 'hidden',
                    zIndex: 0,
                    opacity: inputFocused ? 0 : 1,
                    transition: 'opacity .3s ease',
                    animation: 'glowPulse 3s ease-in-out infinite',
                    pointerEvents: 'none',
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: '50%', left: '50%',
                      width: '200%', height: '200%',
                      background: `conic-gradient(from 0deg,
                        transparent 0deg,
                        var(--accent) 20deg,
                        transparent 110deg,
                        transparent 180deg,
                        var(--accent) 235deg,
                        transparent 290deg,
                        transparent 360deg)`,
                      animation: 'glowSpin 3.6s linear infinite',
                    }} />
                  </div>

                  {/* Actual input — sits on top */}
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    {InputBox()}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ── Active chat state ── */
            <div style={{ ...s.msgCol, flex: 1 }}>
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

              {citPhase === 'ticker' && (
                <div style={s.msgRow('assistant')}>
                  <div style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--dimmer)', padding: '0 4px' }}>ASSISTANT</div>
                  <StepTicker steps={citSteps} done={false} />
                </div>
              )}

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

              {citPhase === 'done' && citResult && (
                <div style={s.msgRow('assistant')}>
                  <div style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--dimmer)', padding: '0 4px' }}>ASSISTANT</div>
                  <CitationCards result={citResult} onEdit={handleEditFields} />
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Bottom input — only shown once a conversation has started */}
        {!noMessages && (
          <div style={{ padding: '12px 24px 24px', background: 'var(--bg)' }}>
            <div style={chatInner}>
              {InputBox()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}