import os
from dotenv import load_dotenv
from pathlib import Path
import uuid
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
from pdf2image import convert_from_path
from pdf2image import pdfinfo_from_path
import pytesseract
from fpdf import FPDF
from PIL import Image, ImageDraw, ImageFont
from translate import translate_text_to_english
from supabase_client import (
    sb_available,
    insert_documents_row,
    update_document_status,
    insert_texts_row,
    get_texts,
    insert_chatlog,
)
import openai

# ------------------------------
# Config
# ------------------------------

# Load environment variables from .env located next to this file (robust when launched from other CWDs)
_env_path = Path(__file__).with_name('.env')
load_dotenv(dotenv_path=_env_path, override=False)

UPLOAD_DIR = "tmp_uploads"
DATA_DIR = "data"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

openai.api_key = os.environ.get("OPENAI_API_KEY")

ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg"}

# ------------------------------
# App init
# ------------------------------

app = Flask(__name__)
CORS(app)

# ------------------------------
# Helpers
# ------------------------------

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_image(image_path, lang="nep"):  # nep: Nepali, sin: Sinhala
    """
    Try OCR with a sequence of language fallbacks to improve robustness when
    specific traineddata files are missing. Returns empty string on failure.
    """
    # Build a prioritized list of language combinations
    # Start with requested lang blended with others, then degrade to single langs
    requested = lang or "nep"
    candidates = [
        f"{requested}+sin+eng",
        f"{requested}+eng",
        requested,
        "sin+eng",
        "sin",
        "eng",
    ]
    # Balanced OCR setup for multi-lingual text blocks
    # Try multiple configs and sources (path, PIL Image)
    configs = [
        "--oem 1 --psm 6 -c preserve_interword_spaces=1",
        "--oem 1 --psm 7 -c preserve_interword_spaces=1",
        "--oem 3 --psm 6 -c preserve_interword_spaces=1",
    ]
    for langs in candidates:
        for cfg in configs:
            try:
                txt = pytesseract.image_to_string(image_path, lang=langs, config=cfg)
                if txt and txt.strip():
                    return txt
            except Exception:
                pass
            try:
                from PIL import Image as _PILImage
                img = _PILImage.open(image_path)
                txt = pytesseract.image_to_string(img, lang=langs, config=cfg)
                if txt and txt.strip():
                    return txt
            except Exception:
                pass
    return ""


def _clean_ocr_text(text: str) -> str:
    """
    Normalize OCR text to reduce spurious symbols before translation.
    - Unicode normalize (NFKC)
    - Remove control chars (except newlines and tabs)
    - Replace common replacement chars
    - Collapse excessive whitespace
    """
    import unicodedata, re
    if not text:
        return ""
    norm = unicodedata.normalize("NFKC", text)
    # Remove control chars except \n and \t
    norm = "".join(ch for ch in norm if ch == "\n" or ch == "\t" or (ord(ch) >= 32 and ch != 0xFFFD))
    # Replace unknown boxes or stray artifacts
    norm = norm.replace("\uFFFD", "").replace("□", "").replace("�", "")
    # Collapse whitespace
    norm = re.sub(r"[\t ]+", " ", norm)
    norm = re.sub(r"\s*\n\s*", "\n", norm)
    return norm.strip()


def _filter_to_scripts(text: str, langs: str) -> str:
    """
    Remove characters outside expected scripts for the chosen languages.
    - For Nepali: keep Devanagari U+0900–U+097F plus punctuation and ascii spaces
    - For Sinhala: keep Sinhala U+0D80–U+0DFF
    """
    import re
    if not text:
        return ""
    keep_patterns = []
    if "nep" in (langs or ""):
        keep_patterns.append("\u0900-\u097F")
    if "sin" in (langs or ""):
        keep_patterns.append("\u0D80-\u0DFF")
    # Always allow ASCII basic punctuation and spaces
    keep_class = "".join(keep_patterns)
    if keep_class:
        regex = rf"[^\n\t\r\u200c\u200d\u0964\u0965\u2013\u2014\u2018\u2019\u201c\u201d\.,;:!\?\-\(\)\[\]{{}}\/'\"\s{keep_class}]"
        return re.sub(regex, "", text)
    return text

def translate_text(text, target="en"):
    """Translate using OpenAI API (prototype)"""
    return translate_text_to_english(text)

