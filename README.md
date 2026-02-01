# DriverPro - Application de Tournée Premium

Application complète de gestion et d'optimisation de tournées de livraison avec backend FastAPI et frontend React Native/Expo.

## 🏗️ Architecture

### Backend (Python/FastAPI)
- **Framework**: FastAPI
- **Base de données**: PostgreSQL (Supabase)
- **Authentification**: Supabase Auth (JWT)
- **Optimisation**: Google OR-Tools (VRP Solver)
- **APIs externes**: Google Maps Platform

### Frontend (React Native/Expo)
- **Framework**: React Native avec Expo SDK 51
- **Styling**: NativeWind v4 (Tailwind CSS pour React Native)
- **Navigation**: Expo Router
- **UI Components**: @gorhom/bottom-sheet, react-native-maps, phosphor-react-native
- **Thèmes**: Support complet Light/Dark mode

## 🚀 Installation

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Sur Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Configurer les variables d'environnement dans .env
uvicorn app.main:app --reload
```

### Frontend

```bash
cd mobile
npm install
npx expo start
```

### Base de données

1. Créer un projet sur [Supabase](https://supabase.com)
2. Exécuter le script SQL dans `database/schema.sql`
3. Copier les credentials dans le fichier `.env` du backend

## 📱 Fonctionnalités

- ✅ Création et gestion de tournées
- ✅ Ajout d'arrêts avec géolocalisation
- ✅ Optimisation automatique des itinéraires (VRP)
- ✅ Timeline interactive avec heures d'arrivée estimées
- ✅ Recherche d'adresses avec autocomplete
- ✅ Scan d'adresses par OCR (photo)
- ✅ Saisie vocale d'adresses
- ✅ Thème clair/sombre
- ✅ Gestion des colis et statuts
- ✅ Navigation vers applications GPS

## 🔑 Variables d'environnement

### Backend (.env)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
DATABASE_URL=postgresql://user:password@host:5432/database
```

### Frontend (.env)
```
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

## 📚 Documentation API

Une fois le backend lancé, accéder à la documentation interactive:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 🎨 Design System

Le design system est défini dans `mobile/tailwind.config.js` avec des palettes complètes pour les thèmes clair et sombre.

## 📄 Licence

Propriétaire - Tous droits réservés
