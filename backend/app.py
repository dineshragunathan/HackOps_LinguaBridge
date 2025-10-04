from dotenv import load_dotenv
from pathlib import Path as _Path
load_dotenv(dotenv_path=_Path(__file__).with_name('.env'), override=False)

import os
import re
import uuid
from datetime import datetime
import time
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
from pdf2image import convert_from_path
import pytesseract
from fpdf import FPDF
import whisper
import librosa
import soundfile as sf
from translate import translate_text_to_english, generate_chat_response
from supabase_client import (
    sb_available,
    supabase,
    insert_document,
    insert_translation,
    get_translations_for_document,
    get_document_metadata,
    get_or_create_chat,
    insert_message,
    get_user_documents,
    get_chat_messages,
    get_user_chat_for_document,
    delete_user_document,
)

app = Flask(__name__)
CORS(app)

UPLOAD_DIR = "tmp_uploads"
DATA_DIR = "data"
ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "mp3", "wav", "m4a", "flac", "ogg"}
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def detect_document_language(file_path):
    """
    Detect the primary language of the document by trying different OCR languages
    """
    try:
        # Check if it's a PDF file
        if file_path.lower().endswith('.pdf'):
            # For PDFs, convert first page to image for language detection
            try:
                from pdf2image import convert_from_path
                images = convert_from_path(file_path, dpi=150, first_page=1, last_page=1)
                if not images:
                    print(f"[language_detection] Failed to convert PDF to image: {file_path}")
                    return "nep"  # Default fallback
                
                # Use the first page image for language detection
                import tempfile
                with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_file:
                    images[0].save(tmp_file.name, 'PNG')
                    temp_image_path = tmp_file.name
            except Exception as e:
                print(f"[language_detection] PDF conversion failed: {e}")
                return "nep"  # Default fallback
        else:
            # For image files, use directly
            temp_image_path = file_path
        
        # Try different language combinations and see which gives the best results
        language_candidates = [
            ("nep", "nep+eng"),  # Nepali first (most common)
            ("sin", "sin+eng"),  # Sinhala second
            ("eng", "eng"),      # English last
        ]
        
        best_lang = "nep"  # Default fallback
        max_text_length = 0
        
        for lang_code, lang_string in language_candidates:
            try:
                # Quick OCR test with basic config
                test_text = pytesseract.image_to_string(temp_image_path, lang=lang_string, config="--psm 6")
                if test_text and test_text.strip():
                    # Count meaningful characters (not just numbers/symbols)
                    meaningful_chars = len([c for c in test_text if c.isalpha() or c.isspace()])
                    if meaningful_chars > max_text_length:
                        max_text_length = meaningful_chars
                        best_lang = lang_code
            except Exception as e:
                print(f"Language detection failed for {lang_string}: {e}")
                continue
        
        # Clean up temporary file if we created one
        if temp_image_path != file_path:
            try:
                os.unlink(temp_image_path)
            except:
                pass
        
        print(f"[language_detection] Detected language: {best_lang} (text length: {max_text_length})")
        return best_lang
    except Exception as e:
        print(f"[language_detection] Error: {e}")
        return "nep"  # Default fallback


def extract_text_from_image(image_path, lang="nep"):
    """
    Enhanced OCR text extraction with preprocessing and cleaning
    """
    from PIL import Image, ImageEnhance, ImageFilter
    
    # First, try to preprocess the image for better OCR
    try:
        img = Image.open(image_path)
        
        # Convert to grayscale for better OCR
        if img.mode != 'L':
            img = img.convert('L')
        
        # Ultra-conservative preprocessing for Nepali text
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.1)  # Minimal contrast enhancement
        
        # Skip noise reduction to preserve text details
        # Skip sharpening to preserve original text clarity
        
        # Save the preprocessed image temporarily
        temp_path = image_path.replace('.', '_processed.')
        img.save(temp_path)
        processed_image_path = temp_path
    except Exception as e:
        print(f"Image preprocessing failed: {e}")
        processed_image_path = image_path
    
    requested = lang or "nep"
    candidates = [
        f"{requested}+eng",
        requested,
        f"{requested}+sin+eng",
        "script/Devanagari+eng",
        "nep+eng",
        "sin+eng",
        "eng",
    ]
    
    # Ultra-conservative OCR configurations for Nepali text
    configs = [
        "--oem 3 --psm 6",  # Uniform block with LSTM (most accurate)
        "--oem 3 --psm 7",  # Single text line with LSTM
    ]

    best_text = ""
    max_reasonable_length = 0

    for langs in candidates:
        for cfg in configs:
            try:
                txt = pytesseract.image_to_string(processed_image_path, lang=langs, config=cfg)
                if txt and txt.strip():
                    cleaned_txt = clean_ocr_text(txt, target_lang=requested)
                    # Prefer longer, more reasonable text
                    if len(cleaned_txt.strip()) > max_reasonable_length and is_reasonable_ocr_output(cleaned_txt, target_lang=requested):
                        best_text = cleaned_txt
                        max_reasonable_length = len(cleaned_txt.strip())
            except Exception as e:
                print(f"OCR failed with {langs}, {cfg}: {e}")
                pass
    
    # Clean up temp file
    try:
        if processed_image_path != image_path:
            os.unlink(processed_image_path)
    except Exception:
        pass
        
    return best_text


