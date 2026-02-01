# Démarrage Rapide - DriverPro

Guide ultra-rapide pour lancer DriverPro en 10 minutes.

## Prérequis

- Node.js 18+
- Python 3.11+
- Un compte Supabase (gratuit)
- Une clé Google Maps API

## 1. Configuration Supabase (3 min)

1. Créez un projet sur [supabase.com](https://supabase.com)
2. Dans **SQL Editor**, exécutez le fichier `database/schema.sql`
3. Notez votre **Project URL** et **anon key** (Settings > API)

## 2. Backend (2 min)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Éditez `.env`:
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=votre_anon_key
SUPABASE_SERVICE_KEY=votre_service_role_key
JWT_SECRET=un_secret_aleatoire
GOOGLE_MAPS_API_KEY=votre_google_maps_key
DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres
```

Lancez:
```bash
uvicorn app.main:app --reload
```

✅ Backend prêt sur http://localhost:8000

## 3. Frontend Mobile (3 min)

```bash
cd mobile
npm install
cp .env.example .env
```

Éditez `.env`:
```env
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=votre_google_maps_key
```

Lancez:
```bash
npx expo start
```

✅ Scannez le QR code avec Expo Go!

## 4. Premier Test (2 min)

1. Dans l'app, cliquez sur **S'inscrire**
2. Créez un compte
3. Vérifiez votre email
4. Connectez-vous
5. Créez votre première tournée!

## Dépannage Express

**Backend ne démarre pas?**
```bash
pip install -r requirements.txt
```

**Frontend ne se connecte pas?**
- Sur téléphone: Changez `EXPO_PUBLIC_API_URL` en `http://VOTRE_IP:8000`
- Vérifiez que backend et mobile sont sur le même WiFi

**Erreurs TypeScript?**
```bash
cd mobile
rm -rf node_modules
npm install
npx expo start -c
```

## Prochaines Étapes

- Consultez `INSTALLATION.md` pour le guide complet
- Lisez `ARCHITECTURE.md` pour comprendre le fonctionnement
- Voir `DEPLOYMENT.md` pour déployer en production

## Support

- Documentation: `README.md`
- Issues: GitHub
- Email: support@driverpro.com

Bon développement! 🚀
