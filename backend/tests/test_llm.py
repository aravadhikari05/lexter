"""Tests for llm.safe_json (the only deterministic part of the LLM module)."""
import json
import pytest
from app.services.llm import safe_json


class TestSafeJson:
    def test_plain_json(self):
        result = safe_json('{"key": "value"}')
        assert result == {"key": "value"}

    def test_markdown_fenced_json(self):
        text = '```json\n{"key": "value"}\n```'
        result = safe_json(text)
        assert result == {"key": "value"}

    def test_markdown_fenced_no_language(self):
        text = '```\n{"key": "value"}\n```'
        result = safe_json(text)
        assert result == {"key": "value"}

    def test_whitespace_stripped(self):
        result = safe_json('  \n{"key": "value"}\n  ')
        assert result == {"key": "value"}

    def test_invalid_json_raises(self):
        with pytest.raises(json.JSONDecodeError):
            safe_json("not valid json")

    def test_nested_json(self):
        text = '{"a": {"b": [1, 2, 3]}}'
        result = safe_json(text)
        assert result["a"]["b"] == [1, 2, 3]

    def test_fenced_with_extra_text_after(self):
        text = '```json\n{"key": "value"}\n```\nSome extra text'
        result = safe_json(text)
        assert result == {"key": "value"}
