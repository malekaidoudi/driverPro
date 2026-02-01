# Guide d'Installation - DriverPro

Ce guide vous accompagne pas à pas dans l'installation et la configuration de l'application DriverPro.

## Prérequis

### Général
- Node.js 18+ et npm
- Python 3.11+
- Git
- Un compte [Supabase](https://supabase.com) (gratuit)
- Une clé API [Google Maps Platform](https://console.cloud.google.com/)

### Pour le développement mobile
- **iOS**: macOS avec Xcode installé
- **Android**: Android Studio avec SDK Android
- **Alternative**: Application Expo Go sur votre téléphone

## Étape 1: Configuration de Supabase

### 1.1 Créer un projet Supabase

1. Allez sur [supabase.com](https://supabase.com)
2. Créez un compte ou connectez-vous
3. Cliquez sur "New Project"
4. Remplissez les informations:
   - **Name**: DriverPro
   - **Database Password**: Choisissez un mot de passe fort
   - **Region**: Choisissez la région la plus proche
5. Attendez que le projet soit créé (~2 minutes)

### 1.2 Exécuter le schéma SQL

1. Dans votre projet Supabase, allez dans **SQL Editor** (menu de gauche)
2. Cliquez sur **New Query**
3. Copiez tout le contenu du fichier `database/schema.sql`
4. Collez-le dans l'éditeur SQL
5. Cliquez sur **Run** (ou Ctrl+Enter)
6. Vérifiez qu'il n'y a pas d'erreurs

### 1.3 Récupérer les clés API

1. Allez dans **Settings** > **API**
2. Notez les informations suivantes:
   - **Project URL** (ex: https://xxxxx.supabase.co)
   - **anon/public key** (clé publique)
   - **service_role key** (clé secrète - à garder confidentielle!)

## Étape 2: Configuration de Google Maps Platform

### 2.1 Créer un projet Google Cloud

1. Allez sur [console.cloud.google.com](https://console.cloud.google.com/)
2. Créez un nouveau projet ou sélectionnez-en un existant
3. Activez la facturation (nécessaire même pour l'essai gratuit)

### 2.2 Activer les APIs nécessaires

Dans la console Google Cloud, activez les APIs suivantes:
- **Maps JavaScript API**
- **Places API**
- **Geocoding API**
- **Distance Matrix API**
- **Directions API**

### 2.3 Créer une clé API

1. Allez dans **APIs & Services** > **Credentials**
2. Cliquez sur **Create Credentials** > **API Key**
3. Notez la clé générée
4. (Recommandé) Cliquez sur **Restrict Key** et limitez l'utilisation aux APIs activées

## Étape 3: Installation du Backend

### 3.1 Cloner le projet et installer les dépendances

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Sur Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3.2 Configurer les variables d'environnement

```bash
cp .env.example .env
```

Éditez le fichier `.env` avec vos vraies valeurs:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=votre_anon_key
SUPABASE_SERVICE_KEY=votre_service_role_key
JWT_SECRET=votre_jwt_secret_aleatoire
GOOGLE_MAPS_API_KEY=votre_google_maps_api_key
DATABASE_URL=postgresql://postgres:votre_password@db.xxxxx.supabase.co:5432/postgres
```

**Note**: Pour `DATABASE_URL`, remplacez:
- `votre_password` par le mot de passe de votre base Supabase
- `xxxxx` par votre référence de projet Supabase

### 3.3 Tester le backend

```bash
uvicorn app.main:app --reload
```

Ouvrez votre navigateur sur http://localhost:8000/docs pour voir la documentation interactive de l'API.

## Étape 4: Installation du Frontend Mobile

### 4.1 Installer les dépendances

```bash
cd mobile
npm install
```

### 4.2 Configurer les variables d'environnement

```bash
cp .env.example .env
```

Éditez le fichier `.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=votre_google_maps_api_key
```

### 4.3 Configurer Google Maps dans app.json

Éditez `mobile/app.json` et remplacez `YOUR_GOOGLE_MAPS_API_KEY` par votre vraie clé API dans les sections iOS et Android.

### 4.4 Lancer l'application

```bash
npx expo start
```

Vous verrez un QR code. Vous pouvez:
- Scanner le QR code avec l'app **Expo Go** (iOS/Android)
- Appuyer sur `i` pour ouvrir sur simulateur iOS (macOS uniquement)
- Appuyer sur `a` pour ouvrir sur émulateur Android

## Étape 5: Créer votre premier compte

1. Lancez l'application mobile
2. Cliquez sur "S'inscrire"
3. Remplissez le formulaire
4. Vérifiez votre email (Supabase envoie un email de confirmation)
5. Connectez-vous avec vos identifiants

## Dépannage

### Le backend ne démarre pas

**Erreur: Module not found**
```bash
pip install -r requirements.txt
```

**Erreur: Connection refused (Supabase)**
- Vérifiez que `SUPABASE_URL` et `SUPABASE_KEY` sont corrects
- Vérifiez que votre projet Supabase est actif

### L'application mobile ne se connecte pas au backend

**Sur simulateur iOS/Android**:
- Changez `EXPO_PUBLIC_API_URL` en `http://localhost:8000`

**Sur téléphone physique**:
- Trouvez l'IP locale de votre ordinateur (ex: 192.168.1.10)
- Changez `EXPO_PUBLIC_API_URL` en `http://192.168.1.10:8000`
- Assurez-vous que votre téléphone et ordinateur sont sur le même réseau WiFi

### Erreurs TypeScript dans le frontend

Les erreurs TypeScript sont normales avant l'installation des dépendances. Après `npm install`, elles devraient disparaître. Si elles persistent:

```bash
rm -rf node_modules
npm install
npx expo start -c
```

## Prochaines étapes

Une fois l'installation terminée:
1. Créez votre première tournée
2. Ajoutez des arrêts
3. Testez l'optimisation
4. Explorez les paramètres et le thème sombre

Pour le déploiement en production, consultez `DEPLOYMENT.md`.
