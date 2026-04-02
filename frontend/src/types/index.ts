export interface ParseResponse {
  caseName?:                 string | null
  volume?:                   string | null
  reporter?:                 string | null
  firstPage?:                string | null
  pincite?:                  string | null
  court?:                    string | null
  year?:                     string | null
  fullDate?:                 string | null
  docket?:                   string | null
  dbIdentifier?:             string | null
  weightParenthetical?:      string | null
  explanatoryParenthetical?: string | null
  isScotus?:                 boolean
  isUnpublished?:            boolean
  jurisdiction?:             string
  missingFields?:            string[]
  needsConfirmation?:        string[]
}

export interface CitationResult {
  academicFull:         string
  shortForm:            string
  fullCitation:         string
  rulesUsed:            string[]
  validationWarnings?:  string[]
}

export interface TickerStep {
  id:     string
  label:  string
  status: 'pending' | 'running' | 'done'
  icon?:  string
}

export interface ChatMessage {
  id:         string
  role:       'user' | 'assistant'
  type:       'text' | 'thinking' | 'ticker' | 'confirm' | 'citation'
  text?:      string
  fileName?:  string
  streaming?: boolean
  steps?:     TickerStep[]     // type === 'ticker'
  parsed?:    ParseResponse    // type === 'confirm'
  citation?:  CitationResult   // type === 'citation'
}