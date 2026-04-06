from app.core.llm import complete, safe_json
from app.core.prompts import PARSE_SYSTEM
from app.schemas.citation import ParseRequest, ParseResponse
from app.utils.rule_lookup import get_parser_rules
from app.utils.missing_fields import check_missing_fields
from app.utils.normalizer import normalize
from app.services.lookup import mark_auto_filled


async def parse_citation(req: ParseRequest, source_type: str = "case", tags: list[str] | None = None) -> ParseResponse:
    tags = tags or ["published"]
    rules = get_parser_rules(tags)
    system = PARSE_SYSTEM
    if rules:
        system += f"\n\n--- Bluebook Reference ---\n{rules}"

    text = await complete(
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": req.raw_input},
        ],
        max_tokens=500,
        temperature=0,
    )
    data = safe_json(text)
    parsed = ParseResponse(**data)

    # Deterministic normalization: T6, reporter, court, isScotus, jurisdiction
    parsed = normalize(parsed)

    # Override LLM's missing-field decision with deterministic check
    missing, needs_conf = check_missing_fields(parsed)
    parsed.missingFields = missing
    parsed.needsConfirmation = needs_conf

    # Track which fields the user didn't provide (filled by LLM from memory)
    parsed = mark_auto_filled(parsed, req.raw_input)

    return parsed