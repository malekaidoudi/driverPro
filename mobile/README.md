# DriverPro Mobile

Application mobile React Native pour la gestion et l'optimisation de tournées de livraison.

## Démarrage Rapide

```bash
# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Éditez .env avec vos vraies valeurs

# Lancer l'application
npx expo start
```

Scannez le QR code avec Expo Go ou appuyez sur:
- `i` pour iOS Simulator
- `a` pour Android Emulator
- `w` pour Web

## Structure du Projet

```
mobile/
├── app/
│   ├── _layout.tsx              # Layout racine
│   ├── index.tsx                # Écran d'accueil/redirection
│   ├── (auth)/
│   │   ├── _layout.tsx          # Layout authentification
│   │   ├── login.tsx            # Écran de connexion
│   │   └── signup.tsx           # Écran d'inscription
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Layout avec tabs
│   │   ├── home.tsx             # Liste des tournées
│   │   ├── routes.tsx           # Vue carte
│   │   └── settings.tsx         # Paramètres
│   ├── contexts/
│   │   ├── AuthContext.tsx      # Gestion de l'authentification
│   │   └── ThemeContext.tsx     # Gestion du thème
│   ├── services/
│   │   ├── api.ts               # Client API
│   │   └── supabase.ts          # Client Supabase
│   ├── types/
│   │   └── index.ts             # Types TypeScript
│   ├── components/              # Composants réutilisables
│   ├── hooks/                   # Hooks personnalisés
│   └── utils/                   # Utilitaires
├── assets/                      # Images, icônes, fonts
├── package.json
├── app.json                     # Configuration Expo
├── babel.config.js
├── tailwind.config.js           # Configuration NativeWind
├── tsconfig.json
└── README.md
```

## Fonctionnalités

### ✅ Implémenté

- Authentification (Supabase Auth)
- Thème clair/sombre
- Liste des tournées
- Création de tournées
- Ajout d'arrêts
- Optimisation de tournées
- Paramètres utilisateur

### 🚧 À Implémenter

- Écran de détails d'une tournée
- Bottom sheet pour ajouter un arrêt
- Intégration de la carte
- Autocomplete d'adresses
- OCR pour scanner des adresses
- Reconnaissance vocale
- Navigation vers apps GPS
- Mode hors-ligne
- Notifications push

## Technologies

- **React Native**: Framework mobile
- **Expo SDK 51**: Toolchain et services
- **TypeScript**: Typage statique
- **Expo Router**: Navigation file-based
- **NativeWind v4**: Tailwind CSS pour RN
- **Supabase**: Backend et authentification
- **Axios**: Client HTTP
- **React Native Reanimated**: Animations
- **@gorhom/bottom-sheet**: Bottom sheets
- **Phosphor Icons**: Icônes

## Thème et Design System

Le design system est défini dans `tailwind.config.js`:

### Couleurs Light Mode
- Primary: `#4A90E2` (Bleu)
- Secondary: `#50E3C2` (Turquoise)
- Accent: `#F5A623` (Orange)
- Background: `#F9F9F9`
- Surface: `#FFFFFF`

### Couleurs Dark Mode
- Primary: `#4A90E2`
- Secondary: `#50E3C2`
- Accent: `#F5A623`
- Background: `#121212`
- Surface: `#1E1E1E`

## Contextes

### AuthContext

Gère l'authentification utilisateur:

```typescript
const { user, loading, signIn, signUp, signOut } = useAuth();
```

### ThemeContext

Gère le thème de l'application:

```typescript
const { theme, activeTheme, colors, setTheme } = useTheme();
```

## Services

### API Client (`services/api.ts`)

```typescript
import { routesApi, stopsApi, servicesApi } from '@/services/api';

// Récupérer les tournées
const routes = await routesApi.getAll();

// Créer un arrêt
const stop = await stopsApi.create(routeId, stopData);

// Autocomplete d'adresse
const predictions = await servicesApi.autocomplete('123 rue');
```

### Supabase Client (`services/supabase.ts`)

```typescript
import { supabase } from '@/services/supabase';

// Connexion
await supabase.auth.signInWithPassword({ email, password });

// Inscription
await supabase.auth.signUp({ email, password });
```

## Scripts

```bash
# Développement
npm start              # Lancer Expo
npm run android        # Lancer sur Android
npm run ios            # Lancer sur iOS
npm run web            # Lancer sur Web

# Build
eas build --platform ios
eas build --platform android

# Déploiement OTA
eas update --branch production
```

## Configuration

### Variables d'Environnement

```env
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

### Google Maps

Dans `app.json`, configurez votre clé API:

```json
{
  "ios": {
    "config": {
      "googleMapsApiKey": "YOUR_KEY"
    }
  },
  "android": {
    "config": {
      "googleMaps": {
        "apiKey": "YOUR_KEY"
      }
    }
  }
}
```

## Développement

### Linter

```bash
npx eslint app/
```

### Type Checking

```bash
npx tsc --noEmit
```

### Formatage

```bash
npx prettier --write app/
```

## Déploiement

Voir `DEPLOYMENT.md` à la racine du projet pour les instructions complètes.

## Dépannage

### Erreurs TypeScript

Si vous voyez des erreurs TypeScript après installation:

```bash
rm -rf node_modules
npm install
npx expo start -c
```

### L'app ne se connecte pas au backend

**Sur simulateur**: Utilisez `http://localhost:8000`

**Sur téléphone physique**: 
1. Trouvez votre IP locale (ex: `192.168.1.10`)
2. Changez `EXPO_PUBLIC_API_URL` en `http://192.168.1.10:8000`
3. Assurez-vous d'être sur le même réseau WiFi

### Problèmes de cache

```bash
npx expo start -c
```

## Support

Pour toute question, consultez:
- Documentation principale: `README.md` à la racine
- Guide d'installation: `INSTALLATION.md`
- Architecture: `ARCHITECTURE.md`


## Demarer le projet

## Frontend
  # Acceder au dossier mobile
    cd /Volumes/Data/Works/Windsurf/DriverPro/mobile
  # Lancer le projet
    npx expo run:ios --device

## Backend
  # Acceder au dossier backend
    cd /Volumes/Data/Works/Windsurf/DriverPro/backend
  # Créer un environnement virtuel
    python -m venv venv
    source venv/bin/activate  # Windows: venv\Scripts\activate
  # Installer les dépendances
    pip install -r requirements.txt
  # Lancer le serveur
    uvicorn app.main:app --host 192.168.1.60 --port 8000 --reload

## Build iOS avec bundle embarqué (pas besoin de Metro)
    npx expo run:ios --device --configuration Release