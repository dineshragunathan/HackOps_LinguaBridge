from supabase import create_client, Client
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def sb_available():
    return supabase is not None


def insert_document(document_id, user_id, title, file_url, language, page_count):
    try:
        res = supabase.table("documents").insert({
            "document_id": document_id,
            "user_id": user_id,
            "title": title,
            "file_url": file_url,
            "language": language,
            "page_count": page_count,
        }).execute()
        return res.data
    except Exception as e:
        print("[supabase] insert_document exception:", e)
        return None


def insert_translation(document_id, original_text, translated_text, page_number):
    try:
        res = supabase.table("translations").insert({
            "document_id": document_id,
            "original_text": original_text,
            "translated_text": translated_text,
            "page_number": page_number,
        }).execute()
        return res.data
    except Exception as e:
        print("[supabase] insert_translation exception:", e)
        return None


def get_translations_for_document(document_id):
    try:
        res = supabase.table("translations").select("*").eq("document_id", document_id).order("page_number").execute()
        return res.data
    except Exception as e:
        print("[supabase] get_translations_for_document exception:", e)
        return []


def get_document_metadata(document_id):
    try:
        res = supabase.table("documents").select("*").eq("document_id", document_id).maybe_single().execute()
        return res.data
    except Exception as e:
        print("[supabase] get_document_metadata exception:", e)
        return None


def get_or_create_chat(document_id, user_id):
    try:
        print(f"[supabase] Attempting to create/get chat for doc={document_id}, user={user_id}")
        
        # Try to get existing chat for user and document
        res = supabase.table("chats").select("*")\
            .eq("document_id", document_id).eq("user_id", user_id).maybe_single().execute()
        
        print(f"[supabase] Existing chat query result: {res}")
        
        if res and hasattr(res, 'data') and res.data:
            return res.data["chat_id"]
        
        # Create new chat session
        from uuid import uuid4
        chat_id = str(uuid4())
        
        chat_data = {
            "chat_id": chat_id,
            "document_id": document_id,
            "user_id": user_id,
        }
        print(f"[supabase] Creating new chat with data: {chat_data}")
        
        res_insert = supabase.table("chats").insert(chat_data).execute()
        print(f"[supabase] Chat creation result: {res_insert.data}")
        
        return chat_id
    except Exception as e:
        print(f"[supabase] get_or_create_chat exception: {e}")
        import traceback
        print(f"[supabase] Full traceback: {traceback.format_exc()}")
        return None


def insert_message(chat_id, role, content):
    try:
        res = supabase.table("messages").insert({
            "chat_id": chat_id,
            "role": role,
            "content": content,
        }).execute()
        return res.data
    except Exception as e:
        print("[supabase] insert_message exception:", e)
        return None


def get_user_documents(user_id):
    """Get all documents for a specific user"""
    try:
        res = supabase.table("documents").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        return res.data
    except Exception as e:
        print("[supabase] get_user_documents exception:", e)
        return []


def get_chat_messages(chat_id):
    """Get all messages for a specific chat"""
    try:
        res = supabase.table("messages").select("*").eq("chat_id", chat_id).order("created_at").execute()
        return res.data
    except Exception as e:
        print("[supabase] get_chat_messages exception:", e)
        return []


def get_user_chat_for_document(user_id, document_id):
    """Get chat ID for a user's document, create if doesn't exist"""
    try:
        print(f"[supabase] get_user_chat_for_document: user_id={user_id}, document_id={document_id}")
        
        # Try to get existing chat
        res = supabase.table("chats").select("*").eq("user_id", user_id).eq("document_id", document_id).maybe_single().execute()
        
        print(f"[supabase] Existing chat query result: {res}")
        
        if res and hasattr(res, 'data') and res.data:
            print(f"[supabase] Found existing chat: {res.data}")
            return res.data["chat_id"]
        
        # Create new chat if doesn't exist
        from uuid import uuid4
        chat_id = str(uuid4())
        
        chat_data = {
            "chat_id": chat_id,
            "user_id": user_id,
            "document_id": document_id,
        }
        
        print(f"[supabase] Creating new chat with data: {chat_data}")
        
        res_insert = supabase.table("chats").insert(chat_data).execute()
        print(f"[supabase] Chat creation result: {res_insert}")
        
        return chat_id
    except Exception as e:
        print(f"[supabase] get_user_chat_for_document exception: {e}")
        import traceback
        print(f"[supabase] Full traceback: {traceback.format_exc()}")
        return None


def delete_user_document(user_id, document_id):
    """Delete a document and all related data for a specific user"""
    try:
        print(f"[supabase] delete_user_document: user_id={user_id}, document_id={document_id}")
        
        # First, verify the document belongs to the user
        doc_res = supabase.table("documents").select("*").eq("document_id", document_id).eq("user_id", user_id).maybe_single().execute()
        
        if not doc_res.data:
            print(f"[supabase] Document {document_id} not found or doesn't belong to user {user_id}")
            return False
        
        # Delete translations for this document
        translations_res = supabase.table("translations").delete().eq("document_id", document_id).execute()
        print(f"[supabase] Deleted translations: {translations_res}")
        
        # Delete chat messages for this document (if chats table exists)
        try:
            chats_res = supabase.table("chats").select("chat_id").eq("document_id", document_id).eq("user_id", user_id).execute()
            if chats_res.data:
                for chat in chats_res.data:
                    chat_id = chat["chat_id"]
                    messages_res = supabase.table("messages").delete().eq("chat_id", chat_id).execute()
                    print(f"[supabase] Deleted messages for chat {chat_id}: {messages_res}")
                
                # Delete the chat record
                chat_delete_res = supabase.table("chats").delete().eq("document_id", document_id).eq("user_id", user_id).execute()
                print(f"[supabase] Deleted chat records: {chat_delete_res}")
        except Exception as chat_error:
            print(f"[supabase] Chat deletion failed (table might not exist): {chat_error}")
        
        # Finally, delete the document record
        doc_delete_res = supabase.table("documents").delete().eq("document_id", document_id).eq("user_id", user_id).execute()
        print(f"[supabase] Deleted document: {doc_delete_res}")
        
        return True
    except Exception as e:
        print(f"[supabase] delete_user_document exception: {e}")
        import traceback
        print(f"[supabase] Full traceback: {traceback.format_exc()}")
        return False