def remove_repeated_characters(text):
    """
    Remove lines with excessive character repetition (OCR artifacts)
    """
    lines = text.split('\n')
    cleaned_lines = []
    
    for line in lines:
        # Skip lines with excessive repetition (more than 3 consecutive same characters)
        if re.search(r'(.)\1{3,}', line):
            continue
        
        # Skip lines that are mostly the same character (more than 60% same character)
        if len(line.strip()) > 5:
            char_counts = {}
            for char in line.strip():
                char_counts[char] = char_counts.get(char, 0) + 1
            
            max_count = max(char_counts.values())
            if max_count / len(line.strip()) > 0.6:
                continue
        
        # Skip lines with common OCR noise patterns
        if re.search(r'\b(jey|ve|je|ye|ey)\b', line.lower()):
            continue
        
        cleaned_lines.append(line)
    
    return '\n'.join(cleaned_lines)


def clean_ocr_text(text, target_lang="nep"):
    """
    Clean OCR output by removing unwanted characters and artifacts
    """
    
    # First remove repeated character patterns
    text = remove_repeated_characters(text)
    
    # Remove common OCR artifacts but preserve more characters
    text = re.sub(r'[^\w\s\u0900-\u097F\u0D80-\u0DFF\n।॥.,!?;:()]', '', text)  # Keep punctuation and more characters
    
    # Remove standalone English words that are likely OCR errors
    if target_lang in ["nep", "nepali"]:
        # Split into lines and clean each line
        lines = text.split('\n')
        cleaned_lines = []
        
        for line in lines:
            # If line contains mostly English words (excluding Devanagari), be more conservative
            devanagari_chars = re.findall(r'[\u0900-\u097F]', line)
            if len(devanagari_chars) == 0:
                # Only skip very short English-only lines that are likely noise
                if len(line.strip().split()) <= 1:  # Only skip single word lines
                    continue
            
            # Remove standalone English words that are likely OCR errors
            words = line.split()
            filtered_words = []
            for word in words:
                devanagari_in_word = re.findall(r'[\u0900-\u097F]', word)
                english_in_word = re.findall(r'[a-zA-Z]', word)
                
                # Skip standalone English words that are likely OCR errors
                if not devanagari_in_word and english_in_word:
                    # Skip common OCR noise words (including variations)
                    noise_words = [
                        'jey', 've', 'je', 'ye', 'the', 'and', 'or', 'is', 'be',
                        'jeyy', 'jeyyy', 'jeyyyy', 'jeyyyyy',  # Repeated jey variations
                        'vey', 'veyy', 'veyyy',  # Vey variations
                        'jey', 'jeyjey', 'jeyjeyjey',  # Jey repetitions
                        'je', 'jeje', 'jejeje',  # Je repetitions
                        'ye', 'yeye', 'yeyeye',  # Ye repetitions
                        'ey', 'eyey', 'eyeyey',  # Ey repetitions
                        'y', 'yy', 'yyy', 'yyyy', 'yyyyy',  # Y repetitions
                        'e', 'ee', 'eee', 'eeee', 'eeeee',  # E repetitions
                        'j', 'jj', 'jjj', 'jjjj', 'jjjjj',  # J repetitions
                        'v', 'vv', 'vvv', 'vvvv', 'vvvvv',  # V repetitions
                    ]
                    if word.lower() in noise_words:
                        continue
                    # Skip short English-only words (likely OCR errors)
                    if len(word) <= 3:
                        continue
                    # Skip words with excessive character repetition
                    if re.search(r'(.)\1{2,}', word.lower()):  # 3+ consecutive same characters
                        continue
                
                filtered_words.append(word)
            
            cleaned_line = ' '.join(filtered_words)
            if cleaned_line.strip():
                cleaned_lines.append(cleaned_line)
        
        return '\n'.join(cleaned_lines)
    
    elif target_lang in ["sin", "sinhala"]:
        # Sinhala-specific cleaning
        lines = text.split('\n')
        cleaned_lines = []
        
        for line in lines:
            # If line contains mostly English words (excluding Sinhala), skip simple English words
            sinhala_chars = re.findall(r'[\u0D80-\u0DFF]', line)
            if len(sinhala_chars) == 0:
                # If no Sinhala characters, this might be OCR noise
                if len(line.strip().split()) <= 2:  # Skip short English-only lines
                    continue
            
            # Remove standalone English words that are likely OCR errors
            words = line.split()
            filtered_words = []
            for word in words:
                sinhala_in_word = re.findall(r'[\u0D80-\u0DFF]', word)
                english_in_word = re.findall(r'[a-zA-Z]', word)
                
                # Skip standalone English words that are likely OCR errors
                if not sinhala_in_word and english_in_word:
                    # Skip common OCR noise words
                    noise_words = ['jey', 've', 'je', 'ye', 'the', 'and', 'or', 'is', 'be']
                    if word.lower() in noise_words:
                        continue
                    # Skip short English-only words (likely OCR errors)
                    if len(word) <= 3:
                        continue
                
                filtered_words.append(word)
            
            cleaned_line = ' '.join(filtered_words)
            if cleaned_line.strip():
                cleaned_lines.append(cleaned_line)
        
        return '\n'.join(cleaned_lines)
    
    return text


