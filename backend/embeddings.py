# embeddings.py - embeddings + a simple local vector store (file-backed)
import os
import json
import math
import uuid
from typing import List
import openai

openai.api_key = os.getenv("OPENAI_API_KEY")
DATA_DIR = os.getenv("DATA_DIR", "./data")
VECSTORE_PATH = os.path.join(DATA_DIR, "vecstore.json")

# Ensure data dir
os.makedirs(DATA_DIR, exist_ok=True)

def _ensure_store():
    if not os.path.exists(VECSTORE_PATH):
        with open(VECSTORE_PATH, "w") as f:
            json.dump({"documents": []}, f, indent=2)

def _load_store():
    _ensure_store()
    with open(VECSTORE_PATH, "r") as f:
        return json.load(f)

def _save_store(store):
    with open(VECSTORE_PATH, "w") as f:
        json.dump(store, f, indent=2)

def create_embedding(text: str, model="text-embedding-3-small"):
    r = openai.Embedding.create(model=model, input=text)
    return r["data"][0]["embedding"]

def add_document(doc_id: str, name: str, chunks: List[dict]):
    """
    chunks: list of { id, text, embedding }
    """
    store = _load_store()
    # remove existing with same id
    store["documents"] = [d for d in store["documents"] if d["id"] != doc_id]
    store["documents"].append({
        "id": doc_id,
        "name": name,
        "chunks": chunks,
        "createdAt": None
    })
    _save_store(store)

def _cosine(a, b):
    dot = sum(x*y for x,y in zip(a,b))
    na = math.sqrt(sum(x*x for x in a)) or 1
    nb = math.sqrt(sum(x*x for x in b)) or 1
    return dot / (na*nb)

def query(document_id: str, query_embedding, top_k=5):
    store = _load_store()
    results = []
    for doc in store["documents"]:
        if document_id and doc["id"] != document_id:
            continue
        for ch in doc["chunks"]:
            if not ch.get("embedding"):
                continue
            score = _cosine(query_embedding, ch["embedding"])
            results.append({
                "docId": doc["id"],
                "docName": doc.get("name"),
                "chunkId": ch["id"],
                "text": ch["text"],
                "score": score
            })
    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:top_k]
