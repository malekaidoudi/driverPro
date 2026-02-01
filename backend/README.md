# DriverPro Backend API

API RESTful pour l'application DriverPro, construite avec FastAPI.

## Démarrage Rapide

```bash
# Créer un environnement virtuel
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Installer les dépendances
pip install -r requirements.txt

# Configurer les variables d'environnement
cp .env.example .env
# Éditez .env avec vos vraies valeurs

# Lancer le serveur
uvicorn app.main:app --reload
```

L'API sera accessible sur http://localhost:8000

Documentation interactive: http://localhost:8000/docs

## Structure du Projet

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # Point d'entrée FastAPI
│   ├── core/
│   │   ├── config.py          # Configuration et settings
│   │   └── security.py        # Authentification JWT
│   ├── api/
│   │   ├── routes.py          # Endpoints pour les tournées
│   │   ├── stops.py           # Endpoints pour les arrêts
│   │   ├── optimization.py    # Endpoint d'optimisation
│   │   └── services.py        # Services externes (Maps, OCR, Speech)
│   ├── services/
│   │   ├── or_tools_service.py    # Solver VRP
│   │   └── google_maps_service.py # Client Google Maps
│   └── models/
│       ├── route.py           # Modèles Pydantic pour routes
│       └── stop.py            # Modèles Pydantic pour stops
├── requirements.txt
├── .env.example
└── README.md
```

## Endpoints Principaux

### Routes

- `GET /routes` - Liste toutes les tournées (groupées par date)
- `POST /routes` - Créer une nouvelle tournée
- `GET /routes/{route_id}` - Détails d'une tournée
- `PUT /routes/{route_id}` - Mettre à jour une tournée
- `DELETE /routes/{route_id}` - Supprimer une tournée

### Stops

- `POST /routes/{route_id}/stops` - Ajouter un arrêt
- `POST /routes/{route_id}/stops/batch` - Ajouter plusieurs arrêts
- `PUT /routes/{route_id}/stops/{stop_id}` - Modifier un arrêt
- `DELETE /routes/{route_id}/stops/{stop_id}` - Supprimer un arrêt

### Optimization

- `POST /routes/{route_id}/optimize` - Optimiser une tournée

### Services

- `GET /services/geocode/autocomplete` - Autocomplete d'adresses
- `GET /services/geocode/details` - Détails d'un lieu
- `POST /services/ocr/scan-address` - Scanner une adresse (OCR)
- `POST /services/speech/recognize` - Reconnaissance vocale

## Authentification

Toutes les requêtes (sauf health check) nécessitent un token JWT dans le header:

```
Authorization: Bearer <token>
```

Le token est obtenu via Supabase Auth côté client.

## Variables d'Environnement

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
DATABASE_URL=postgresql://user:password@host:5432/database
```

## Développement

### Linter et Formatage

```bash
# Black (formatage)
black app/

# Flake8 (linting)
flake8 app/

# MyPy (type checking)
mypy app/
```

### Tests

```bash
pytest
```

## Déploiement

Voir `DEPLOYMENT.md` à la racine du projet.

## Dépendances Principales

- **FastAPI**: Framework web
- **Uvicorn**: Serveur ASGI
- **Pydantic**: Validation de données
- **Supabase**: Client pour base de données et auth
- **Google OR-Tools**: Solver d'optimisation
- **Google Maps**: APIs de géolocalisation
- **Pytesseract**: OCR
- **Google Cloud Speech**: Speech-to-Text

## Support

Pour toute question, consultez la documentation principale ou ouvrez une issue.