def is_reasonable_ocr_output(text, target_lang="nep"):
    """
    Check if OCR output looks reasonable for the target language
    """
    if target_lang in ["nep", "nepali"]:
        # Should contain Devanagari characters
        devanagari_chars = re.findall(r'[\u0900-\u097F]', text)
        return len(devanagari_chars) > 0
    elif target_lang in ["sin", "sinhala"]:
        # Should contain Sinhala characters
        sinhala_chars = re.findall(r'[\u0D80-\u0DFF]', text)
        return len(sinhala_chars) > 0
    
    return True


def text_to_pdf(text, output_path, font_path):
    pdf = FPDF()
    pdf.add_page()
    if font_path and os.path.exists(font_path):
        pdf.add_font("CustomFont", "", font_path)
        pdf.set_font("CustomFont", size=14)
    else:
        # Use default font (Arial)
        pdf.set_font("Arial", size=14)
    usable_width = pdf.w - 2 * pdf.l_margin
    for line in text.split("\n"):
        pdf.multi_cell(usable_width, 10, line if line.strip() else " ")
    pdf.output(output_path)


def is_audio_file(filename):
    """Check if the file is an audio file"""
    audio_extensions = {"mp3", "wav", "m4a", "flac", "ogg"}
    return "." in filename and filename.rsplit(".", 1)[1].lower() in audio_extensions


def transcribe_audio(file_path):
    """
    Transcribe audio file to text using Whisper
    """
    try:
        # Load Whisper model (base model for good balance of speed/accuracy)
        # Handle SSL certificate issues
        import ssl
        ssl._create_default_https_context = ssl._create_unverified_context
        
        model = whisper.load_model("base")
        
        # Transcribe the audio
        result = model.transcribe(file_path)
        
        # Extract text from result
        text = result["text"].strip()
        
        if not text:
            return None, "No speech detected in audio file"
        
        return text, None
        
    except Exception as e:
        return None, f"Error transcribing audio: {str(e)}"


