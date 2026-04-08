// src/components/Sidebar.tsx
import { useState, useRef } from 'react'
import { Plus, ChevronRight, MessageSquare, Trash2, Pencil } from 'lucide-react'
import type { ConversationMeta } from '../App'

interface Props {
  onNewChat:      () => void
  onSelectChat:   (id: string) => void
  onRename:       (id: string, title: string) => void
  onDelete:       (id: string) => void
  conversations:  ConversationMeta[]
  activeConvId:   string | null
  // Mobile
  isMobile?:      boolean
  mobileOpen?:    boolean
  onMobileClose?: () => void
}

const GROUP_LABELS = ['Today', 'Yesterday', 'This Week', 'Earlier'] as const
type GroupLabel = typeof GROUP_LABELS[number]

function getGroup(updatedAt: string): GroupLabel {
  const now   = new Date()
  const date  = new Date(updatedAt)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yest  = new Date(today); yest.setDate(today.getDate() - 1)
  const week  = new Date(today); week.setDate(today.getDate() - 7)
  if (date >= today) return 'Today'
  if (date >= yest)  return 'Yesterday'
  if (date >= week)  return 'This Week'
  return 'Earlier'
}

function groupConversations(convs: ConversationMeta[]): Record<GroupLabel, ConversationMeta[]> {
  const groups: Record<GroupLabel, ConversationMeta[]> = { 'Today': [], 'Yesterday': [], 'This Week': [], 'Earlier': [] }
  for (const c of convs) groups[getGroup(c.updated_at)].push(c)
  return groups
}

const PersonIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
)

