"""Supabase helpers matching project schema (users, documents, texts, chatlogs)."""

import os
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client | None = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

sb_available = supabase is not None


def insert_documents_row(document_id: str, user_id: str | None, filename: str, file_type: str, status: str):
    if not supabase:
        return None
    payload = {
        "id": document_id,
        "user_id": user_id,
        "filename": filename,
        "file_type": file_type,
        "status": status,
    }
    res = supabase.table("documents").upsert(payload, on_conflict="id").execute()
    return (res.data or [{}])[0]


def update_document_status(document_id: str, status: str):
    if not supabase:
        return None
    res = supabase.table("documents").update({"status": status}).eq("id", document_id).execute()
    return (res.data or [{}])[0]


def insert_texts_row(document_id: str, native_text: str, translated_text: str):
    if not supabase:
        return None
    payload = {
        "document_id": document_id,
        "native_text": native_text,
        "translated_text": translated_text,
    }
    res = supabase.table("texts").upsert(payload, on_conflict="document_id").execute()
    return (res.data or [{}])[0]


def get_texts(document_id: str):
    if not supabase:
        return None
    res = supabase.table("texts").select("native_text, translated_text").eq("document_id", document_id).limit(1).execute()
    rows = res.data or []
    return rows[0] if rows else None


def insert_chatlog(user_id: str | None, document_id: str, message: str, response: str):
    if not supabase:
        return None
    payload = {
        "user_id": user_id,
        "document_id": document_id,
        "message": message,
        "response": response,
    }
    res = supabase.table("chatlogs").insert(payload).execute()
    return (res.data or [{}])[0]