def detect_audio_language(file_path):
    """
    Detect the language of the audio content
    """
    try:
        # Handle SSL certificate issues
        import ssl
        ssl._create_default_https_context = ssl._create_unverified_context
        
        model = whisper.load_model("base")
        result = model.transcribe(file_path)
        
        # Get detected language
        detected_lang = result.get("language", "unknown")
        
        # Map Whisper language codes to our language names
        lang_mapping = {
            "si": "sinhala",  # Sinhala
            "ne": "nepali",   # Nepali
            "en": "english",  # English
            "hi": "nepali",   # Hindi (treat as Nepali for our purposes)
        }
        
        return lang_mapping.get(detected_lang, "unknown")
        
    except Exception as e:
        print(f"Error detecting audio language: {e}")
        return "unknown"


@app.route("/upload", methods=["POST"])
def upload_file():
    user_id = request.form.get("user_id")
    if not user_id:
        return jsonify({"error": "Missing user ID"}), 400
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files["file"]
    if not file or file.filename == "" or not allowed_file(file.filename):
        return jsonify({"error": "Invalid file"}), 400

    filename = secure_filename(file.filename)
    doc_id = str(uuid.uuid4())
    ext = filename.rsplit(".", 1)[1].lower()
    file_path = os.path.join(UPLOAD_DIR, f"{doc_id}.{ext}")
    file.save(file_path)

    page_count = 1
    
    # Detect the document language (skip for audio files)
    if is_audio_file(filename):
        detected_lang = "unknown"  # Will be detected later by Whisper
    else:
        detected_lang = detect_document_language(file_path)
    language = detected_lang

    native_texts = []
    translated_texts = []

    # Initialize PDF paths for all file types
    native_pdf_path = os.path.join(DATA_DIR, f"{doc_id}_native.pdf")
    english_pdf_path = os.path.join(DATA_DIR, f"{doc_id}_english.pdf")
    
    if is_audio_file(filename):
        # Handle audio files
        print(f"Processing audio file: {filename}")
        
        try:
            # Transcribe audio to text
            print(f"[audio] Starting transcription for {filename}")
            native_text, error = transcribe_audio(file_path)
            if error:
                print(f"[audio] Transcription error: {error}")
                return jsonify({"error": f"Audio transcription failed: {error}"}), 500
            
            if not native_text.strip():
                print(f"[audio] No speech detected in {filename}")
                return jsonify({"error": "No speech detected in audio file"}), 400
            
            print(f"[audio] Transcription successful: {len(native_text)} characters")
            
            # Detect audio language
            print(f"[audio] Detecting language for {filename}")
            audio_lang = detect_audio_language(file_path)
            language = audio_lang
            print(f"[audio] Detected language: {audio_lang}")
            
            native_texts.append(native_text)
            translated = translate_text_to_english(native_text)
            translated_texts.append(translated)
            print(f"[audio] Translation successful: {len(translated)} characters")
            
        except Exception as e:
            print(f"[audio] Error processing audio file: {e}")
            return jsonify({"error": f"Audio processing failed: {str(e)}"}), 500
        
        # Generate PDFs for audio transcription
        try:
            native_pdf_font = "NotoSansDevanagari-Regular.ttf" if language in ["nepali", "sinhala"] else ""
            english_pdf_font = ""  # Use default font for English
            
            print(f"[audio] Generating PDFs for {filename}")
            text_to_pdf(native_text, native_pdf_path, native_pdf_font)
            if translated.strip():
                text_to_pdf(translated, english_pdf_path, english_pdf_font)
            print(f"[audio] PDFs generated successfully")
        except Exception as e:
            print(f"[audio] PDF generation error: {e}")
            return jsonify({"error": "Internal error generating PDF", "details": str(e)}), 500
            
    elif ext in ["png", "jpg", "jpeg"]:
        # Use detected language for OCR
        native_text = extract_text_from_image(file_path, lang=detected_lang)
        if not native_text.strip():
            # Fallback to mixed language OCR
            native_text = extract_text_from_image(file_path, lang=f"{detected_lang}+eng") or ""
        native_texts.append(native_text)
        translated = translate_text_to_english(native_text)
        translated_texts.append(translated)
        original_pdf_path = None
        english_pdf_path = None
    else:
        # Store the original PDF file
        original_pdf_path = os.path.join(DATA_DIR, f"{doc_id}_original.pdf")
        try:
            import shutil
            shutil.copy2(file_path, original_pdf_path)
            print(f"[pdf] Stored original PDF at {original_pdf_path}")
        except Exception as e:
            print(f"[pdf] Failed to store original PDF: {e}")
        
        try:
            # Convert PDF to images with higher DPI for better OCR
            images = convert_from_path(file_path, dpi=300)
            page_count = len(images)
            print(f"[pdf] Converted {page_count} pages from PDF")
        except Exception as e:
            return jsonify({"error": "PDF processing failed", "details": str(e)}), 500
        
        for i, img in enumerate(images):
            # Use enhanced OCR extraction for PDF pages too
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_file:
                img.save(tmp_file.name, 'PNG')
                print(f"[pdf] Processing page {i+1}/{page_count} with language: {detected_lang}")
                text = extract_text_from_image(tmp_file.name, lang=detected_lang)
                os.unlink(tmp_file.name)
            
            if text and text.strip():
                print(f"[pdf] Extracted {len(text)} characters from page {i+1}")
                native_texts.append(text)
                translated_texts.append(translate_text_to_english(text))
            else:
                print(f"[pdf] No text extracted from page {i+1}")
                native_texts.append("")
                translated_texts.append("")
        
        # Generate translated PDF only
        english_pdf_font = ""  # Use default font for English
        english_pdf_path = os.path.join(DATA_DIR, f"{doc_id}_english.pdf")
        all_translated_text = "\n\n".join(translated_texts)
        try:
            if any(t.strip() for t in translated_texts):
                text_to_pdf(all_translated_text, english_pdf_path, english_pdf_font)
                print(f"[pdf] Generated translated PDF at {english_pdf_path}")
        except Exception as e:
            print(f"[pdf] Failed to generate translated PDF: {e}")
            english_pdf_path = None

    if is_audio_file(filename):
        file_url = f"{doc_id}_native.pdf"  # Audio files are converted to PDFs
    elif ext in ["png", "jpg", "jpeg"]:
        file_url = f"{doc_id}.{ext}"
    else:
        file_url = f"{doc_id}_original.pdf"  # PDFs show original file

    if sb_available():
        insert_document(document_id=doc_id, user_id=user_id, title=filename, file_url=file_url,
                        language=language, page_count=page_count)
        for i, (orig, trans) in enumerate(zip(native_texts, translated_texts), start=1):
            insert_translation(document_id=doc_id, original_text=orig or "", translated_text=trans or "", page_number=i)

    return jsonify({
        "documentId": doc_id,
        "filename": filename,
        "numPages": page_count,
        "original_pdf_path": original_pdf_path if ext == "pdf" else None,
        "english_pdf_path": english_pdf_path,
        "file_ext": ext,
    })


