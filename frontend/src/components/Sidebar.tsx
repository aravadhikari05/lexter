import { useState } from 'react'
import { Plus, ChevronRight, MessageSquare } from 'lucide-react'

interface Chat { id: string; title: string; group: string }
interface SidebarProps { onNewChat?: () => void }

const PAST_CHATS: Chat[] = [
  { id: '1', title: 'Brown v. Board of Education', group: 'Today' },
  { id: '2', title: 'Roe v. Wade — full cite',     group: 'Today' },
  { id: '3', title: 'Bluebook short form rules',   group: 'Today' },
  { id: '4', title: 'Marbury v. Madison pincite',  group: 'Yesterday' },
  { id: '5', title: 'Law Review formatting help',  group: 'Yesterday' },
  { id: '6', title: 'Miranda v. Arizona 384 U.S.', group: 'This Week' },
  { id: '7', title: 'Secondary sources — treatise',group: 'This Week' },
  { id: '8', title: 'Obergefell v. Hodges',        group: 'This Week' },
]
const GROUPS = ['Today', 'Yesterday', 'This Week']

const PersonIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
)

export default function Sidebar({ onNewChat }: SidebarProps) {
  const [expanded,   setExpanded]   = useState(false)
  const [activeChat, setActiveChat] = useState<string | null>(null)
  const [hoveredId,  setHoveredId]  = useState<string | null>(null)

  const TRANS = 'width .26s cubic-bezier(.4,0,.2,1)'
  const TEXT_TRANS = 'opacity .18s ease, max-width .26s cubic-bezier(.4,0,.2,1)'

  // Shared icon button
  const iconBtnStyle: React.CSSProperties = {
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
      transition: TRANS,
      overflow: 'hidden',
      position: 'relative', zIndex: 10,
    }}>

      {/* ── Top row: toggle + wordmark ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '14px 9px 10px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0, minHeight: 52,
      }}>
        <button
          onClick={() => setExpanded(v => !v)}
          title={expanded ? 'Collapse' : 'Expand'}
          style={iconBtnStyle}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        >
          <ChevronRight size={17} style={{
            transition: 'transform .26s cubic-bezier(.4,0,.2,1)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }} />
        </button>

        {/* Wordmark fades in */}
        <span style={{
          fontFamily: "'Lora', serif",
          fontSize: 14, fontWeight: 600, fontStyle: 'italic',
          color: 'var(--text)', letterSpacing: '-.01em',
          whiteSpace: 'nowrap', marginLeft: 6,
          opacity: expanded ? 1 : 0,
          transition: TEXT_TRANS,
          pointerEvents: 'none',
        }}>
          §&nbsp;<span style={{ color: 'var(--accent)' }}>Cite</span>
        </span>
      </div>

      {/* ── New chat — icon stays, text fades in to the right ── */}
      <div style={{ padding: '10px 9px 6px', flexShrink: 0 }}>
        <button
          onClick={onNewChat}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            padding: '0', borderRadius: 9,
            background: 'transparent', border: 'none',
            cursor: 'pointer',
            transition: 'background .15s',
          }}
        >
          {/* The icon box — always same size, same position */}
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'var(--surface)', border: '1px solid var(--border-b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            transition: 'background .15s, border-color .15s',
          }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLDivElement
              el.style.background = 'var(--surface2)'
              el.style.borderColor = 'var(--accent-bdr)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLDivElement
              el.style.background = 'var(--surface)'
              el.style.borderColor = 'var(--border-b)'
            }}
          >
            <Plus size={15} color="var(--accent)" strokeWidth={2.2} />
          </div>

          {/* Text slides in from the right */}
          <span style={{
            fontFamily: "'Lora', serif", fontSize: 13,
            color: 'var(--text)', whiteSpace: 'nowrap',
            marginLeft: expanded ? 9 : 0,
            maxWidth: expanded ? 160 : 0,
            opacity: expanded ? 1 : 0,
            overflow: 'hidden',
            transition: TEXT_TRANS,
            pointerEvents: 'none',
          }}>
            New chat
          </span>
        </button>
      </div>

      {/* ── Chat list — only visible when expanded ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '4px 6px 8px',
        scrollbarWidth: 'none',
        opacity: expanded ? 1 : 0,
        transition: 'opacity .18s ease',
        pointerEvents: expanded ? 'auto' : 'none',
      }}>
        {GROUPS.map(group => {
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
        display: 'flex', alignItems: 'center',
      }}>
        {/* Avatar — always same position */}
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, color: 'var(--faint)', cursor: 'pointer',
          transition: 'background .15s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--surface2)', border: '1px solid var(--border-b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <PersonIcon size={15} />
          </div>
        </div>

        {/* Name/plan fades in */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 1,
          marginLeft: expanded ? 8 : 0,
          maxWidth: expanded ? 160 : 0,
          opacity: expanded ? 1 : 0,
          overflow: 'hidden',
          transition: TEXT_TRANS,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontFamily: "'Lora', serif", fontSize: 12.5, color: 'var(--text)', fontWeight: 500 }}>
            My Account
          </span>
          <span style={{ fontSize: 9.5, color: 'var(--dimmer)', letterSpacing: '.03em' }}>
            Free plan
          </span>
        </div>
      </div>
    </div>
  )
}