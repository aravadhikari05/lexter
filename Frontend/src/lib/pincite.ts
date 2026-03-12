import type { CitationResult } from '../types'

export function applyPincite(base: CitationResult, firstPage: string, pin: string): CitationResult {
  if (!base) return base
  const fp = (firstPage || '').trim()
  const p  = (pin || '').trim()

  const injectFull = (html: string): string => {
    if (!fp) return html
    const esc = fp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const cleaned = html.replace(new RegExp(esc + ',\\s*[\\d\\u2013\\u2014n\\-]+'), fp)
    if (!p) return cleaned
    return cleaned.replace(fp, `${fp}, ${p}`)
  }

  const injectShort = (html: string): string => {
    if (!fp) return html
    const target = p || fp
    return html.replace(/at [\d\u2013\u2014n\-]+/, `at ${target}`)
  }

  return {
    ...base,
    fullCitation: injectFull(base.fullCitation),
    academicFull: injectFull(base.academicFull),
    shortForm:    injectShort(base.shortForm),
  }
}
