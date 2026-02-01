# Architecture Technique - DriverPro

## Vue d'ensemble

DriverPro est une application full-stack moderne pour l'optimisation de tournées de livraison, construite avec une architecture découplée backend/frontend.

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Mobile)                        │
│  React Native + Expo + NativeWind + TypeScript              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Screens    │  │   Contexts   │  │  Components  │     │
│  │  (UI Layer)  │  │ (State Mgmt) │  │  (Reusable)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │             │
│         └──────────────────┴──────────────────┘             │
│                           │                                 │
│                    ┌──────▼──────┐                         │
│                    │   Services   │                         │
│                    │ (API Client) │                         │
│                    └──────┬──────┘                         │
└────────────────────────────┼──────────────────────────────┘
                             │ HTTPS/REST
                             │
┌────────────────────────────▼──────────────────────────────┐
│                     BACKEND (API)                          │
│           FastAPI + Python + Pydantic                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Routers    │  │   Services   │  │    Models    │   │
│  │ (Endpoints)  │  │  (Business)  │  │ (Validation) │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│         │                  │                  │           │
│         └──────────────────┴──────────────────┘           │
│                           │                               │
└───────────────────────────┼───────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌──────▼──────┐  ┌────────▼────────┐
│   Supabase     │  │ Google Maps │  │  Google OR-Tools│
│  (PostgreSQL   │  │   Platform  │  │  (VRP Solver)   │
│  + Auth + RLS) │  │             │  │                 │
└────────────────┘  └─────────────┘  └─────────────────┘
```

## Stack Technique Détaillé

### Frontend Mobile

#### Core
- **React Native**: Framework cross-platform
- **Expo SDK 51**: Toolchain et services
- **TypeScript**: Typage statique
- **Expo Router**: Navigation basée sur le système de fichiers

#### Styling & UI
- **NativeWind v4**: Tailwind CSS pour React Native
- **@gorhom/bottom-sheet**: Bottom sheets natives performants
- **react-native-reanimated**: Animations 60fps
- **react-native-gesture-handler**: Gestion des gestes
- **phosphor-react-native**: Icônes modernes

#### State Management
- **React Context API**: État global (Auth, Theme)
- **useState/useEffect**: État local des composants

#### Services Externes
- **@supabase/supabase-js**: Client Supabase
- **axios**: Client HTTP
- **react-native-maps**: Affichage de cartes
- **expo-location**: Géolocalisation
- **expo-image-picker**: Sélection d'images (OCR)
- **expo-av**: Enregistrement audio (Speech-to-Text)
- **expo-haptics**: Retours haptiques

### Backend API

#### Core
- **FastAPI**: Framework web moderne et rapide
- **Python 3.11**: Langage
- **Uvicorn**: Serveur ASGI
- **Pydantic**: Validation de données

#### Base de Données
- **PostgreSQL**: Base de données relationnelle
- **Supabase**: BaaS (Backend as a Service)
- **asyncpg**: Driver PostgreSQL asynchrone

#### Authentification & Sécurité
- **Supabase Auth**: Gestion des utilisateurs
- **JWT**: Tokens d'authentification
- **Row Level Security (RLS)**: Sécurité au niveau des lignes

#### Services Métier
- **Google OR-Tools**: Résolution du VRP (Vehicle Routing Problem)
- **Google Maps API**: 
  - Distance Matrix: Calcul des distances/durées
  - Geocoding: Conversion adresse ↔ coordonnées
  - Places Autocomplete: Suggestions d'adresses
- **Pytesseract**: OCR pour scan d'adresses
- **Google Cloud Speech**: Speech-to-Text

## Architecture des Données

### Modèle de Données (PostgreSQL)

```sql
users (Supabase Auth)
  ├── id (uuid, PK)
  ├── email
  ├── full_name
  └── created_at

user_preferences
  ├── user_id (uuid, PK, FK → users)
  ├── theme (light|dark|system)
  ├── default_stop_duration_minutes
  ├── default_vehicle_type
  ├── avoid_tolls
  └── navigation_app

routes
  ├── id (uuid, PK)
  ├── user_id (uuid, FK → users)
  ├── name
  ├── route_date
  ├── status (draft|optimized|in_progress|completed)
  ├── total_distance_meters
  ├── total_duration_seconds
  ├── created_at
  └── updated_at

stops
  ├── id (uuid, PK)
  ├── route_id (uuid, FK → routes)
  ├── sequence_order (nullable avant optimisation)
  ├── address
  ├── latitude
  ├── longitude
  ├── notes
  ├── type (delivery|collection|break)
  ├── status (pending|completed|failed|skipped)
  ├── arrival_time
  ├── departure_time
  ├── estimated_duration_seconds
  ├── package_count
  ├── package_finder_id
  └── created_at
```

### Row Level Security (RLS)

Toutes les tables ont des politiques RLS:
- Un utilisateur ne peut voir que ses propres données
- Les stops sont accessibles via la relation `routes.user_id`

## Flux de Données Principaux

### 1. Authentification

```
Mobile App → Supabase Auth → JWT Token
     ↓
API Request (Authorization: Bearer <token>)
     ↓
Backend: Verify JWT → Extract user_id → Query DB
```

### 2. Création d'une Tournée

```
User Input (name, date)
     ↓
POST /routes
     ↓
Backend: Create route in DB
     ↓
Return route object
     ↓
Mobile: Display route
```

### 3. Ajout d'un Arrêt

```
User types address
     ↓