@app.route("/file/<document_id>")
def get_file(document_id):
    lang = request.args.get("lang", "native")
    
    # Check for image files first
    potential_img_extensions = ['png', 'jpg', 'jpeg']
    for ext in potential_img_extensions:
        potential_img_path = os.path.join(UPLOAD_DIR, f"{document_id}.{ext}")
        if os.path.exists(potential_img_path):
            return send_file(potential_img_path, mimetype=f"image/{ext}", as_attachment=False)
    
    # For PDFs, serve original for "native" and translated for "english"
    if lang == "native":
        # Serve original PDF
        original_pdf_path = os.path.join(DATA_DIR, f"{document_id}_original.pdf")
        if os.path.exists(original_pdf_path):
            return send_file(original_pdf_path, mimetype="application/pdf", as_attachment=False)
    else:
        # Serve translated PDF
        translated_pdf_path = os.path.join(DATA_DIR, f"{document_id}_english.pdf")
        if os.path.exists(translated_pdf_path):
            return send_file(translated_pdf_path, mimetype="application/pdf", as_attachment=False)
        # Fallback to original if translated doesn't exist
        original_pdf_path = os.path.join(DATA_DIR, f"{document_id}_original.pdf")
        if os.path.exists(original_pdf_path):
            return send_file(original_pdf_path, mimetype="application/pdf", as_attachment=False)
    
    return jsonify({"error": "File not found"}), 404


