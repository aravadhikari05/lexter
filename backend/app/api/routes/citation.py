from fastapi import APIRouter
from app.schemas.citation import ParseRequest, ParseResponse, GenerateRequest, GenerateResponse
from app.services.citation_parser import parse_citation
from app.services.citation_generator import generate_citation

router = APIRouter(prefix="/citation", tags=["citation"])

@router.post("/parse", response_model=ParseResponse)
async def parse(req: ParseRequest):
    return await parse_citation(req)

@router.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest):
    return await generate_citation(req)