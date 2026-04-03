import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import health, citation, chat

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s"
)

app = FastAPI(title="Bluebook AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://lexter-alpha.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(citation.router)
app.include_router(health.router)
app.include_router(chat.router)