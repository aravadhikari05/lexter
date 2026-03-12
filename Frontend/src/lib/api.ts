/**
 * api.ts — All backend calls go through here.
 *
 * TO CONNECT REAL ENDPOINTS:
 *   1. Set VITE_API_BASE in your .env  (e.g. https://api.yourapp.com)
 *   2. Replace the mock functions below with real fetch() calls.
 *   3. The shape of ParsedCase / CitationResult must stay the same.
 *
 * The rest of the app is completely unaware of whether data is mocked or live.
 */

import type { ParsedCase, CitationResult } from '../types'

const USE_MOCK = true // ← flip to false when real API is ready

// ─── Mock helpers ──────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

/** Very naive case name normalizer for the mock */
function normalizeCaseName(raw: string): string {
  return raw
    .replace(/\bv\b\.?/gi, 'v.')
    .replace(/\bvs\b\.?/gi, 'v.')
    .replace(/\bbd\b/gi, 'Bd.')
    .replace(/\beduc\b/gi, 'Educ.')
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Pull fields from raw string — good enough for demo */
function mockParse(raw: string): ParsedCase {
  const s = raw.toLowerCase()

  // Volume reporter page pattern: e.g. "347 U.S. 483" or "384 u.s. 436"
  const reporterMatch = raw.match(/(\d{1,4})\s+([A-Z][A-Za-z.]+(?:\s+[A-Za-z.]+)?)\s+(\d{1,4})/)
  // Year pattern
  const yearMatch = raw.match(/\((\d{4})\)/) ?? raw.match(/\b(1[89]\d{2}|20\d{2})\b/)
  // Pincite: "page, page" e.g. "483, 495"
  const pinciteMatch = raw.match(/\d+,\s*(\d+)/)

  const caseName = (() => {
    // Try to grab everything before the first number
    const beforeNum = raw.split(/\d/)[0].trim().replace(/,\s*$/, '')
    if (beforeNum.length > 3) return normalizeCaseName(beforeNum)
    return null
  })()

  const volume    = reporterMatch?.[1] ?? null
  const reporter  = reporterMatch?.[2] ?? null
  const firstPage = reporterMatch?.[3] ?? null
  const year      = yearMatch?.[1] ?? null
  const pincite   = pinciteMatch?.[1] ?? null

  const missing: string[] = []
  if (!caseName)  missing.push('caseName')
  if (!year)      missing.push('year')
  if (!volume)    missing.push('volume')
  if (!reporter)  missing.push('reporter')
  if (!firstPage) missing.push('firstPage')

  const isScotus = reporter?.toUpperCase().replace('.','') === 'US' ||
                   reporter?.toUpperCase() === 'U.S.'

  return {
    caseName, volume, reporter, firstPage, pincite, court: null, year,
    isScotus, isUnpublished: false, reporterFullName: null,
    jurisdiction: isScotus ? 'SCOTUS' : 'Unknown',
    missingFields: missing, needsConfirmation: [],
  }
}

function mockGenerate(p: ParsedCase, fields: Record<string, string>, pin: string): CitationResult {
  const name      = fields.caseName  || p.caseName  || 'Unknown Case'
  const vol       = fields.volume    || p.volume    || ''
  const rep       = fields.reporter  || p.reporter  || ''
  const fp        = fields.firstPage || p.firstPage || ''
  const yr        = fields.year      || p.year      || ''
  const pincite   = pin || ''

  const pageRef   = pincite ? `${fp}, ${pincite}` : fp
  const courtPart = (!p.isScotus && (fields.court || p.court))
    ? ` ${fields.court || p.court}` : ''
  const paren     = `(${courtPart}${yr})`.replace('( ', '(')

  const full      = `<em>${name}</em>, ${vol} ${rep} ${pageRef} ${paren}.`.replace(/\s+/g, ' ')
  const acad      = `<span class="sc">${name}</span>, ${vol} ${rep} ${pageRef} ${paren}.`.replace(/\s+/g, ' ')
  const shortName = name.split(' v.')[0].trim()
  const atPage    = pincite || fp
  const shortForm = `<em>${shortName}</em>, ${vol} ${rep} at ${atPage}.`

  return {
    fullCitation: full,
    academicFull: acad,
    shortForm,
    explanation: `Case name formatted per Rule 10.2. Reporter abbreviation follows Table T1. Court parenthetical omitted for U.S. Supreme Court under Rule 10.4(b). Short form constructed per Rule 10.9.`,
  }
}

// ─── Streaming chat mock ──────────────────────────────────────────────────────

const CITE_TRIGGER_RE = /\b(cite|format|bluebook|citation for|generate.*cit)\b/i

function mockChatResponse(userMsg: string): { isCite: boolean; citeInput?: string; text?: string } {
  if (CITE_TRIGGER_RE.test(userMsg)) {
    // Strip the trigger word to get the raw citation input
    const raw = userMsg.replace(CITE_TRIGGER_RE, '').trim().replace(/^[:\-,\s]+/, '')
    return { isCite: true, citeInput: raw || userMsg }
  }

  const s = userMsg.toLowerCase()
  if (s.includes('pincite') || s.includes('pin cite')) {
    return { isCite: false, text: "A pincite is the specific page number you're relying on within a case. If Brown v. Board starts at 483 but your quote is on 495, your pincite is 495 — written as 347 U.S. 483, 495." }
  }
  if (s.includes('short form') || s.includes('id.') || s.includes('supra')) {
    return { isCite: false, text: "Id. is used when citing the immediately preceding authority. Supra is for secondary sources cited earlier. Short form (Rule 10.9) is for cases cited earlier in the same document — e.g. Brown, 347 U.S. at 495." }
  }
  if (s.includes('unpublish')) {
    return { isCite: false, text: "Unpublished cases have no official reporter. Cite using the docket number and a Westlaw or LEXIS identifier — e.g. No. 21-1234, 2021 WL 1234567 (9th Cir. Mar. 1, 2021)." }
  }
  return { isCite: false, text: "I can help you format any case citation in Bluebook style. Just say 'cite' followed by the case name and any details you have — I'll figure out the rest." }
}

// ─── Public API surface ───────────────────────────────────────────────────────
// These are the only 3 functions the rest of the app calls.
// Swap mock implementations for real fetch() calls when ready.

/**
 * SWAP POINT A — Parse raw citation input into structured fields.
 * Real endpoint: POST /api/parse  { input: string } → ParsedCase
 */
export async function parseCase(rawInput: string): Promise<ParsedCase> {
  if (!USE_MOCK) {
    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: rawInput }),
    })
    return res.json()
  }

  await delay(900 + Math.random() * 400)
  return mockParse(rawInput)
}

