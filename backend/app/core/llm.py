import json
import re
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
    # Extract from a ```...``` block anywhere in the response
    block = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if block:
        return json.loads(block.group(1).strip())
    # Extract the first {...} object spanning multiple lines
    obj = re.search(r"\{[\s\S]*\}", text)
    if obj:
        return json.loads(obj.group(0))
    return json.loads(text)

def _inject_no_reasoning(kwargs: dict) -> dict:
    extra = kwargs.pop("extra_body", {}) or {}
    extra.setdefault("reasoning", {"effort": "none"})
    kwargs["extra_body"] = extra
    return kwargs

async def complete(messages: list[dict], **kwargs) -> str:
    kwargs = _inject_no_reasoning(kwargs)
    extra = kwargs.get("extra_body", {})
    if extra.get("tools"):
        print(f"[LLM] web_search enabled | model={settings.model}", flush=True)
    resp = await client.chat.completions.create(
        model=settings.model,
        messages=messages,
        **kwargs,
    )
    content = resp.choices[0].message.content or ""
    # print(f"\n[LLM] {content}\n", flush=True)
    return content

async def stream(messages: list[dict], **kwargs):
    kwargs = _inject_no_reasoning(kwargs)
    return await client.chat.completions.create(
        model=settings.model,
        messages=messages,
        stream=True,
        **kwargs,
    )