export default function Sidebar({
  onNewChat, onSelectChat, onRename, onDelete,
  conversations, activeConvId,
  isMobile = false, mobileOpen = false, onMobileClose,
}: Props) {
  const [expanded,   setExpanded]   = useState(false)
  const [hoveredId,  setHoveredId]  = useState<string | null>(null)
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [editValue,  setEditValue]  = useState('')
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const editRef = useRef<HTMLInputElement>(null)

  const TRANSITION = 'width .26s cubic-bezier(.4,0,.2,1)'

  // On mobile the sidebar is always "expanded" when open; the expand toggle is desktop-only
  const isExpanded = isMobile ? true : expanded

  const iconBtn: React.CSSProperties = {
    width: 34, height: 34, borderRadius: 8, background: 'transparent', border: 'none',
    color: 'var(--faint)', cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', transition: 'background .15s, color .15s', flexShrink: 0,
  }

  const grouped = groupConversations(conversations)

  const startEdit = (chat: ConversationMeta, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(chat.id)
    setEditValue(chat.title)
    setTimeout(() => { editRef.current?.focus(); editRef.current?.select() }, 0)
  }

  const commitEdit = (id: string) => {
    const trimmed = editValue.trim()
    if (trimmed) onRename(id, trimmed)
    setEditingId(null)
  }

  const startDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setConfirmDel(id)
  }

  const commitDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirmDel) { onDelete(confirmDel); setConfirmDel(null) }
  }

  const actionIconStyle = (visible: boolean): React.CSSProperties => ({
    width: 22, height: 22, borderRadius: 5,
    background: 'transparent', border: 'none',
    color: visible ? 'var(--dimmer)' : 'transparent',
    cursor: visible ? 'pointer' : 'default',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'color .15s, background .15s',
    pointerEvents: visible ? 'auto' : 'none',
    flexShrink: 0,
  })

  // ── Mobile: full-height drawer sliding in from left ────────────────────────
  if (isMobile) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: 272,
        zIndex: 50,
        background: 'var(--bg)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform .28s cubic-bezier(.4,0,.2,1)',
        // Safe area for notched phones
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {/* Top bar with close button */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 10px 10px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0, minHeight: 52,
        }}>
          <span style={{
            fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 700,
            letterSpacing: '-.01em', paddingLeft: 6,
          }}>
            <span style={{ color: 'var(--accent)' }}>Lex</span>ter
          </span>
          <button
            onClick={onMobileClose}
            style={{
              ...iconBtn,
              fontSize: 18, color: 'var(--muted)',
            }}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* New chat */}
        <div style={{ padding: '10px 10px 6px', flexShrink: 0 }}>
          <button
            onClick={onNewChat}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 9,
              padding: '10px 12px', borderRadius: 9,
              background: 'var(--surface)', border: '1px solid var(--border-b)',
              color: 'var(--text)', cursor: 'pointer',
              fontFamily: "'Inter', sans-serif", fontSize: 14,
              transition: 'background .15s, border-color .15s',
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: 6, background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Plus size={13} color="#111009" strokeWidth={2.5} />
            </div>
            New chat
          </button>
        </div>

        {/* Conversation list */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '4px 8px 8px',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}>
          {conversations.length === 0 ? (
            <div style={{
              padding: '24px 10px', textAlign: 'center',
              fontFamily: "'Inter', sans-serif", fontSize: 9,
              letterSpacing: '.08em', color: 'var(--dimmer)', lineHeight: 1.8,
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
                    fontFamily: "'Inter', sans-serif",
                  }}>
                    {group}
                  </div>
                  {chats.map(chat => {
                    const isActive  = activeConvId === chat.id
                    const isEditing = editingId === chat.id
                    const isConfirm = confirmDel === chat.id

                    return (
                      <div
                        key={chat.id}
                        onClick={() => !isEditing && onSelectChat(chat.id)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center',
                          padding: '8px 8px', borderRadius: 7, boxSizing: 'border-box',
                          border:     isActive ? '1px solid var(--accent-bdr)' : '1px solid transparent',
                          background: isActive ? 'var(--accent-bg)' : 'transparent',
                          cursor: isEditing ? 'default' : 'pointer',
                          gap: 8, marginBottom: 2,
                          // Larger tap targets on mobile
                          minHeight: 42,
                        }}
                      >
                        <MessageSquare size={14} style={{
                          color: isActive ? 'var(--accent)' : 'var(--dimmer)',
                          flexShrink: 0,
                        }} />

                        {isEditing ? (
                          <input
                            ref={editRef}
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => commitEdit(chat.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); commitEdit(chat.id) }
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            onClick={e => e.stopPropagation()}
                            style={{
                              flex: 1, background: 'var(--bg)', border: '1px solid var(--accent-bdr)',
                              borderRadius: 4, padding: '4px 6px',
                              fontFamily: "'Inter', sans-serif", fontSize: 14,
                              color: 'var(--text)', outline: 'none', minWidth: 0,
                            }}
                          />
                        ) : (
                          <span style={{
                            fontFamily: "'Inter', sans-serif", fontSize: 13.5,
                            color: isActive ? 'var(--text)' : 'var(--muted)',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            flex: 1, whiteSpace: 'nowrap', minWidth: 0,
                          }}>
                            {chat.title}
                          </span>
                        )}

                        {/* Always-visible action buttons on mobile (no hover) */}
                        {!isEditing && (
                          isConfirm ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                              <button
                                onClick={commitDelete}
                                style={{
                                  fontSize: 10, letterSpacing: '.04em',
                                  color: '#e05252', background: 'rgba(224,82,82,.12)',
                                  border: '1px solid rgba(224,82,82,.3)',
                                  borderRadius: 4, padding: '3px 7px',
                                  cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                                }}
                              >
                                Delete
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setConfirmDel(null) }}
                                style={{
                                  fontSize: 10, color: 'var(--dimmer)',
                                  background: 'transparent', border: '1px solid var(--border-b)',
                                  borderRadius: 4, padding: '3px 7px',
                                  cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, opacity: isActive ? 1 : 0.4 }}>
                              <button
                                onClick={e => startEdit(chat, e)}
                                style={{ ...actionIconStyle(true), width: 28, height: 28 }}
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={e => startDelete(chat.id, e)}
                                style={{ ...actionIconStyle(true), width: 28, height: 28 }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          flexShrink: 0, padding: '10px 10px 16px',
          borderTop: '1px solid var(--border)',
        }}>
          <button style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 10px', borderRadius: 9,
            background: 'transparent', border: 'none', cursor: 'pointer',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--surface2)', border: '1px solid var(--border-b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, color: 'var(--faint)',
            }}>
              <PersonIcon size={17} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                My Account
              </span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: 'var(--dimmer)' }}>
                Free plan
              </span>
            </div>
          </button>
        </div>
      </div>
    )
  }

  // ── Desktop: original collapsible inline sidebar ───────────────────────────

  return (
    <div style={{
      width: isExpanded ? 248 : 52, flexShrink: 0, height: '100vh',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg)', borderRight: '1px solid var(--border)',
      transition: TRANSITION, overflow: 'hidden',
    }}>

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '14px 9px 10px', borderBottom: '1px solid var(--border)',
        flexShrink: 0, gap: 6, minHeight: 52,
      }}>
        <button
          onClick={() => setExpanded(v => !v)}
          title={isExpanded ? 'Collapse' : 'Expand'}
          style={iconBtn}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        >
          <ChevronRight size={17} style={{
            transition: 'transform .26s cubic-bezier(.4,0,.2,1)',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }} />
        </button>
      </div>

      {/* New chat */}
      <div style={{ padding: '10px 9px 6px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        {isExpanded ? (
          <button
            onClick={onNewChat}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 9,
              padding: '9px 12px', borderRadius: 9,
              background: 'var(--surface)', border: '1px solid var(--border-b)',
              color: 'var(--text)', cursor: 'pointer',
              fontFamily: "'Inter', sans-serif", fontSize: 13,
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

      {/* Conversation list */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '4px 6px 8px',
        scrollbarWidth: 'none',
        opacity: isExpanded ? 1 : 0,
        transition: 'opacity .18s ease',
        pointerEvents: isExpanded ? 'auto' : 'none',
      }}>
        {conversations.length === 0 ? (
          <div style={{
            padding: '24px 10px', textAlign: 'center',
            fontFamily: "'Inter', sans-serif", fontSize: 9,
            letterSpacing: '.08em', color: 'var(--dimmer)', lineHeight: 1.8,
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
                  fontFamily: "'Inter', sans-serif",
                }}>
                  {group}
                </div>
                {chats.map(chat => {
                  const isActive  = activeConvId === chat.id
                  const isHovered = hoveredId === chat.id
                  const isEditing = editingId === chat.id
                  const isConfirm = confirmDel === chat.id

                  return (
                    <div
                      key={chat.id}
                      onClick={() => !isEditing && onSelectChat(chat.id)}
                      onMouseEnter={() => setHoveredId(chat.id)}
                      onMouseLeave={() => { setHoveredId(null); if (confirmDel === chat.id) setConfirmDel(null) }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center',
                        padding: '6px 6px 6px 8px',
                        borderRadius: 7, boxSizing: 'border-box',
                        border:     isActive ? '1px solid var(--accent-bdr)' : '1px solid transparent',
                        background: isActive ? 'var(--accent-bg)' : isHovered ? 'var(--surface)' : 'transparent',
                        cursor: isEditing ? 'default' : 'pointer',
                        transition: 'background .12s',
                        gap: 6,
                      }}
                    >
                      <MessageSquare size={13} style={{
                        color: isActive ? 'var(--accent)' : 'var(--dimmer)',
                        flexShrink: 0, marginTop: 1,
                      }} />

                      {isEditing ? (
                        <input
                          ref={editRef}
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(chat.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); commitEdit(chat.id) }
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                          onClick={e => e.stopPropagation()}
                          style={{
                            flex: 1, background: 'var(--bg)', border: '1px solid var(--accent-bdr)',
                            borderRadius: 4, padding: '2px 5px',
                            fontFamily: "'Inter', sans-serif", fontSize: 12.5,
                            color: 'var(--text)', outline: 'none', minWidth: 0,
                          }}
                        />
                      ) : (
                        <span style={{
                          fontFamily: "'Inter', sans-serif", fontSize: 12.5,
                          color: isActive ? 'var(--text)' : 'var(--muted)',
                          overflow: 'hidden', textOverflow: 'ellipsis',
                          flex: 1, whiteSpace: 'nowrap', minWidth: 0,
                        }}>
                          {chat.title}
                        </span>
                      )}

                      {!isEditing && (
                        isConfirm ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                            <button
                              onClick={commitDelete}
                              style={{
                                fontSize: 9.5, letterSpacing: '.06em',
                                color: '#e05252', background: 'rgba(224,82,82,.12)',
                                border: '1px solid rgba(224,82,82,.3)',
                                borderRadius: 4, padding: '2px 6px',
                                cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Delete
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setConfirmDel(null) }}
                              style={{
                                fontSize: 9.5, letterSpacing: '.06em',
                                color: 'var(--dimmer)', background: 'transparent',
                                border: '1px solid var(--border-b)',
                                borderRadius: 4, padding: '2px 6px',
                                cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                            <button
                              onClick={e => startEdit(chat, e)}
                              title="Rename"
                              style={actionIconStyle(isHovered)}
                              onMouseEnter={e => {
                                if (!isHovered) return
                                const b = e.currentTarget as HTMLButtonElement
                                b.style.color = 'var(--muted)'; b.style.background = 'var(--surface2)'
                              }}
                              onMouseLeave={e => {
                                const b = e.currentTarget as HTMLButtonElement
                                b.style.color = 'var(--dimmer)'; b.style.background = 'transparent'
                              }}
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              onClick={e => startDelete(chat.id, e)}
                              title="Delete"
                              style={actionIconStyle(isHovered)}
                              onMouseEnter={e => {
                                if (!isHovered) return
                                const b = e.currentTarget as HTMLButtonElement
                                b.style.color = '#e05252'; b.style.background = 'rgba(224,82,82,.1)'
                              }}
                              onMouseLeave={e => {
                                const b = e.currentTarget as HTMLButtonElement
                                b.style.color = 'var(--dimmer)'; b.style.background = 'transparent'
                              }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div style={{
        flexShrink: 0, padding: '10px 9px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: isExpanded ? 'flex-start' : 'center',
      }}>
        {isExpanded ? (
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                My Account
              </span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 9.5, color: 'var(--dimmer)', letterSpacing: '.03em', whiteSpace: 'nowrap' }}>
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