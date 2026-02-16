#!/usr/bin/env bash
# Build script for Render deployment
# This script installs dependencies and downloads spaCy models

set -e

echo "📦 Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "🧠 Downloading spaCy French model..."
python -m spacy download fr_core_news_lg

echo "✅ Build completed successfully!"
