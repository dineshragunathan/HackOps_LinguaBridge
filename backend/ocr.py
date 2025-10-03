# ocr.py - helpers to OCR images and PDFs using tesseract & pdf2image
import os
import tempfile
from pdf2image import convert_from_path
import pytesseract
from PIL import Image

# Ensure TESSDATA_PREFIX or tesseract is installed on PATH
# For Nepali/Sinhala ensure nep.traineddata and sin.traineddata are in tessdata

def ocr_image_bytes(image_bytes, langs="nep+sin+eng"):
    """
    image_bytes: raw bytes (PNG/JPEG)
    langs: tesseract languages string (e.g. 'nep' or 'sin' or 'nep+sin')
    returns: extracted text
    """
    img = Image.open(tempfile.SpooledTemporaryFile().write(image_bytes) or image_bytes)  # not used directly
    # Simpler: load using PIL from bytes
    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    try:
        tmp.write(image_bytes)
        tmp.flush()
        text = pytesseract.image_to_string(Image.open(tmp.name), lang=langs)
        return text
    finally:
        tmp.close()
        try:
            os.unlink(tmp.name)
        except Exception:
            pass

def ocr_image_pil(image: Image.Image, langs="nep+sin+eng"):
    return pytesseract.image_to_string(image, lang=langs)

def ocr_pdf(path_to_pdf, langs="nep+sin+eng", dpi=300, first_n_pages=None):
    """
    Convert PDF pages to images and OCR each page.
    Returns concatenated text.
    Requires poppler (pdftoppm) for pdf2image.
    """
    pages = convert_from_path(path_to_pdf, dpi=dpi)
    if first_n_pages:
        pages = pages[:first_n_pages]
    all_text = []
    for page in pages:
        txt = pytesseract.image_to_string(page, lang=langs)
        all_text.append(txt)
    return "\n\n".join(all_text)
s