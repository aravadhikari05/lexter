// src/components/Sidebar.tsx
import { useState } from 'react'
import { Plus, ChevronRight, MessageSquare } from 'lucide-react'
import type { ConversationMeta } from '../App'

interface Props {
  onNewChat:    () => void
  onSelectChat: (id: string) => void
  conversations: ConversationMeta[]
  activeConvId:  string | null
}

// ── Date grouping ─────────────────────────────────────────────────────────────

const GROUP_LABELS = ['Today', 'Yesterday', 'This Week', 'Earlier'] as const
type GroupLabel = typeof GROUP_LABELS[number]

function getGroup(updatedAt: string): GroupLabel {
  const now   = new Date()
  const date  = new Date(updatedAt)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yest  = new Date(today); yest.setDate(today.getDate() - 1)
  const week  = new Date(today); week.setDate(today.getDate() - 7)

  if (date >= today)     return 'Today'
  if (date >= yest)      return 'Yesterday'
  if (date >= week)      return 'This Week'
  return 'Earlier'
}

function groupConversations(convs: ConversationMeta[]): Record<GroupLabel, ConversationMeta[]> {
  const groups: Record<GroupLabel, ConversationMeta[]> = {
    'Today':     [],
    'Yesterday': [],
    'This Week': [],
    'Earlier':   [],
  }
  for (const c of convs) groups[getGroup(c.updated_at)].push(c)
  return groups
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const PersonIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
)

// ── Component ─────────────────────────────────────────────────────────────────

export default function Sidebar({ onNewChat, onSelectChat, conversations, activeConvId }: Props) {
  const [expanded,  setExpanded]  = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const TRANSITION = 'width .26s cubic-bezier(.4,0,.2,1)'

  const iconBtn: React.CSSProperties = {
    width: 34, height: 34, borderRadius: 8, background: 'transparent', border: 'none',
    color: 'var(--faint)', cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', transition: 'background .15s, color .15s', flexShrink: 0,
  }

  const grouped = groupConversations(conversations)

  return (
    <div style={{
      width: expanded ? 248 : 52, flexShrink: 0, height: '100vh',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg)', borderRight: '1px solid var(--border)',
      transition: TRANSITION, overflow: 'hidden',
    }}>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '14px 9px 10px', borderBottom: '1px solid var(--border)',
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
          fontFamily: "'Lora', serif", fontSize: 14, fontWeight: 600,
          fontStyle: 'italic', color: 'var(--text)', letterSpacing: '-.01em',
          whiteSpace: 'nowrap',
          opacity: expanded ? 1 : 0, transition: 'opacity .2s ease', pointerEvents: 'none',
        }}>
          {/* logo placeholder */}
        </span>
      </div>

      {/* ── New chat button ── */}
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
            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'var(--surface2)'; b.style.borderColor = 'var(--accent-bdr)' }}
            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'var(--surface)';  b.style.borderColor = 'var(--border-b)' }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: 6, background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
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

      {/* ── Conversation list ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '4px 6px 8px',
        scrollbarWidth: 'none',
        opacity: expanded ? 1 : 0,
        transition: 'opacity .18s ease',
        pointerEvents: expanded ? 'auto' : 'none',
      }}>
        {conversations.length === 0 ? (
          <div style={{
            padding: '24px 10px', textAlign: 'center',
            fontFamily: "'DM Mono', monospace", fontSize: 9,
            letterSpacing: '.08em', color: 'var(--dimmer)',
            lineHeight: 1.8,
          }}>
            No conversations yet.{'\n'}Start by asking a citation.
          </div>
        ) : (
          GROUP_LABELS.map(group => {
            const chats = grouped[group]
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
                  const isActive  = activeConvId === chat.id
                  const isHovered = hoveredId === chat.id
                  return (
                    <button
                      key={chat.id}
                      onClick={() => onSelectChat(chat.id)}
                      onMouseEnter={() => setHoveredId(chat.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 10px', borderRadius: 7,
                        border:      isActive ? '1px solid var(--accent-bdr)' : '1px solid transparent',
                        background:  isActive ? 'var(--accent-bg)' : isHovered ? 'var(--surface)' : 'transparent',
                        cursor: 'pointer', textAlign: 'left',
                        transition: 'background .12s',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <MessageSquare size={13} style={{
                        color: isActive ? 'var(--accent)' : 'var(--dimmer)',
                        flexShrink: 0, marginTop: 1,
                      }} />
                      <span style={{
                        fontFamily: "'Lora', serif", fontSize: 12.5,
                        color: isActive ? 'var(--text)' : 'var(--muted)',
                        overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
                      }}>
                        {chat.title}
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })
        )}
      </div>

      {/* ── Footer / profile ── */}
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