@app.route("/feedback", methods=["POST"])
def submit_feedback():
    """Submit user feedback"""
    try:
        data = request.get_json()
        user_id = data.get("user_id")
        feedback_text = data.get("feedback_text")
        feedback_type = data.get("feedback_type", "general")
        rating = data.get("rating")
        
        if not user_id or not feedback_text:
            return jsonify({"error": "Missing required fields"}), 400
        
        if len(feedback_text.strip()) < 10:
            return jsonify({"error": "Feedback must be at least 10 characters long"}), 400
        
        if rating and (rating < 1 or rating > 5):
            return jsonify({"error": "Rating must be between 1 and 5"}), 400
        
        # Insert feedback into Supabase
        if sb_available():
            try:
                result = supabase.table("feedback").insert({
                    "user_id": user_id,
                    "feedback_text": feedback_text.strip(),
                    "feedback_type": feedback_type,
                    "rating": rating
                }).execute()
                
                if result.data:
                    return jsonify({
                        "success": True,
                        "message": "Feedback submitted successfully",
                        "feedback_id": result.data[0]["id"]
                    })
                else:
                    return jsonify({"error": "Failed to save feedback"}), 500
                    
            except Exception as e:
                print(f"Supabase feedback error: {e}")
                return jsonify({"error": "Database error"}), 500
        else:
            return jsonify({"error": "Database not available"}), 500
            
    except Exception as e:
        print(f"Feedback submission error: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/feedback/<user_id>", methods=["GET"])
def get_user_feedback(user_id):
    """Get feedback submitted by a specific user"""
    try:
        if not user_id:
            return jsonify({"error": "User ID required"}), 400
        
        if sb_available():
            try:
                result = supabase.table("feedback").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
                
                if result.data:
                    return jsonify({
                        "success": True,
                        "feedback": result.data
                    })
                else:
                    return jsonify({
                        "success": True,
                        "feedback": []
                    })
                    
            except Exception as e:
                print(f"Supabase feedback fetch error: {e}")
                return jsonify({"error": "Database error"}), 500
        else:
            return jsonify({"error": "Database not available"}), 500
            
    except Exception as e:
        print(f"Get feedback error: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/metadata/<document_id>")
def get_metadata(document_id):
    if not sb_available():
        return jsonify({"error": "Supabase not configured"}), 500
    translations = get_translations_for_document(document_id)
    doc_meta = get_document_metadata(document_id)
    if not doc_meta:
        return jsonify({"error": "Document not found"}), 404
    native_text = "\n\n".join(t["original_text"] for t in translations if t["original_text"])
    translated_text = "\n\n".join(t["translated_text"] for t in translations if t["translated_text"])
    
    # Enhanced debug logging
    print(f"[Metadata] Document ID: {document_id}")
    print(f"[Metadata] Found {len(translations)} translation records")
    print(f"[Metadata] Translation records:")
    for i, t in enumerate(translations):
        print(f"  Record {i}: page={t.get('page_number', 'N/A')}, text_len={len(t.get('translated_text', ''))}")
        print(f"    Text preview: {t.get('translated_text', '')[:100]}...")
    print(f"[Metadata] Combined text length: {len(translated_text)}")
    print(f"[Metadata] First 200 chars: {translated_text[:200]}")
    
    return jsonify({
        "filename": doc_meta["title"],
        "fileExt": doc_meta["file_url"].split(".")[-1].lower(),
        "nativeText": native_text,
        "translatedText": translated_text
    })


