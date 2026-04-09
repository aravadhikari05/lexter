// src/App.tsx
import { useState, useEffect, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { ChatMessage, ParseResponse, CitationResult } from './types'
import type { IntentId, SourceId } from './components/SourceSelector'
import Sidebar from './components/Sidebar'
import InputBox from './components/InputBox'
import ConfirmBubble from './components/ConfirmBubble'
import CitationCards from './components/CitationCards'
import StepTicker from './components/StepTicker'
import LandingPage from './pages/LandingPage'
import { supabase } from './lib/supabase'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const uid = () => Math.random().toString(36).slice(2)

export interface ConversationMeta {
  id: string
  title: string
  updated_at: string
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useWindowWidth() {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  )
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return width
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  const [messages,     setMessages]     = useState<ChatMessage[]>([])
  const [input,        setInput]        = useState('')
  const [file,         setFile]         = useState<File | null>(null)
  const [fileText,     setFileText]     = useState('')
  const [busy,         setBusy]         = useState(false)
  const [inputFocused, setInputFocused] = useState(false)

  const [selectedIntent, setSelectedIntent] = useState<IntentId>('create')
  const [selectedSource, setSelectedSource] = useState<SourceId>('case')

  const [pendingParsed,  setPendingParsed]  = useState<ParseResponse | null>(null)
  const [pendingEdits,   setPendingEdits]   = useState<Record<string, string>>({})
  const [confirmWorking, setConfirmWorking] = useState(false)

  const [currentConvId, setCurrentConvId] = useState<string | null>(null)
  const [conversations,  setConversations] = useState<ConversationMeta[]>([])

  // Mobile sidebar drawer state
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const windowWidth = useWindowWidth()
  const isMobile    = windowWidth < 768

  const sessionRef        = useRef<Session | null>(null)
  const currentConvIdRef  = useRef<string | null>(null)
  const selectedIntentRef = useRef<IntentId>('create')
  const selectedSourceRef = useRef<SourceId>('case')
  const messagesRef       = useRef<ChatMessage[]>([])

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)

  useEffect(() => { sessionRef.current = session ?? null },         [session])
  useEffect(() => { selectedIntentRef.current = selectedIntent },   [selectedIntent])
  useEffect(() => { selectedSourceRef.current = selectedSource },   [selectedSource])
  useEffect(() => { messagesRef.current = messages },               [messages])

  // Close sidebar on resize to desktop
  useEffect(() => { if (!isMobile) setSidebarOpen(false) }, [isMobile])

  // ── Auth ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setConversations([]); return }
    loadConversations()
  }, [session])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Conversation persistence ───────────────────────────────────────────────

  const loadConversations = async () => {
    try {
      const { data } = await supabase
        .from('conversations')
        .select('id, title, updated_at')
        .order('updated_at', { ascending: false })
      if (data) setConversations(data as ConversationMeta[])
    } catch { /* silently ignore */ }
  }

  const ensureConversation = async (title: string): Promise<string | null> => {
    if (currentConvIdRef.current) return currentConvIdRef.current
    const sess = sessionRef.current
    if (!sess) return null
    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({ user_id: sess.user.id, title: title.slice(0, 60) })
        .select('id')
        .single()
      if (error || !data) return null
      const id = (data as { id: string }).id
      currentConvIdRef.current = id
      setCurrentConvId(id)
      return id
    } catch {
      return null
    }
  }

  const touchConversation = async (convId: string) => {
    try {
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', convId)
      loadConversations()
    } catch { /* silently ignore */ }
  }

  const saveMessage = async (
    convId: string,
    role: string,
    type: string,
    text?: string,
    metadata?: Record<string, unknown>,
  ) => {
    try {
      await supabase.from('messages').insert({
        conversation_id: convId,
        role,
        type,
        text: text ?? null,
        metadata: metadata ?? null,
      })
    } catch { /* silently ignore */ }
  }

  // ── Feedback persistence ───────────────────────────────────────────────────

  const saveFeedback = async (
    rating: 'approved' | 'rejected',
    citation: CitationResult,
    prompt: string,
    feedbackText?: string,
  ) => {
    try {
      await supabase.from('cached_citations').insert({
        rating,
        citation,
        prompt: prompt.slice(0, 2000),
        feedback_text: feedbackText?.trim() || null,
        user_id: sessionRef.current?.user.id ?? null,
      })
    } catch { /* silently ignore */ }
  }

  const handleSelectChat = async (convId: string) => {
    if (convId === currentConvIdRef.current) return
    currentConvIdRef.current = convId
    setCurrentConvId(convId)
    setBusy(false)
    setPendingParsed(null)
    setPendingEdits({})
    setInput('')
    setFile(null)
    setFileText('')
    // Close mobile sidebar after selecting a chat
    if (isMobile) setSidebarOpen(false)
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })
      if (data) {
        setMessages((data as any[]).map(m => ({
          id:       uid(),
          role:     m.role as 'user' | 'assistant',
          type:     m.type as ChatMessage['type'],
          text:     m.text ?? undefined,
          citation: m.metadata?.citation ?? undefined,
          prompt:   m.metadata?.prompt ?? undefined,
        })))
      }
    } catch { /* silently ignore */ }
  }

  // ── Rename / Delete ────────────────────────────────────────────────────────

  const renameConversation = async (convId: string, newTitle: string) => {
    try {
      await supabase
        .from('conversations')
        .update({ title: newTitle.slice(0, 60) })
        .eq('id', convId)
      setConversations(prev =>
        prev.map(c => c.id === convId ? { ...c, title: newTitle.slice(0, 60) } : c)
      )
    } catch { /* silently ignore */ }
  }

  const deleteConversation = async (convId: string) => {
    try {
      await supabase.from('conversations').delete().eq('id', convId)
      setConversations(prev => prev.filter(c => c.id !== convId))
      if (currentConvIdRef.current === convId) handleNewChat()
    } catch { /* silently ignore */ }
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  const addMsg = (msg: Omit<ChatMessage, 'id'>) =>
    setMessages(prev => [...prev, { id: uid(), ...msg }])

  const handleNewChat = () => {
    setMessages([]); setInput(''); setFile(null); setFileText('')
    setBusy(false); setPendingParsed(null); setPendingEdits({})
    currentConvIdRef.current = null
    setCurrentConvId(null)
    if (isMobile) setSidebarOpen(false)
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setFileText((await f.text()).slice(0, 4000))
  }

  const handleSignOut = () => supabase.auth.signOut()

  // ── Chat stream ────────────────────────────────────────────────────────────

  const runChat = async (userText: string, content: string, convId: string | null) => {
    const thinkId = uid()
    addMsg({ id: thinkId, role: 'assistant', type: 'thinking' } as ChatMessage)

    const history = messagesRef.current.slice(-10).map(m => ({ role: m.role, content: m.text || '' }))
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
          intent:      selectedIntentRef.current,
          source_type: selectedSourceRef.current,
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

          if (evt.type === 'error') {
            setMessages(prev => prev.filter(m => m.id !== thinkId).filter(m => m.id !== asstId))
            addMsg({ role: 'assistant', type: 'text', text: `Something went wrong: ${evt.message || 'unknown error'}` })
            setBusy(false)
            return
          }

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
            const citData = evt.data as CitationResult
            setMessages(prev => prev.map(m =>
              m.id === asstId
                ? { ...m, type: 'citation' as const, citation: citData, prompt: userText }
                : m
            ))
            if (convId) {
              await saveMessage(convId, 'assistant', 'citation', undefined, { citation: citData, prompt: userText })
              await touchConversation(convId)
            }
            setBusy(false)
            return
          }

          if (evt.type === 'token' && typeof evt.token === 'string') {
            fullText += evt.token
            setMessages(prev => {
              const without = prev.filter(m => m.id !== thinkId)
              const exists  = without.find(m => m.id === asstId)
              if (exists) return without.map(m => m.id === asstId ? { ...m, type: 'text' as const, text: fullText, streaming: true } : m)
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

      if (fullText && convId) {
        await saveMessage(convId, 'assistant', 'text', fullText)
        await touchConversation(convId)
      }
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

    const merged   = { ...pendingParsed, ...pendingEdits }
    const tickerId = uid()

    // Grab the last user prompt for feedback attribution
    const lastUserPrompt = messagesRef.current
      .filter(m => m.role === 'user' && m.type === 'text')
      .slice(-1)[0]?.text ?? ''

    setMessages(prev => prev.map(m =>
      m.type === 'confirm'
        ? { ...m, id: tickerId, type: 'ticker' as const, steps: [] }
        : m
    ))

    try {
      const res = await fetch(`${API}/chat/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsed: merged, source_type: selectedSourceRef.current }),
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

          if (evt.type === 'error') {
            setMessages(prev => prev.filter(m => m.id !== tickerId))
            addMsg({ role: 'assistant', type: 'text', text: `Generation failed: ${evt.message || 'unknown error'}` })
            setPendingParsed(null); setPendingEdits({})
            setConfirmWorking(false)
            return
          }

          if (evt.type === 'step') {
            const { id, status, label } = evt as { id: string; status: string; label?: string }
            const newStep = { id, label: label ?? id, status: status as 'running' | 'done', icon: '◦' }
            setMessages(prev => prev.map(m => {
              if (m.id !== tickerId) return m
              const steps  = m.steps || []
              const exists = steps.find((s: any) => s.id === id)
              return { ...m, steps: exists ? steps.map((s: any) => s.id === id ? { ...s, status } : s) : [...steps, newStep] }
            }))
            continue
          }

          if (evt.type === 'citation') {
            const citData = evt.data as CitationResult
            setMessages(prev => prev.map(m =>
              m.id === tickerId
                ? { ...m, type: 'citation' as const, citation: citData, prompt: lastUserPrompt }
                : m
            ))
            const convId = currentConvIdRef.current
            if (convId) {
              await saveMessage(convId, 'assistant', 'citation', undefined, { citation: citData, prompt: lastUserPrompt })
              await touchConversation(convId)
            }
            break
          }
        }
      }
    } catch {
      addMsg({ role: 'assistant', type: 'text', text: 'Generation failed — try again.' })
    }

    setPendingParsed(null); setPendingEdits({})
    setConfirmWorking(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const send = async (text?: string) => {
    const userText = (text || input).trim()
    if (!userText || busy) return
    setInput(''); setBusy(true)

    const content = fileText ? `${userText}\n\n[Attached:]\n${fileText}` : userText
    addMsg({ role: 'user', type: 'text', text: userText, fileName: file?.name })
    setFile(null); setFileText('')

    const convId = await ensureConversation(userText)
    if (convId) {
      await saveMessage(convId, 'user', 'text', userText)
      await touchConversation(convId)
    }

    await runChat(userText, content, convId)
  }

  // ── Early returns ──────────────────────────────────────────────────────────

  if (session === undefined) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, letterSpacing: '.12em', color: 'var(--dimmer)' }}>
          LOADING…
        </span>
      </div>
    )
  }

  if (!session) return <LandingPage />

  // ── Render ─────────────────────────────────────────────────────────────────

  const noMessages = messages.length === 0
  const canSend    = input.trim().length > 0 && !busy

  const chatPadX = isMobile ? '12px' : '24px'

  const chatInner: React.CSSProperties = {
    width: '100%',
    maxWidth: 780,
    margin: '0 auto',
  }

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
    shell: {
      display: 'flex', flexDirection: 'column' as const,
      flex: 1, minWidth: 0, height: '100vh',
      overflow: 'hidden',
    },
    header: {
      flexShrink: 0,
      padding: isMobile ? '14px 16px 12px' : '18px 20px 14px',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    },
    messages: {
      flex: 1, overflowY: 'auto' as const,
      padding: isMobile ? `20px ${chatPadX} 110px` : `24px ${chatPadX} 120px`,
      display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    },
    msgCol: {
      width: '100%', maxWidth: 780,
      display: 'flex', flexDirection: 'column' as const, gap: 18,
    },
    msgRow: (role: string) => ({
      display: 'flex', flexDirection: 'column' as const, gap: 4,
      alignItems: role === 'user' ? 'flex-end' : 'flex-start',
      animation: 'msgIn .2s ease both',
    }),
    bubble: (role: string): React.CSSProperties => ({
      maxWidth: isMobile ? '92%' : '88%',
      padding: isMobile ? '10px 13px' : '12px 16px',
      borderRadius: 12,
      fontFamily: "'Inter', sans-serif",
      fontSize: isMobile ? 13 : 14,
      lineHeight: 1.75, color: 'var(--text)',
      ...(role === 'user' ? {
        background: 'var(--accent-bg)', border: '1px solid var(--accent-bdr)', borderBottomRightRadius: 4,
      } : {
        background: 'var(--surface)', border: '1px solid var(--border-b)',
        borderBottomLeftRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,.2)',
      }),
    }),
  }

  const HamburgerIcon = () => (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="5"  width="16" height="1.5" rx=".75" fill="currentColor" />
      <rect x="2" y="9.25"  width="16" height="1.5" rx=".75" fill="currentColor" />
      <rect x="2" y="13.5" width="16" height="1.5" rx=".75" fill="currentColor" />
    </svg>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <style>{`
        @keyframes msgIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
        @keyframes blink  { 0%,100% { opacity:.2; } 50% { opacity:1; } }
        @keyframes glowSpin  { from { transform: translate(-50%,-50%) rotate(0deg); } to { transform: translate(-50%,-50%) rotate(360deg); } }
        @keyframes glowPulse { 0%,100% { opacity:.6; } 50% { opacity:1; } }
      `}</style>

      <Sidebar
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onRename={renameConversation}
        onDelete={deleteConversation}
        conversations={conversations}
        activeConvId={currentConvId}
        isMobile={isMobile}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 49,
            background: 'rgba(0,0,0,.55)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
          }}
        />
      )}

      <div style={s.shell}>
        {/* ── Header ── */}
        <div style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
                style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: 'none', border: 'none',
                  color: 'var(--faint)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0,
                }}
              >
                <HamburgerIcon />
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: isMobile ? 16 : 18, fontWeight: 700, letterSpacing: '-.01em' }}>
                <span style={{ color: 'var(--accent)' }}>Lex</span>ter
              </span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            style={{
              fontFamily: "'Inter', sans-serif", fontSize: 9,
              letterSpacing: '.1em', color: 'var(--dimmer)',
              background: 'none', border: 'none', cursor: 'pointer',
              transition: 'color .15s', padding: '4px 8px',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--dimmer)' }}
          >
            SIGN OUT
          </button>
        </div>

        {/* ── Messages ── */}
        <div style={s.messages}>
          {noMessages ? (
            <div style={{
              ...chatInner, flex: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              paddingBottom: isMobile ? 24 : 42,
            }}>
              <h1 style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: isMobile ? 26 : 40,
                fontWeight: 700, color: 'var(--text)',
                margin: 0, marginBottom: isMobile ? 20 : 30,
                letterSpacing: '-.02em', textAlign: 'center',
              }}>
                What do you need to cite?
              </h1>
              <div style={{ width: '100%', boxSizing: 'border-box' }}>
                <div style={{
                  position: 'relative', borderRadius: 22,
                  boxShadow: inputFocused
                    ? '0 0 0 1.5px var(--accent), 0 0 18px 4px color-mix(in srgb, var(--accent) 45%, transparent)'
                    : '0 0 0 0px transparent',
                  transition: 'box-shadow .35s ease',
                }}>
                  {!isMobile && (
                    <div style={{
                      position: 'absolute', inset: -1.5, borderRadius: 22,
                      overflow: 'hidden', zIndex: 0,
                      opacity: inputFocused ? 0 : 1,
                      transition: 'opacity .3s ease',
                      animation: 'glowPulse 3s ease-in-out infinite',
                      pointerEvents: 'none',
                    }}>
                      <div style={{
                        position: 'absolute', top: '50%', left: '50%',
                        width: '200%', height: '200%',
                        background: `conic-gradient(from 0deg, transparent 0deg, var(--accent) 20deg, transparent 110deg, transparent 180deg, var(--accent) 235deg, transparent 290deg, transparent 360deg)`,
                        animation: 'glowSpin 3.6s linear infinite',
                      }} />
                    </div>
                  )}
                  <div style={{
                    position: 'relative', zIndex: 1,
                    padding: isMobile ? '10px 10px 8px' : '14px 14px 12px',
                    background: 'var(--surface)', borderRadius: 22,
                    border: '1px solid var(--border-b)',
                  }}>
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
                      <span style={{ fontSize: 11, color: 'var(--faint)', fontFamily: "'Inter', sans-serif" }}>thinking…</span>
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
                      prompt={msg.prompt}
                      onFeedback={async (rating, feedbackText) => {
                        await saveFeedback(rating, msg.citation!, msg.prompt ?? '', feedbackText)
                      }}
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

        {/* ── Pinned input bar (active chat) ── */}
        {!noMessages && (
          <div style={{
            padding: isMobile ? '10px 12px 16px' : '12px 24px 24px',
            background: 'var(--bg)',
            paddingBottom: isMobile ? 'max(16px, env(safe-area-inset-bottom))' : '24px',
          }}>
            <div style={chatInner}>
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border-b)',
                borderRadius: 20,
                padding: isMobile ? '10px 10px 8px' : '14px 14px 12px',
              }}>
                <InputBox {...inputBoxProps} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}