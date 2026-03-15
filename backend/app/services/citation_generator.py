import json
from app.services.llm import complete, safe_json
from app.core.prompts import GENERATE_SYSTEM
from app.schemas.citation import GenerateRequest, GenerateResponse

async def generate_citation(req: GenerateRequest) -> GenerateResponse:
    merged = req.parsed.model_dump(exclude_none=True)
    merged.update(req.fields)
    for k in ("missingFields", "needsConfirmation", "isUnpublished", "jurisdiction", "docket"):
        merged.pop(k, None)

    prompt = (
        "Generate a Bluebook citation for this case:\n"
        + json.dumps(merged, indent=2)
        + "\n\nDo NOT include pincite — return base citation only."
    )

    text = await complete(
        messages=[
            {"role": "system", "content": GENERATE_SYSTEM},
            {"role": "user",   "content": prompt},
        ],
        max_tokens=500,
        temperature=0,
    )
    data = safe_json(text)
    return GenerateResponse(**data)