def _render_text_pages_with_pillow(text: str, page_width=1240, page_height=1754, margin=60, font_size=28):
    lines = []
    for raw_line in (text or "").split("\n"):
        lines.append(raw_line if raw_line else " ")

    font_candidates = [
        "/System/Library/Fonts/DevanagariMT.ttc",  
        "/System/Library/Fonts/Supplemental/NotoSansDevanagari.ttc",
        "/System/Library/Fonts/Supplemental/NotoSansSinhala.ttc",
        "/System/Library/Fonts/Supplemental/Sinhala Sangam MN.ttc",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    ]
    font = None
    for path in font_candidates:
        try:
            font = ImageFont.truetype(path, font_size)
            break
        except Exception:
            continue
    if font is None:
        font = ImageFont.load_default()

    images = []
    img = Image.new("RGB", (page_width, page_height), "white")
    draw = ImageDraw.Draw(img)
    x = margin
    y = margin
    line_spacing = int(font_size * 1.4)
    max_width = page_width - 2 * margin

    def flush_page(curr_img):
        nonlocal images
        images.append(curr_img)

    for line in lines:
        # naive wrap by words
        words = line.split(" ")
        current = ""
        for word in words:
            trial = (current + (" " if current else "") + word).strip()
            w, h = draw.textbbox((0, 0), trial, font=font)[2:]
            if w <= max_width:
                current = trial
            else:
                if y + line_spacing > page_height - margin:
                    flush_page(img)
                    img = Image.new("RGB", (page_width, page_height), "white")
                    draw = ImageDraw.Draw(img)
                    y = margin
                draw.text((x, y), current, fill=(0, 0, 0), font=font)
                y += line_spacing
                current = word
        if current != "":
            if y + line_spacing > page_height - margin:
                flush_page(img)
                img = Image.new("RGB", (page_width, page_height), "white")
                draw = ImageDraw.Draw(img)
                y = margin
            draw.text((x, y), current, fill=(0, 0, 0), font=font)
            y += line_spacing

    flush_page(img)
    return images


def text_to_pdf(text, output_path):
    try:
        pdf = FPDF()
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.set_font("Arial", size=12)
        for line in (text or "").split("\n"):
            pdf.multi_cell(0, 5, line)
        pdf.output(output_path)
    except UnicodeEncodeError:
        # Fallback: render text onto images with a unicode-capable font and save as PDF
        images = _render_text_pages_with_pillow(text)
        if images:
            images[0].save(output_path, save_all=True, append_images=images[1:], format="PDF")
        else:
            # Create a blank PDF page if no content
            blank = Image.new("RGB", (1240, 1754), "white")
            blank.save(output_path, format="PDF")

# ------------------------------
# Routes
# ------------------------------

