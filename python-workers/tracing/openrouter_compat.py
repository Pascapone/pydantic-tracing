"""
Compatibility patches for upstream OpenRouter/OpenAI schema drift.
"""

from __future__ import annotations

from typing import Any

_PATCH_FLAG = "_native_finish_reason_compat_patched"


def apply_openrouter_native_finish_reason_patch() -> None:
    """
    Patch OpenRouter streaming validation to tolerate missing native_finish_reason.

    Some OpenRouter stream chunks omit `choices[*].native_finish_reason`, while
    pydantic-ai currently validates this field as required in
    `_OpenRouterChunkChoice`. This patch injects a default `None` before
    `_OpenRouterChatCompletionChunk.model_validate(...)`.
    """
    try:
        from pydantic_ai.models import openrouter as openrouter_model
    except Exception:
        return

    streamed_cls = openrouter_model.OpenRouterStreamedResponse
    if getattr(streamed_cls, _PATCH_FLAG, False):
        return

    async def _validate_response_with_native_finish_reason_compat(self):
        try:
            async for chunk in self._response:
                payload = chunk.model_dump()
                choices = payload.get("choices")
                if isinstance(choices, list):
                    for choice in choices:
                        if isinstance(choice, dict) and "native_finish_reason" not in choice:
                            choice["native_finish_reason"] = None

                yield openrouter_model._OpenRouterChatCompletionChunk.model_validate(payload)
        except openrouter_model.APIError as e:
            error = openrouter_model._OpenRouterError.model_validate(e.body)
            raise openrouter_model.ModelHTTPError(
                status_code=error.code,
                model_name=self._model_name,
                body=error.message,
            )

    streamed_cls._validate_response = _validate_response_with_native_finish_reason_compat
    setattr(streamed_cls, _PATCH_FLAG, True)

