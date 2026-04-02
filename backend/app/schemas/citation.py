from typing import Optional
from pydantic import BaseModel


class HistoryMessage(BaseModel):
    role:    str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: list[HistoryMessage] = []


class ParseRequest(BaseModel):
    raw_input: str

class ParseResponse(BaseModel):
    caseName:          Optional[str]  = None
    volume:            Optional[str]  = None
    reporter:          Optional[str]  = None
    firstPage:         Optional[str]  = None
    pincite:           Optional[str]  = None
    court:             Optional[str]  = None
    year:              Optional[str]  = None
    fullDate:                Optional[str]  = None  # e.g. "Dec. 30, 1977" — required for unpublished (Rule 10.5(b))
    docket:                  Optional[str]  = None
    dbIdentifier:            Optional[str]  = None  # e.g. "2024 WL 47632" or "2024 LX 18483" — electronic DB (B10.1.4(i))
    weightParenthetical:     Optional[str]  = None  # e.g. "per curiam", "5-4 decision", "Stevens, J., dissenting"
    explanatoryParenthetical:Optional[str]  = None  # e.g. "holding that the statute was unconstitutional"
    isScotus:                bool           = False
    isUnpublished:     bool           = False
    jurisdiction:      str            = "Unknown"
    missingFields:     list[str]      = []
    needsConfirmation: list[str]      = []


class GenerateRequest(BaseModel):
    parsed:  ParseResponse
    fields:  dict[str, str] = {}
    pincite: str = ""

class GenerateResponse(BaseModel):
    academicFull: str
    shortForm:    str
    fullCitation: str
    rulesUsed:    list[str] = []
    validationWarnings: list[str] = []