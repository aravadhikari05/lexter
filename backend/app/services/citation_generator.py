import json
import logging
from app.services.llm import complete, safe_json
from app.core.prompts import GENERATE_SYSTEM
from app.schemas.citation import GenerateRequest, GenerateResponse
from app.services.rule_lookup import get_specific_rules
from app.services.deterministic_formatter import format_case, FormatterError
from app.services.citation_validator import (
    validate_citation,
    sanitize_output,
)

log = logging.getLogger(__name__)


async def generate_citation(req: GenerateRequest, source_type: str = "case") -> GenerateResponse:
    merged = req.parsed.model_dump(exclude_none=True)
    merged.update(req.fields)

    if source_type == "case":
        try:
            generated = format_case(merged)
        except FormatterError:
            generated = None

        if generated is not None:
            return _run_validation(merged, generated)

    result = await _generate_via_llm(merged, req, source_type)
    result = sanitize_output(result)
    return _run_validation(merged, result)


def _run_validation(fields: dict, generated: GenerateResponse) -> GenerateResponse:
    result = validate_citation(fields, generated)
    all_issues = result.errors + result.warnings
    if result.errors:
        log.warning("Citation validation errors: %s", result.errors)
    if result.warnings:
        log.info("Citation validation warnings: %s", result.warnings)
    generated.validationWarnings = all_issues
    return generated


async def _generate_via_llm(merged: dict, req: GenerateRequest, source_type: str) -> GenerateResponse:
    for k in ("missingFields", "needsConfirmation", "isUnpublished", "jurisdiction", "docket"):
        merged.pop(k, None)

    rules = get_specific_rules(source_type, req.parsed.model_dump())
    system = GENERATE_SYSTEM
    if rules:
        system += f"\n\n--- Bluebook Reference ---\n{rules}"

    prompt = (
        "Generate a Bluebook citation for this case:\n"
        + json.dumps(merged, indent=2)
        + "\n\nDo NOT include pincite — return base citation only."
    )

    text = await complete(
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": prompt},
        ],
        max_tokens=500,
        temperature=0,
    )
    data = safe_json(text)
    return GenerateResponse(**data)