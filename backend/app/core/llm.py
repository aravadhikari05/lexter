import json
import httpx
from openai import AsyncOpenAI
from app.core.config import settings

client = AsyncOpenAI(
    api_key=settings.openrouter_api_key,
    base_url="https://openrouter.ai/api/v1",
    timeout=httpx.Timeout(60, connect=10),
)

def safe_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        text = text.rsplit("```", 1)[0]
    return json.loads(text)

async def complete(messages: list[dict], **kwargs) -> str:
    resp = await client.chat.completions.create(
        model=settings.model,
        messages=messages,
        **kwargs,
    )
    return resp.choices[0].message.content or ""

async def stream(messages: list[dict], **kwargs):
    return await client.chat.completions.create(
        model=settings.model,
        messages=messages,
        stream=True,
        **kwargs,
    )