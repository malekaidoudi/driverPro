# Problème de Compatibilité Expo SDK - DriverPro

## 📋 Contexte

Je développe une application React Native avec Expo appelée **DriverPro** (application de gestion de tournées de livraison).

## 🔴 Problème Principal

**Erreur Babel persistante** lors du lancement de l'application :

```
iOS Bundling failed 758ms node_modules/expo-router/entry.js (1 module)
error: node_modules/expo-router/entry.js: [BABEL] /Volumes/Data/Works/Windsurf/DriverPro/mobile/node_modules/expo-router/entry.js: .plugins is not a valid Plugin property
```

## 🎯 Situation Actuelle

### Version du Projet
- **Expo SDK**: 51.0.0
- **React**: 18.2.0
- **React Native**: 0.74.0
- **Expo Router**: ~3.5.0

### Version d'Expo Go sur Téléphone
- **Expo Go**: SDK 54.0.0 (dernière version disponible sur App Store/Play Store)

### Environnement de Développement
- **OS**: macOS
- **Node**: Version récente
- **Python**: 3.14.2 (pour le backend)

## 🚨 Conflit de Versions

### Le Dilemme

1. **Si je reste sur SDK 51** :
   - ✅ Le projet a été initialement créé avec SDK 51
   - ✅ Les dépendances sont théoriquement compatibles
   - ❌ **Expo Go sur téléphone physique** est en SDK 54 → Incompatibilité
   - ❌ Erreur Babel `.plugins is not a valid Plugin property`
   - ✅ Peut fonctionner sur simulateur iOS (qui peut installer Expo Go SDK 51)

2. **Si je migre vers SDK 54** :
   - ✅ Compatible avec Expo Go sur téléphone physique
   - ❌ **Conflits de dépendances massifs** lors de `npm install`
   - ❌ Erreurs avec `react-native-reanimated` et `react-native-worklets`
   - ❌ Erreur : `Cannot find module 'react-native-worklets/plugin'`

## 📦 Dépendances Problématiques

### Packages Installés

```json
{
  "dependencies": {
    "expo": "~51.0.0",
    "expo-router": "~3.5.0",
    "react": "18.2.0",
    "react-native": "0.74.0",
    "react-native-reanimated": "~3.10.0",
    "react-native-gesture-handler": "~2.16.0",
    "@gorhom/bottom-sheet": "^4.6.0",
    "react-native-maps": "1.14.0",
    "nativewind": "^4.0.1",
    "@supabase/supabase-js": "^2.39.0",
    "axios": "^1.6.5",
    "phosphor-react-native": "^1.1.2",
    "expo-haptics": "~13.0.0",
    "expo-image-picker": "~15.0.0",
    "expo-av": "~14.0.0",
    "expo-location": "~17.0.0",
    "expo-linking": "~6.3.0",
    "expo-constants": "~16.0.0",
    "expo-status-bar": "~1.12.0",
    "@react-native-async-storage/async-storage": "1.23.0",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "@babel/core": "^7.20.0",
    "@types/react": "~18.2.45",
    "typescript": "^5.1.3",
    "tailwindcss": "^3.3.2"
  }
}
```

### Configuration Babel Actuelle

```javascript
// babel.config.js
module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            'nativewind/babel',
            'react-native-reanimated/plugin',
        ],
    };
};
```

## 🔧 Tentatives de Résolution

### Ce qui a été essayé (sans succès)

1. ✗ **Installation de `babel-preset-expo@~11.0.0`** (version SDK 51)
   - Erreur Babel persiste

2. ✗ **Installation de `babel-preset-expo@54.0.10`** (version SDK 54)
   - Erreur Babel persiste

3. ✗ **Désactivation du plugin `react-native-reanimated`**
   - Erreur Babel persiste

4. ✗ **Nettoyage complet du cache**
   ```bash
   rm -rf node_modules package-lock.json .expo node_modules/.cache
   npm install
   ```
   - Erreur Babel persiste

