# backend/translate.py
"""Translate module using OpenAI Chat Completions API (modern SDK)."""

import os
from openai import OpenAI

def _get_openai_client() -> OpenAI:
    # OPENAI_API_KEY must be in environment; app loads .env before imports
    return OpenAI()

def translate_text_to_english(source_text: str, max_tokens: int = 1200, model: str = "gpt-4o-mini") -> str:
    """
    Calls OpenAI to translate possibly noisy OCR output into clean English.
    Returns the translated text (string). Prototype-safe with model fallbacks.
    """
    if not source_text or not source_text.strip():
        return ""

    prompt = (
        "You are an expert translator specializing in OCR text correction and translation. "
        "Input is text extracted from scanned documents in Nepali or Sinhala (or both). "
        "The text may contain OCR noise, repeated characters, or garbled text. "
        "Your task:\n"
        "1. First, clean and correct any obvious OCR errors\n"
        "2. Then translate the corrected text to clear, natural English\n"
        "3. Preserve the original meaning and context\n"
        "4. Return ONLY the final English translation\n\n"
        f"OCR Text to translate:\n---\n{source_text[:16000]}\n---\n\n"
        "Provide clean English translation:"
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
        except Exception as e:
            last_error = e
            continue

    if last_error:
        raise last_error
    return ""


def generate_chat_response(user_message: str, document_context: str, max_tokens: int = 800, model: str = "gpt-4o-mini") -> str:
    """
    Generate an intelligent chat response based on document context and user question.
    """
    if not user_message.strip():
        return "Please ask me a question about the document!"
    
    system_prompt = """You are a helpful AI assistant that answers questions based on document content. 

Rules:
- Answer ONLY based on the provided document context
- If the document doesn't contain information relevant to the question, politely say so
- Provide clear, concise, and helpful responses
- If possible, cite or reference specific parts of the document
- Be helpful and conversational but professional

Document content will be provided with both original text and English translations."""

    user_prompt = f"""Document context:
{document_context}

User question: {user_message}

Please provide a helpful response based on the document content above. If the question cannot be answered from the document, please let me know."""

    client = _get_openai_client()
    
    candidate_models = [model, "gpt-4o", "gpt-4o-mini", "gpt-4o-2024-08-06", "gpt-3.5-turbo-0125"]
    last_error: Exception | None = None
    
    for m in candidate_models:
        try:
            resp = client.chat.completions.create(
                model=m,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
                max_tokens=max_tokens,
            )
            content = (resp.choices[0].message.content or "").strip()
            if content:
                return content
        except Exception as e:
            last_error = e
            continue
    
    if last_error:
        print(f"Chat generation failed: {last_error}")
        return f"I understand you're asking about: '{user_message}'. However, I'm having trouble processing your request right now. Please try rephrasing your question."
    
    return "I'm having trouble understanding your question. Could you please rephrase it?"