@app.route("/chat", methods=["POST"])
def chat():
    data = request.json or {}
    document_id = data.get("documentId")
    user_id = data.get("userId")
    message = data.get("message", "").strip()
    if not document_id or not user_id or not message:
        return jsonify({"error": "Missing required fields"}), 400
    if not sb_available():
        return jsonify({"error": "Supabase not configured"}), 500
    
    try:
        print(f"[chat] Received request: doc={document_id}, user={user_id}, msg={message}")
        
        # Get document context from Supabase
        translations = get_translations_for_document(document_id)
        doc_meta = get_document_metadata(document_id)
        
        print(f"[chat] Document metadata: {doc_meta}")
        print(f"[chat] Translations count: {len(translations) if translations else 0}")
        
        if not translations:
            assistant_reply = "Sorry, I don't have access to the document content. Please make sure the document was processed successfully."
        else:
            # Prepare document context for AI
            context_parts = []
            native_context = " ".join([t["original_text"] for t in translations if t["original_text"]])
            translated_context = " ".join([t["translated_text"] for t in translations if t["translated_text"]])
            
            if native_context:
                context_parts.append(f"Original text: {native_context[:2000]}")
            if translated_context:
                context_parts.append(f"English translation: {translated_context[:2000]}")
            
            document_context = "\n\n".join(context_parts)
            
            print(f"[chat] Generated context length: {len(document_context)}")
            
            # Generate intelligent response using OpenAI
            assistant_reply = generate_chat_response(message, document_context)
        
        print(f"[chat] Generated response: {assistant_reply[:100]}...")
        
        # Save messages to Supabase
        try:
            # Get or create chat for this user and document
            chat_id = get_or_create_chat(document_id, user_id)
            if chat_id:
                # Save user message
                insert_message(chat_id, "user", message)
                # Save assistant reply
                insert_message(chat_id, "assistant", assistant_reply)
                print(f"[chat] Saved messages to Supabase for chat_id={chat_id}")
            else:
                print(f"[chat] Failed to create/get chat for user={user_id}, doc={document_id}")
        except Exception as save_error:
            print(f"[chat] Error saving messages: {save_error}")
        
        return jsonify({"reply": assistant_reply})
    except Exception as e:
        print(f"Chat error: {e}")
        return jsonify({"error": "Internal error processing chat", "details": str(e)}), 500


@app.route("/user/documents", methods=["GET"])
def get_user_documents_endpoint():
    """Get all documents for a specific user"""
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id parameter required"}), 400
    
    if not sb_available():
        return jsonify({"error": "Supabase not configured"}), 500
    
    try:
        documents = get_user_documents(user_id)
        return jsonify({"documents": documents})
    except Exception as e:
        print(f"Get user documents error: {e}")
        return jsonify({"error": "Failed to fetch user documents", "details": str(e)}), 500


@app.route("/user/chat/<document_id>", methods=["GET"])
def get_user_chat_endpoint(document_id):
    """Get chat messages for a user's document"""
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id parameter required"}), 400
    
    if not sb_available():
        return jsonify({"error": "Supabase not configured"}), 500
    
    try:
        # Get chat ID for this user and document
        chat_id = get_user_chat_for_document(user_id, document_id)
        if not chat_id:
            print(f"[chat] No chat found for user={user_id}, doc={document_id}")
            return jsonify({"chat_id": None, "messages": []})
        
        # Get messages for this chat
        messages = get_chat_messages(chat_id)
        print(f"[chat] Returning {len(messages)} messages for user={user_id}, doc={document_id}, chat_id={chat_id}")
        return jsonify({"chat_id": chat_id, "messages": messages})
    except Exception as e:
        print(f"Get user chat error: {e}")
        return jsonify({"error": "Failed to fetch chat messages", "details": str(e)}), 500


@app.route("/user/chat/<document_id>/message", methods=["POST"])
def save_user_message_endpoint(document_id):
    """Save a chat message for a user's document"""
    data = request.json or {}
    user_id = data.get("user_id")
    role = data.get("role")  # "user" or "assistant"
    content = data.get("content")
    
    if not user_id or not role or not content:
        return jsonify({"error": "user_id, role, and content required"}), 400
    
    if not sb_available():
        return jsonify({"error": "Supabase not configured"}), 500
    
    try:
        # Get or create chat for this user and document
        chat_id = get_user_chat_for_document(user_id, document_id)
        if not chat_id:
            return jsonify({"error": "Failed to get/create chat"}), 500
        
        # Save the message
        result = insert_message(chat_id, role, content)
        if result:
            return jsonify({"success": True, "message_id": result[0].get("id") if result else None})
        else:
            return jsonify({"error": "Failed to save message"}), 500
    except Exception as e:
        print(f"Save user message error: {e}")
        return jsonify({"error": "Failed to save message", "details": str(e)}), 500


