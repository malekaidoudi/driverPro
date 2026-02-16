#!/bin/bash
# Script d'installation des modèles spaCy pour DriverPro
# Usage: ./scripts/install_spacy_models.sh [--bert]

set -e

echo "🔧 Installation des modèles spaCy pour DriverPro"
echo "================================================"

# Vérifier que spaCy est installé
if ! python -c "import spacy" 2>/dev/null; then
    echo "❌ spaCy n'est pas installé. Installation..."
    pip install spacy spacy-transformers torch
fi

# Installer le modèle standard (plus léger, ~500MB)
echo ""
echo "📦 Installation du modèle standard fr_core_news_lg..."
python -m spacy download fr_core_news_lg

# Installer le modèle BERT si demandé
if [ "$1" == "--bert" ] || [ "$1" == "-b" ]; then
    echo ""
    echo "🤖 Installation du modèle BERT fr_dep_news_trf (CamemBERT)..."
    echo "⚠️  Ce modèle est plus lourd (~1.5GB) mais plus précis"
    python -m spacy download fr_dep_news_trf
    echo ""
    echo "✅ Modèle BERT installé avec succès!"
else
    echo ""
    echo "ℹ️  Pour installer le modèle BERT (plus précis), exécutez:"
    echo "   ./scripts/install_spacy_models.sh --bert"
fi

echo ""
echo "✅ Installation terminée!"
echo ""
echo "Modèles disponibles:"
python -c "import spacy; print('  - fr_core_news_lg:', 'OK' if spacy.util.is_package('fr_core_news_lg') else 'Non installé')"
python -c "import spacy; print('  - fr_dep_news_trf:', 'OK' if spacy.util.is_package('fr_dep_news_trf') else 'Non installé')"
