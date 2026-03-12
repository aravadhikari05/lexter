// ─── Domain types ─────────────────────────────────────────────────────────────

export type CitPhase = 'idle' | 'ticker' | 'gaps' | 'done'

export interface ParsedCase {
  caseName:        string | null
  volume:          string | null
  reporter:        string | null
  firstPage:       string | null
  pincite:         string | null
  court:           string | null
  year:            string | null
  isScotus:        boolean
  isUnpublished:   boolean
  reporterFullName:string | null
  jurisdiction:    'SCOTUS' | 'Circuit' | 'District' | 'State' | 'Unknown'
  missingFields:   string[]
  needsConfirmation: string[]
}

export interface CitationResult {
  fullCitation: string   // practitioner, italics via <em>
  academicFull: string   // law review, small caps via <span class="sc">
  shortForm:    string   // Rule 10.9
  explanation:  string
}

export interface TickerStep {
  id:     string
  label:  string
  status: 'pending' | 'running' | 'done'
}

// ─── Message types ────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant'
export type MessageType = 'text' | 'thinking'

export interface ChatMessage {
  id:        string
  role:      MessageRole
  type:      MessageType
  text?:     string
  streaming?: boolean
  fileName?: string
}

// ─── Field metadata ───────────────────────────────────────────────────────────

export interface FieldMeta {
  label:       string
  placeholder: string
}

export type CaseFields = Partial<Record<string, string>>
