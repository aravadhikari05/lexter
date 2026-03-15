from app.services.llm import complete, safe_json
from app.core.prompts import PARSE_SYSTEM
from app.schemas.citation import ParseRequest, ParseResponse

async def parse_citation(req: ParseRequest) -> ParseResponse:
    text = await complete(
        messages=[
            {"role": "system", "content": PARSE_SYSTEM},
            {"role": "user",   "content": req.raw_input},
        ],
        max_tokens=500,
        temperature=0,
    )
    data = safe_json(text)
    return ParseResponse(**data)