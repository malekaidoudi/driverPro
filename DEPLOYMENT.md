# Guide de Déploiement - DriverPro

Ce guide explique comment déployer DriverPro en production.

## Déploiement du Backend (Render)

### 1. Préparer le projet

Créez un fichier `render.yaml` à la racine du projet backend:

```yaml
services:
  - type: web
    name: driverpro-api
    env: python
    region: frankfurt
    plan: free
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_KEY
        sync: false
      - key: SUPABASE_SERVICE_KEY
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: GOOGLE_MAPS_API_KEY
        sync: false
      - key: DATABASE_URL
        sync: false
```

### 2. Déployer sur Render

1. Allez sur [render.com](https://render.com)
2. Créez un compte ou connectez-vous
3. Cliquez sur **New** > **Web Service**
4. Connectez votre dépôt GitHub/GitLab
5. Sélectionnez le dossier `backend`
6. Render détectera automatiquement Python
7. Configurez:
   - **Name**: driverpro-api
   - **Region**: Choisissez la plus proche
   - **Branch**: main
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
8. Ajoutez les variables d'environnement (voir Étape 3)
9. Cliquez sur **Create Web Service**

### 3. Configurer les variables d'environnement

Dans Render, allez dans **Environment** et ajoutez:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=votre_anon_key
SUPABASE_SERVICE_KEY=votre_service_role_key
JWT_SECRET=generé_automatiquement
GOOGLE_MAPS_API_KEY=votre_google_maps_api_key
DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres
```

### 4. Vérifier le déploiement

Une fois déployé, votre API sera accessible sur:
```
https://driverpro-api.onrender.com
```

Testez avec:
```
https://driverpro-api.onrender.com/health
```

## Déploiement du Frontend Mobile (EAS)

### 1. Installer EAS CLI

```bash
npm install -g eas-cli
```

### 2. Se connecter à Expo

```bash
eas login
```

### 3. Configurer EAS

```bash
cd mobile
eas build:configure
```

### 4. Mettre à jour les variables d'environnement

Éditez `mobile/.env` pour la production:

```env
EXPO_PUBLIC_API_URL=https://driverpro-api.onrender.com
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=votre_google_maps_api_key
```

### 5. Build pour iOS

```bash
eas build --platform ios
```

Vous aurez besoin:
- D'un compte Apple Developer (99$/an)
- De créer un App ID sur developer.apple.com
- De configurer les certificats et profils de provisioning

### 6. Build pour Android

```bash
eas build --platform android
```

Pour publier sur Google Play:
- Créez un compte Google Play Developer (25$ unique)
- Générez un keystore avec EAS
- Suivez les instructions de soumission

### 7. Déploiement OTA (Over-The-Air)

Pour les mises à jour rapides sans rebuild:

```bash
eas update --branch production --message "Nouvelle fonctionnalité"
```

## Alternative: Déploiement Web (Netlify/Vercel)

Si vous souhaitez une version web de l'application:

### Backend sur Vercel

1. Installez Vercel CLI: `npm i -g vercel`
2. Dans le dossier backend, créez `vercel.json`:

```json
{
  "builds": [
    {
      "src": "app/main.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "app/main.py"
    }
  ]
}
```

3. Déployez: `vercel --prod`

## Monitoring et Logs

### Backend (Render)

- Les logs sont accessibles dans le dashboard Render
- Configurez des alertes pour les erreurs
- Utilisez Sentry pour le monitoring d'erreurs

### Frontend (Expo)

- Utilisez Expo Application Services (EAS) pour les analytics
- Configurez Sentry React Native pour le crash reporting

## Sécurité en Production

### Backend

1. **CORS**: Limitez les origines autorisées dans `main.py`
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://votre-app.com"],  # Pas "*" en prod!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

2. **Rate Limiting**: Ajoutez slowapi pour limiter les requêtes
3. **HTTPS**: Render fournit automatiquement SSL

### Frontend

1. **Secrets**: Ne commitez JAMAIS les fichiers `.env`
2. **API Keys**: Utilisez des restrictions d'API sur Google Cloud
3. **Obfuscation**: Activez l'obfuscation dans `eas.json`

## Coûts Estimés

### Gratuit (Développement)
- Supabase: Plan gratuit (500 MB DB, 50k utilisateurs)
- Render: Plan gratuit (750h/mois)
- Google Maps: 200$/mois de crédit gratuit

### Production (~50$/mois)
- Supabase Pro: 25$/mois (8 GB DB, SSL)
- Render Standard: 7$/mois (512 MB RAM)
- Google Maps: Variable selon utilisation
- Apple Developer: 99$/an
- Google Play: 25$ (unique)

## Maintenance

### Mises à jour régulières

```bash
# Backend
pip install --upgrade -r requirements.txt

# Frontend
npm update
```

### Backups

Supabase fait des backups automatiques. Pour des backups manuels:

```bash
pg_dump $DATABASE_URL > backup.sql
```

## Support

Pour toute question:
- Documentation: Consultez README.md
- Issues: Ouvrez une issue sur GitHub
- Email: support@driverpro.com