/**
 * SWAP POINT B — Generate citation from complete fields.
 * Real endpoint: POST /api/generate  { fields: ParsedCase & extras, pincite: string } → CitationResult
 */
export async function generateCitation(
  parsed: ParsedCase,
  extraFields: Record<string, string>,
  pincite: string
): Promise<CitationResult> {
  if (!USE_MOCK) {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { ...parsed, ...extraFields }, pincite }),
    })
    return res.json()
  }

  await delay(1200 + Math.random() * 600)
  return mockGenerate(parsed, extraFields, pincite)
}

/**
 * SWAP POINT C — Conversational chat response (non-citation messages).
 * Real endpoint: POST /api/chat (streaming SSE) or non-streaming JSON.
 *
 * onChunk is called once per streamed token.
 * Returns { isCite, citeInput? } — if isCite=true, skip text and start citation flow.
 */
export async function sendChatMessage(
  userMsg: string,
  _history: Array<{ role: string; content: string }>,
  onChunk: (token: string) => void
): Promise<{ isCite: boolean; citeInput?: string }> {
  if (!USE_MOCK) {
    // Example SSE streaming implementation:
    // const res = await fetch('/api/chat', { method:'POST', body: JSON.stringify({ message: userMsg, history: _history }) })
    // const reader = res.body!.getReader()
    // ... parse SSE chunks, call onChunk(token) for each ...
    // return { isCite: false }
    throw new Error('Real chat endpoint not yet implemented')
  }

  const result = mockChatResponse(userMsg)
  if (result.isCite) {
    return { isCite: true, citeInput: result.citeInput }
  }

  // Simulate typewriter streaming
  const text = result.text!
  for (const char of text) {
    onChunk(char)
    await delay(18 + Math.random() * 8)
  }
  return { isCite: false }
}
