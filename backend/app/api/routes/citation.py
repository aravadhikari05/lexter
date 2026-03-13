from fastapi import APIRouter
from app.schemas.citation import CitationRequest, CitationResponse

router = APIRouter(prefix="/citation", tags=["citation"]); 

@router.post("", response_model=CitationResponse)
async def generate_citation(request: CitationRequest):
    return CitationResponse(
        citation=f"Mock citation for: {request.text}",
        source_type="unknown",
    )