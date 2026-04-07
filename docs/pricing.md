# Pricing Reference

## Prompt Caching

Prompt caching reuses the precomputed KV cache for identical request prefixes, reducing cost significantly. The system prompt must be **≥4096 tokens** to qualify for caching.

Our parse system prompt with Bluebook rules is ~7,249 tokens — above the threshold. Cache TTL is ~5 minutes.

## Gemini 3.1 Flash Lite Preview (`google/gemini-3.1-flash-lite-preview`)

| Scenario | Cost/prompt | Prompts per $1 |
|---|---|---|
| Worst case (cold, no cache) | $0.00265 | ~377 |
| Best case (warm, cache hit) | $0.000814 | ~1,228 |