GET /services/geocode/autocomplete?input=...
     ↓
Google Places API → Suggestions
     ↓
User selects → GET /services/geocode/details?place_id=...
     ↓
Google Geocoding API → Coordinates
     ↓
POST /routes/{id}/stops (address, lat, lng)
     ↓
Backend: Save stop
```

### 4. Optimisation (Algorithme VRP)

```
User clicks "Optimize"
     ↓
POST /routes/{id}/optimize
     ↓
Backend:
  1. Fetch all stops
  2. Build locations array [(lat1, lng1), (lat2, lng2), ...]
  3. Call Google Distance Matrix API
     → Get distance/duration matrix
  4. Initialize OR-Tools VRP Solver
  5. Set constraints (time windows, capacity)
  6. Solve optimization problem
  7. Extract optimal route sequence
  8. Update stops.sequence_order in DB
  9. Calculate arrival_time for each stop
  10. Update route.status = 'optimized'
     ↓
Return optimized route with ordered stops
     ↓
Mobile: Display timeline
```

### 5. OCR (Scan d'Adresse)

```
User takes photo
     ↓
POST /services/ocr/scan-address (multipart/form-data)
     ↓
Backend:
  1. Receive image
  2. Pytesseract.image_to_string()
  3. Extract text
  4. Call Google Geocoding API
  5. Return structured address
     ↓
Mobile: Pre-fill address field
```

## Patterns et Bonnes Pratiques

### Backend

#### Separation of Concerns
```
Routers (routes.py)
  → Handle HTTP requests/responses
  → Validate input with Pydantic
  → Call services

Services (or_tools_service.py)
  → Business logic
  → External API calls
  → Complex calculations

Models (route.py)
  → Data validation
  → Type definitions
  → Serialization
```

#### Error Handling
```python
try:
    result = await some_operation()
except SpecificException as e:
    raise HTTPException(
        status_code=400,
        detail=f"Operation failed: {str(e)}"
    )
```

#### Async/Await
Toutes les opérations I/O sont asynchrones pour de meilleures performances.

### Frontend

#### Component Structure
```
screens/
  → Full-page components
  → Business logic
  → API calls

components/
  → Reusable UI components
  → Presentational
  → Props-driven

contexts/
  → Global state
  → Auth, Theme
  → Shared logic
```

#### Hooks Pattern
```typescript
const { user, loading } = useAuth();
const { colors, theme, setTheme } = useTheme();
```

#### Error Boundaries
Gestion gracieuse des erreurs avec fallback UI.

## Performance

### Backend
- **Async I/O**: Toutes les requêtes DB et API externes sont async
- **Connection Pooling**: PostgreSQL connection pool
- **Caching**: Potentiel pour Redis (future)

### Frontend
- **React Native Reanimated**: Animations sur le thread UI
- **Lazy Loading**: Chargement différé des écrans
- **Optimistic Updates**: UI réactive avant confirmation serveur
- **Image Optimization**: Expo Image avec cache

## Sécurité

### Backend
- **JWT Validation**: Chaque requête vérifie le token
- **RLS**: Isolation des données au niveau DB
- **CORS**: Origines autorisées configurables
- **Input Validation**: Pydantic pour toutes les entrées
- **SQL Injection**: Protection via ORM/parameterized queries

### Frontend
- **Secure Storage**: AsyncStorage pour tokens
- **HTTPS Only**: Toutes les communications chiffrées
- **No Hardcoded Secrets**: Variables d'environnement

## Scalabilité

### Horizontal Scaling
- Backend stateless → Facile à scaler
- Load balancer devant plusieurs instances

### Database
- PostgreSQL avec indexes optimisés
- Partitioning par user_id si nécessaire
- Read replicas pour les lectures

### Caching Strategy (Future)
```
Redis Cache
  ├── Geocoding results (address → coords)
  ├── Distance matrix (frequently used routes)
  └── User sessions
```

## Monitoring & Observabilité

### Logs
- Backend: Structured logging (JSON)
- Frontend: Expo logs + Sentry

### Metrics
- API response times
- Error rates
- User engagement

### Alerting
- Erreurs critiques → Email/Slack
- Performance degradation → Dashboard

## Tests (À Implémenter)

### Backend
```python
# Unit tests
pytest app/services/test_or_tools.py

# Integration tests
pytest app/api/test_routes.py

# E2E tests
pytest tests/e2e/
```

### Frontend
```typescript
// Unit tests
jest app/services/api.test.ts

// Component tests
@testing-library/react-native

// E2E tests
Detox or Maestro
```

## CI/CD Pipeline (Recommandé)

```yaml
GitHub Actions:
  1. Lint (black, flake8, eslint)
  2. Type check (mypy, tsc)
  3. Tests (pytest, jest)
  4. Build
  5. Deploy (Render, EAS)
```

## Évolutions Futures

### Court Terme
- [ ] Drag & drop pour réordonner les arrêts
- [ ] Export PDF de la tournée
- [ ] Notifications push
- [ ] Mode hors-ligne

### Moyen Terme
- [ ] Multi-véhicules (plusieurs livreurs)
- [ ] Zones de livraison
- [ ] Statistiques et analytics
- [ ] Intégration avec d'autres apps de navigation

### Long Terme
- [ ] Machine Learning pour prédire les durées
- [ ] Optimisation en temps réel (trafic)
- [ ] API publique pour intégrations tierces
- [ ] Version web (React)
