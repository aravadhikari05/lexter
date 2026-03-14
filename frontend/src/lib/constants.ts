import type { FieldMeta } from '../types'

export const FIELD_META: Record<string, FieldMeta> = {
  caseName:  { label: 'FULL CASE NAME', placeholder: 'Brown v. Board of Education' },
  volume:    { label: 'VOLUME',         placeholder: '347' },
  reporter:  { label: 'REPORTER',       placeholder: 'U.S.' },
  firstPage: { label: 'FIRST PAGE',     placeholder: '483' },
  court:     { label: 'COURT',          placeholder: '9th Cir.' },
  year:      { label: 'YEAR',           placeholder: '1954' },
}

export const REPORTER_GROUP = ['volume', 'reporter', 'firstPage'] as const

export const PARSE_STEPS = [
  { id: 'read',     label: 'READING INPUT' },
  { id: 'name',     label: 'EXTRACTING CASE NAME' },
  { id: 'reporter', label: 'IDENTIFYING REPORTER' },
  { id: 'court',    label: 'CHECKING JURISDICTION' },
  { id: 'fields',   label: 'SCANNING FOR MISSING FIELDS' },
]

export const LOOKUP_STEPS = [
  { id: 'cl_search', label: 'SEARCHING COURTLISTENER' },
  { id: 'cl_parse',  label: 'READING CITATION DATA' },
  { id: 'cl_fill',   label: 'FILLING MISSING FIELDS' },
]

export const GENERATE_STEPS = [
  { id: 'rule',      label: 'APPLYING BLUEBOOK RULE 10' },
  { id: 'paren',     label: 'BUILDING COURT PARENTHETICAL' },
  { id: 'format',    label: 'FORMATTING CASE NAME' },
  { id: 'shortform', label: 'CONSTRUCTING SHORT FORM (R. 10.9)' },
  { id: 'render',    label: 'RENDERING CITATION' },
]

export const SUGGESTIONS = [
  'Cite Brown v. Board of Education',
  'How do I cite an unpublished case?',
  'Miranda v Arizona 384 us 436 1966',
  "What's the difference between id. and supra?",
]