#!/usr/bin/env bash
# Build script for Render deployment
# Installs dependencies + downloads CamemBERT-NER model

set -e

echo "📦 Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "🧠 Pre-downloading CamemBERT-NER model (~400MB)..."
python -c "from transformers import AutoTokenizer, AutoModelForTokenClassification; AutoTokenizer.from_pretrained('Jean-Baptiste/camembert-ner'); AutoModelForTokenClassification.from_pretrained('Jean-Baptiste/camembert-ner'); print('✅ CamemBERT-NER downloaded')"

echo "📦 Installing spaCy French model (fallback)..."
python -m spacy download fr_core_news_lg || echo "⚠️ spaCy model download failed (optional)"

echo "✅ Build completed successfully!"
