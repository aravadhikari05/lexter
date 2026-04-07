from typing import Annotated, Optional
from pydantic import BaseModel, BeforeValidator


def _coerce_str(v: object) -> str | None:
    if v is None:
        return None
    return str(v)


CoercedStr = Annotated[Optional[str], BeforeValidator(_coerce_str)]


class ParseRequest(BaseModel):
    raw_input: str

class ParseResponse(BaseModel):
    caseName:                CoercedStr     = None
    volume:                  CoercedStr     = None
    reporter:                CoercedStr     = None
    firstPage:               CoercedStr     = None
    pincite:                 CoercedStr     = None
    court:                   CoercedStr     = None
    year:                    CoercedStr     = None
    fullDate:                Optional[str]  = None
    docket:                  Optional[str]  = None
    dbIdentifier:            Optional[str]  = None
    weightParenthetical:     Optional[str]  = None
    weightParenthetical2:    Optional[str]  = None
    quotingParenthetical:    Optional[str]  = None
    citingParenthetical:     Optional[str]  = None
    explanatoryParenthetical:Optional[str]  = None
    history:                 list[dict]     = []
    popularName:             Optional[str]  = None
    parallelVolume:          Optional[str]  = None
    parallelReporter:        Optional[str]  = None
    parallelFirstPage:       Optional[str]  = None
    isScotus:                bool           = False
    isUnpublished:           bool           = False
    jurisdiction:            str            = "Unknown"
    missingFields:           list[str]      = []
    needsConfirmation:       list[str]      = []
    autoFilled:              dict[str, str]  = {}  # field → source ("LLM" or "CL")


class GenerateRequest(BaseModel):
    parsed:  ParseResponse
    fields:  dict[str, str] = {}
    pincite: str = ""

class GenerateResponse(BaseModel):
    academicFull:       str
    shortForm:          str
    fullCitation:       str
    rulesUsed:          list[str] = []
    validationWarnings: list[str] = []