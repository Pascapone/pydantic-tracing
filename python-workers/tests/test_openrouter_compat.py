import pytest

from tracing.openrouter_compat import apply_openrouter_native_finish_reason_patch


@pytest.mark.asyncio
async def test_openrouter_chunk_without_native_finish_reason_is_accepted():
    openrouter_model = pytest.importorskip("pydantic_ai.models.openrouter")

    apply_openrouter_native_finish_reason_patch()

    class _FakeChunk:
        def model_dump(self):
            return {
                "id": "chatcmpl-test",
                "choices": [
                    {
                        "delta": {"content": None},
                        "finish_reason": None,
                        "index": 0,
                        "logprobs": None,
                    }
                ],
                "created": 0,
                "model": "openrouter:test",
                "object": "chat.completion.chunk",
                "provider": "openrouter",
            }

    async def _fake_stream():
        yield _FakeChunk()

    class _DummyStreamedResponse:
        def __init__(self):
            self._response = _fake_stream()
            self._model_name = "openrouter:test"

    dummy = _DummyStreamedResponse()
    patched_validate = openrouter_model.OpenRouterStreamedResponse._validate_response
    generator = patched_validate(dummy)

    chunk = await anext(generator)
    assert chunk.choices[0].native_finish_reason is None