5. ✗ **Migration vers SDK 54**
   ```bash
   npm install expo@~54.0.0 --legacy-peer-deps
   ```
   - Conflits de peer dependencies
   - Erreur : `Cannot find module 'react-native-worklets/plugin'`

6. ✗ **Installation de `react-native-worklets-core`**
   - N'a pas résolu le problème

7. ✗ **Installation de `@react-native/babel-preset`**
   - Erreur Babel persiste

## 📊 Messages d'Erreur Détaillés

### Erreur Babel (SDK 51)

```
iOS Bundling failed 758ms node_modules/expo-router/entry.js (1 module)
error: node_modules/expo-router/entry.js: [BABEL] /Volumes/Data/Works/Windsurf/DriverPro/mobile/node_modules/expo-router/entry.js: .plugins is not a valid Plugin property
```

### Erreur lors de la migration vers SDK 54

```
npm error Could not resolve dependency:
npm error peer react@"^19.2.4" from react-dom@19.2.4
npm error node_modules/react-dom
npm error   peerOptional react-dom@"*" from expo-router@6.0.22

npm error Conflicting peer dependency: react@19.2.4
npm error node_modules/react
npm error   peer react@"^19.2.4" from react-dom@19.2.4
```

### Erreur avec react-native-reanimated (SDK 54)

```
ERROR  Error: [BABEL]: Cannot find module 'react-native-worklets/plugin'
Require stack:
- /Volumes/Data/Works/Windsurf/DriverPro/mobile/node_modules/react-native-reanimated/plugin/index.js
```

## 🎯 Questions

1. **Quelle est la meilleure approche** :
   - Rester sur SDK 51 et résoudre l'erreur Babel ?
   - Migrer vers SDK 54 et gérer les conflits de dépendances ?

2. **Comment résoudre l'erreur Babel** `.plugins is not a valid Plugin property` ?

3. **Y a-t-il une configuration Babel/Metro spécifique** pour Expo Router + NativeWind + Reanimated ?

4. **Faut-il utiliser `--legacy-peer-deps`** lors de la migration vers SDK 54 ?

5. **Comment gérer la compatibilité** entre :
   - `react-native-reanimated@~4.1.1` (SDK 54)
   - `@gorhom/bottom-sheet@^4.6.0`
   - `nativewind@^4.0.1`
   - `expo-router@~6.0.22` (SDK 54)

## 💡 Solution Temporaire Actuelle

Utiliser le **simulateur iOS** qui peut installer Expo Go SDK 51 :
```bash
npx expo start
# Puis appuyer sur 'i' pour ouvrir le simulateur iOS
```

Mais cela ne résout pas le problème pour le développement sur téléphone physique.

## 🔍 Informations Complémentaires

### Structure du Projet

```
DriverPro/
├── backend/          # FastAPI + Python
│   └── (fonctionne correctement)
├── mobile/           # React Native + Expo
│   ├── app/
│   │   ├── (auth)/
│   │   ├── (tabs)/
│   │   ├── contexts/
│   │   ├── services/
│   │   └── types/
│   ├── babel.config.js
│   ├── package.json
│   └── tailwind.config.js
└── database/         # PostgreSQL/Supabase
```

### Warnings Expo

```
The following packages should be updated for best compatibility with the installed expo version:
  @react-native-async-storage/async-storage@1.23.0 - expected version: 1.23.1
  expo-image-picker@15.0.7 - expected version: ~15.1.0
  react-native@0.74.0 - expected version: 0.74.5
  react-native-safe-area-context@4.10.0 - expected version: 4.10.5
  typescript@5.9.3 - expected version: ~5.3.3
```

## 🆘 Aide Recherchée

Besoin d'une solution pour :
1. Soit **résoudre l'erreur Babel sur SDK 51**
2. Soit **migrer proprement vers SDK 54** sans conflits de dépendances

Merci d'avance pour votre aide ! 🙏