@app.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "" or not allowed_file(file.filename):
        return jsonify({"error": "Invalid file"}), 400

    filename = secure_filename(file.filename)
    doc_id = str(uuid.uuid4())
    ext = filename.rsplit(".", 1)[1].lower()
    tmp_path = os.path.join(UPLOAD_DIR, f"{doc_id}.{ext}")
    file.save(tmp_path)

    # Supabase: insert initial document row (status=pending)
    if sb_available:
        try:
            insert_documents_row(document_id=doc_id, user_id=None, filename=filename, file_type=ext if ext in ["pdf","png","jpg","jpeg"] else "unknown", status="pending")
        except Exception as e:
            print("[supabase] insert_documents_row failed:", e)

    # OCR & Translation
    if ext in ["png", "jpg", "jpeg"]:
        # Image: attempt robust OCR; if empty, try with English fallback
        native_text = extract_text_from_image(tmp_path, lang="nep")  # Adjust lang dynamically
        if not native_text or not native_text.strip():
            native_text = extract_text_from_image(tmp_path, lang="nep+eng") or ""
    else:  # PDF
        try:
            images = convert_from_path(tmp_path)
        except Exception as e:
            return jsonify({
                "error": "Failed to process PDF. Ensure Poppler is installed (pdftoppm) and the PDF is valid.",
                "details": str(e)
            }), 500
        native_text = ""
        ocr_config = "--oem 1 --psm 6 -c preserve_interword_spaces=1"
        for img in images:
            try:
                # Reuse same fallback strategy by saving to a temp image if needed
                txt = pytesseract.image_to_string(img, lang="nep+sin+eng", config=ocr_config)
                native_text += _filter_to_scripts(txt, "nep+sin") + "\n"
            except pytesseract.TesseractError:
                try:
                    txt = pytesseract.image_to_string(img, lang="eng", config=ocr_config)
                    native_text += txt + "\n"
                except Exception:
                    continue

    # If OpenAI key missing, skip translation gracefully
    english_text = None
    try:
        if openai.api_key:
            cleaned = _clean_ocr_text(_filter_to_scripts(native_text, "nep+sin"))
            english_text = translate_text(cleaned)
    except Exception:
        english_text = None

    # Save PDFs
    native_pdf = os.path.join(DATA_DIR, f"{doc_id}_native.pdf")
    english_pdf = os.path.join(DATA_DIR, f"{doc_id}_english.pdf")
    text_to_pdf(native_text, native_pdf)
    # Write english PDF if we have any translation result; allow same-text for now to verify pipeline
    if english_text and english_text.strip():
        text_to_pdf(english_text, english_pdf)

    # Supabase: store texts and mark document completed
    if sb_available:
        try:
            insert_texts_row(document_id=doc_id, native_text=native_text or "", translated_text=english_text or "")
            update_document_status(document_id=doc_id, status="completed")
        except Exception as e:
            print("[supabase] texts/status upsert failed:", e)
            try:
                update_document_status(document_id=doc_id, status="failed")
            except Exception as e2:
                print("[supabase] status update failed:", e2)

    return jsonify({
        "documentId": doc_id,
        "filename": filename,
        "numPages": 1  # Simplified; could count pages from PDF
    })

@app.route("/file/<document_id>")
def get_file(document_id):
    lang = request.args.get("lang", "native")
    pdf_path = os.path.join(DATA_DIR, f"{document_id}_{lang}.pdf")
    if not os.path.exists(pdf_path):
        return jsonify({"error": "File not found"}), 404
    # Enable byte-range requests for PDF.js by using conditional responses
    return send_file(
        pdf_path,
        mimetype="application/pdf",
        as_attachment=False,
        conditional=True,
        etag=True
    )


@app.route("/metadata/<document_id>")
def get_metadata(document_id):
    """
    Return basic metadata for a document, including number of pages for the
    native PDF if available and which variants exist.
    """
    native_pdf = os.path.join(DATA_DIR, f"{document_id}_native.pdf")
    english_pdf = os.path.join(DATA_DIR, f"{document_id}_english.pdf")

    if not os.path.exists(native_pdf) and not os.path.exists(english_pdf):
        return jsonify({"error": "Document not found"}), 404

    num_pages = None
    try:
        target_pdf = native_pdf if os.path.exists(native_pdf) else english_pdf
        info = pdfinfo_from_path(target_pdf, userpw=None, poppler_path=None)
        # pdfinfo_from_path returns a dict; 'Pages' key is int
        num_pages = info.get("Pages")
    except Exception:
        # If pdfinfo is unavailable, leave num_pages as None
        pass

    return jsonify({
        "documentId": document_id,
        "numPages": num_pages,
        "variants": {
            "native": os.path.exists(native_pdf),
            "english": os.path.exists(english_pdf),
        }
    })

@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    document_id = data.get("documentId")
    message = data.get("message")
    mode = data.get("mode", "fast")

    # Fetch document text from Supabase if available, else fallback to native PDF text file (not implemented)
    source_texts = None
    if sb_available and document_id:
        try:
            source_texts = get_texts(document_id)
        except Exception:
            source_texts = None

    native_text = source_texts.get("native_text") if source_texts else ""
    translated_text = source_texts.get("translated_text") if source_texts else ""

    # Compose a simple bilingual response using translated text as primary context
    context = translated_text or native_text or ""
    if not context:
        return jsonify({"error": "No text found for this document"}), 404

    reply = f"Here is a brief answer based on the document (EN):\n\n{context[:500]}\n\nYour question: {message}"

    if sb_available:
        try:
            insert_chatlog(user_id=None, document_id=document_id, message=message or "", response=reply)
        except Exception as e:
            print("[supabase] chatlog insert failed:", e)

    return jsonify({"reply": reply})

# ------------------------------
# Main
# ------------------------------

if __name__ == "__main__":
    app.run(debug=True, port=5000)
