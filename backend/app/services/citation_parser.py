from app.services.llm import complete, safe_json
from app.core.prompts import PARSE_SYSTEM
from app.schemas.citation import ParseRequest, ParseResponse
from app.services.rule_lookup import get_general_rules
from app.services.missing_fields import check_missing_fields
from app.services.normalizer import normalize


async def parse_citation(req: ParseRequest, source_type: str = "case") -> ParseResponse:
    rules = get_general_rules(source_type)
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

    return parsed