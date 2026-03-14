# app/schemas/chat.py
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
    docket:            Optional[str]  = None
    isScotus:          bool           = False
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