from pydantic import BaseModel

class HistoryMessage(BaseModel):
    role:    str
    content: str

class ChatRequest(BaseModel):
    message:     str
    history:     list[HistoryMessage] = []
    intent:      str = "create"
    source_type: str = "case"