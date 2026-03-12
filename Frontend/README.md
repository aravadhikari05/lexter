# Citations AI

Bluebook 21st edition citation assistant — chat-first interface.

## Setup

```bash
npm install
npm run dev
```

## Connecting a real backend

All API calls are isolated in **`src/lib/api.ts`**. There are exactly 3 swap points:

### SWAP POINT A — Parse
```ts
// Current: mock parser in api.ts
// Replace with:
const res = await fetch('/api/parse', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ input: rawInput }),
})
return res.json() // must return ParsedCase shape
```

### SWAP POINT B — Generate
```ts
// Current: mock generator in api.ts
// Replace with:
const res = await fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fields: { ...parsed, ...extraFields }, pincite }),
})
return res.json() // must return CitationResult shape
```

### SWAP POINT C — Chat (streaming)
```ts
// Current: mock typewriter in api.ts
// Replace with SSE streaming fetch:
const res = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ message: userMsg, history }),
})
const reader = res.body!.getReader()
// ... parse SSE, call onChunk(token) per token ...
// return { isCite: false } or { isCite: true, citeInput: '...' }
```

When `isCite: true` is returned from the chat endpoint, the app automatically
kicks off the parse → generate citation flow with the provided `citeInput`.

## Type contracts

See `src/types/index.ts` for `ParsedCase` and `CitationResult` shapes.
These must be respected by real API responses.

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS (utility classes + CSS custom properties for theming)
- DM Mono + Lora from Google Fonts
- Zero runtime dependencies beyond React
# law-citation-gen