@app.route("/user/documents/<document_id>", methods=["DELETE"])
def delete_user_document_endpoint(document_id):
    """Delete a user's document and all related data"""
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id parameter required"}), 400
    
    if not sb_available():
        return jsonify({"error": "Supabase not configured"}), 500
    
    try:
        print(f"[delete] Deleting document {document_id} for user {user_id}")
        
        # Delete from database
        success = delete_user_document(user_id, document_id)
        
        if not success:
            return jsonify({"error": "Failed to delete document or document not found"}), 404
        
        # Also delete the actual files from the filesystem
        try:
            import os
            import glob
            
            # Delete original uploaded file
            upload_pattern = os.path.join(UPLOAD_DIR, f"{document_id}.*")
            for file_path in glob.glob(upload_pattern):
                if os.path.exists(file_path):
                    os.remove(file_path)
                    print(f"[delete] Deleted uploaded file: {file_path}")
            
            # Delete generated PDF files
            pdf_patterns = [
                os.path.join(DATA_DIR, f"{document_id}_native.pdf"),
                os.path.join(DATA_DIR, f"{document_id}_english.pdf"),
            ]
            
            for pdf_path in pdf_patterns:
                if os.path.exists(pdf_path):
                    os.remove(pdf_path)
                    print(f"[delete] Deleted PDF file: {pdf_path}")
                    
        except Exception as file_error:
            print(f"[delete] File deletion warning: {file_error}")
            # Don't fail the request if file deletion fails
        
        return jsonify({"success": True, "message": "Document deleted successfully"})
        
    except Exception as e:
        print(f"Delete document error: {e}")
        return jsonify({"error": "Failed to delete document", "details": str(e)}), 500


@app.route('/download/pdf/<document_id>', methods=['GET'])
def download_translation_pdf(document_id):
    """Download translated text as PDF"""
    try:
        if not sb_available():
            return jsonify({"error": "Database not available"}), 500
            
        # Get document metadata
        doc_meta = get_document_metadata(document_id)
        if not doc_meta:
            return jsonify({"error": "Document not found"}), 404
        
        # Use the exact same method as metadata endpoint
        translations = get_translations_for_document(document_id)
        if not translations:
            return jsonify({"error": "No translations found"}), 404
        
        # Use identical logic to metadata endpoint
        translated_text = "\n\n".join(t["translated_text"] for t in translations if t["translated_text"])
        
        # Enhanced debug logging
        print(f"[PDF Download] Document ID: {document_id}")
        print(f"[PDF Download] Found {len(translations)} translation records")
        print(f"[PDF Download] Translation records:")
        for i, t in enumerate(translations):
            print(f"  Record {i}: page={t.get('page_number', 'N/A')}, text_len={len(t.get('translated_text', ''))}")
            print(f"    Text preview: {t.get('translated_text', '')[:100]}...")
        print(f"[PDF Download] Combined text length: {len(translated_text)}")
        print(f"[PDF Download] First 200 chars: {translated_text[:200]}")
        
        if not translated_text.strip():
            return jsonify({"error": "No translated content available"}), 404
        
        # Create PDF with translated text
        pdf_filename = f"{document_id}_download.pdf"
        pdf_path = os.path.join(DATA_DIR, pdf_filename)
        text_to_pdf(translated_text, pdf_path, None)  # None for font_path uses default Arial
        
        if os.path.exists(pdf_path):
            return send_file(pdf_path, as_attachment=True, download_name=f"translation_{document_id}.pdf")
        else:
            return jsonify({"error": "Failed to generate PDF"}), 500
            
    except Exception as e:
        print(f"Error downloading PDF: {e}")
        return jsonify({"error": "Failed to download PDF"}), 500


@app.route('/debug/translations/<document_id>', methods=['GET'])
def debug_translations(document_id):
    """Debug endpoint to see exactly what translation data exists"""
    try:
        if not sb_available():
            return jsonify({"error": "Database not available"}), 500
            
        # Get document metadata
        doc_meta = get_document_metadata(document_id)
        if not doc_meta:
            return jsonify({"error": "Document not found"}), 404
        
        # Get translations for the document
        translations = get_translations_for_document(document_id)
        
        # Return detailed information
        return jsonify({
            "document_id": document_id,
            "document_meta": doc_meta,
            "translations_count": len(translations),
            "translations": translations,
            "combined_translated_text": "\n\n".join(t["translated_text"] for t in translations if t["translated_text"]),
            "combined_native_text": "\n\n".join(t["original_text"] for t in translations if t["original_text"])
        })
        
    except Exception as e:
        print(f"Debug translations error: {e}")
        return jsonify({"error": "Debug failed"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
