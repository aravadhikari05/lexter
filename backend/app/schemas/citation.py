from pydantic import BaseModel

class CitationRequest(BaseModel):
    text: str


class CitationResponse(BaseModel):
    citation: str
    source_type: str

