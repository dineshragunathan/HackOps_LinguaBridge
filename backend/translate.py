"""Translate module using OpenAI Chat Completions API (modern SDK)."""

import os
from openai import OpenAI


def _get_openai_client() -> OpenAI:
    # OPENAI_API_KEY should be available in environment; caller is expected to load .env
    return OpenAI()


def translate_text_to_english(source_text: str, max_tokens: int = 1200, model: str = "gpt-4o-mini") -> str:
    """
    Calls OpenAI to translate possibly noisy OCR output into clean English.
    Returns the translated text (string). This is a prototype-step.
    """
    if not source_text or not source_text.strip():
        return ""

    prompt = (
        "You are an expert translator. Input is text extracted from a scanned document "
        "in Nepali or Sinhala or both. The text may contain OCR noise. "
        "Produce a clean English translation preserving meaning. Return only the translation text.\n\n"
        f"---\n\n{source_text[:16000]}\n\n---\n\nTranslate above to English:"
    )

    client = _get_openai_client()

    candidate_models = [model, "gpt-4o", "gpt-4o-mini", "gpt-4o-2024-08-06", "gpt-3.5-turbo-0125"]
    last_error: Exception | None = None
    for m in candidate_models:
        try:
            resp = client.chat.completions.create(
                model=m,
                messages=[
                    {"role": "system", "content": "You are a translation assistant."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.0,
                max_tokens=max_tokens,
            )
            content = (resp.choices[0].message.content or "").strip()
            if content:
                return content
        except Exception as e:  # capture and try next model
            last_error = e
            continue

    # If all attempts failed, re-raise the last error for caller to handle/log
    if last_error:
        raise last_error
    return ""
