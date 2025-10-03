# Flask backend for Nepali/Sinhala OCR + translation prototype

## Overview

This Flask backend:

- Accepts file uploads (PDF / image).
- Runs OCR via Tesseract (Nepali & Sinhala traineddata recommended).
- Translates OCR text to English via OpenAI (prototype).
- Creates embeddings and stores them locally (`./data/vecstore.json`).
- Stores metadata into Supabase tables if `SUPABASE_URL` and `SUPABASE_KEY` are set.

## Prerequisites

### System packages

- **Tesseract** with Nepali & Sinhala traineddata:
  - Ubuntu/Debian:
    ```bash
    sudo apt update
    sudo apt install -y tesseract-ocr poppler-utils
    # for language packs — either via apt or manually download nep.traineddata and sin.traineddata
    ```
  - macOS (Homebrew):
    ```bash
    brew install tesseract poppler
    # copy traineddata files into /usr/local/share/tessdata if needed
    ```
- **Poppler** (pdf2image uses pdftoppm) — installed above.

### Python env

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
