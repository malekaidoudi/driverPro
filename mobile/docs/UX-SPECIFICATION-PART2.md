# DriverPro — Spécification UX Part 2

---

# PHASE 5 — OUTILS RAPIDES

## 5.1 Menu Actions (Bottom Sheet)

**Rôle**: Actions contextuelles pendant tournée.

```
┌─────────────────────────┐
│         ━━━             │
│                         │
│ ┌─────────────────────┐ │
│ │ ➕ Ajouter stop     │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ ⏸️ Pause tournée    │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ 📋 Voir liste       │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ 🔄 Ré-optimiser     │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ 🏁 Terminer         │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

---

## 5.2 Pause Tournée

**Rôle**: Pause avec timer (repas, urgence).

```
┌─────────────────────────┐
│                         │
│         ⏸️              │
│   Tournée en pause      │
│                         │
│      ┌────────┐         │
│      │ 15:23  │         │
│      └────────┘         │
│                         │
│ ┌─────────────────────┐ │
│ │   ▶ REPRENDRE       │ │
│ └─────────────────────┘ │
│                         │
│ 12/18 stops restants    │
│ ETA: ~11:30             │
└─────────────────────────┘
```

---

# PHASE 6 — CLÔTURE

## 6.1 Résumé Tournée

**Rôle**: Bilan complet, stats, détails échecs.

```
┌─────────────────────────┐
│ ← Tournée terminée      │
├─────────────────────────┤
│         🎉              │
│   Lyon Centre           │
│   4 février 2026        │
├─────────────────────────┤
│ ┌────────┐ ┌────────┐   │
│ │   16   │ │   2    │   │
│ │ Livrés │ │ Échecs │   │
│ │   ✓    │ │   ✗    │   │
│ └────────┘ └────────┘   │
│                         │
│ ┌────────┐ ┌────────┐   │
│ │  47km  │ │ 2h34   │   │
│ │Distance│ │ Durée  │   │
│ └────────┘ └────────┘   │
├─────────────────────────┤
│ Échecs:                 │
│ • #5 Absent             │
│ • #12 Accès impossible  │
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │  📤 PARTAGER        │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │  🏠 ACCUEIL         │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

**Composants**: SuccessIcon, RouteSummary, StatsGrid 2x2, FailuresList, ShareButton, HomeButton

---

# PHASE 7 — HISTORIQUE & STATS

## 7.1 Liste Tournées

**Rôle**: Historique toutes tournées.

```
┌─────────────────────────┐
│ ← Historique            │
├─────────────────────────┤
│ [Semaine ▼] [Toutes ▼]  │
├─────────────────────────┤
│ ── Aujourd'hui ──       │
│ ┌─────────────────────┐ │
│ │ Lyon Centre    ✓    │ │
│ │ 16/18 • 47km • 2h34 │ │
│ └─────────────────────┘ │
│                         │
│ ── Hier ──              │
│ ┌─────────────────────┐ │
│ │ Lyon Sud       ✓    │ │
│ │ 22/22 • 38km • 3h12 │ │
│ └─────────────────────┘ │
│                         │
│ ── 2 février ──         │
│ ┌─────────────────────┐ │
│ │ Lyon Nord      ✓    │ │
│ │ 19/20 • 52km • 2h58 │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

**Filtres**: Période (Jour/Semaine/Mois/Tout) | Statut (Toutes/Terminées/Brouillons)

---

## 7.2 Statistiques

**Rôle**: Performance globale, motivation.

```
┌─────────────────────────┐
│ ← Statistiques          │
├─────────────────────────┤
│ [Semaine ▼]             │
├─────────────────────────┤
│                         │
│  ┌─────────────────┐    │
│  │      127        │    │
│  │    Livrés       │    │
│  │   cette sem.    │    │
│  └─────────────────┘    │
│                         │
│ ┌────────┐ ┌────────┐   │
│ │  187   │ │  14h   │   │
│ │   km   │ │ conduite│  │
│ └────────┘ └────────┘   │
│                         │
│ ┌────────┐ ┌────────┐   │
│ │  96%   │ │  8.2   │   │
│ │ succès │ │liv/heure│  │
│ └────────┘ └────────┘   │
│                         │
├─────────────────────────┤
│ 📈 Progression          │
│ [GRAPHIQUE SEMAINE]     │
│ L  M  M  J  V  S  D     │
│ ▂  ▄  ▆  █  ▃           │
├─────────────────────────┤
│ 🏆 Meilleure journée    │
│ Jeudi: 32 livraisons    │
└─────────────────────────┘
```

**Métriques clés**: Livraisons | Distance | Durée | Taux succès | Liv/heure
**Graphique**: Barre par jour, semaine glissante

---

# PHASE 8 — PARAMÈTRES

## 8.1 Écran Paramètres

```
┌─────────────────────────┐
│ ← Paramètres            │
├─────────────────────────┤
│                         │
│ 👤 PROFIL               │
│ ┌─────────────────────┐ │
│ │ Jean Dupont       > │ │
│ │ 🚗 Voiture          │ │
│ └─────────────────────┘ │
│                         │
│ ⚙️ PRÉFÉRENCES          │
│ ┌─────────────────────┐ │
│ │ Thème        Auto > │ │
│ │ Navigation       >  │ │
│ │  └ App: Waze        │ │
│ │  └ Demander: OFF    │ │
│ │ Notifications    🔔 │ │
│ │ Son scan      [ON]  │ │
│ │ Vibration     [ON]  │ │
│ └─────────────────────┘ │
│                         │
│ 🛣️ OPTIMISATION         │
│ ┌─────────────────────┐ │
│ │ Éviter péages [OFF] │ │
│ │ Éviter autoroutes   │ │
│ │              [OFF]  │ │
│ └─────────────────────┘ │
│                         │
│ ℹ️ À PROPOS             │
│ ┌─────────────────────┐ │
│ │ Version 1.0.0     > │ │
│ │ Aide            >   │ │
│ │ CGU             >   │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │ 🚪 Déconnexion      │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

**Sections**: Profil | Préférences | Optimisation | À propos | Déconnexion (rouge)

---

# DESIGN SYSTEM

## Palette Couleurs

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#FF6B00` | CTA, accents, brand |
| `primary-dark` | `#E55A00` | Pressed states |
| `secondary` | `#22C55E` | Succès, livré |
| `danger` | `#EF4444` | Erreur, échec |
| `warning` | `#F59E0B` | Attention, priorité haute |
| `surface` | `#FFFFFF` | Cards, sheets |
| `surface-dark` | `#1A1A1A` | Dark mode surfaces |
| `background` | `#F5F5F5` | App background |
| `background-dark` | `#0D0D0D` | Dark mode bg |
| `text-primary` | `#1A1A1A` | Titres, texte principal |
| `text-secondary` | `#6B7280` | Labels, hints |
| `border` | `#E5E5E5` | Bordures, dividers |

---

## Typographie

| Style | Font | Size | Weight | Line Height |
|-------|------|------|--------|-------------|
| `h1` | Inter | 32px | 700 | 40px |
| `h2` | Inter | 24px | 700 | 32px |
| `h3` | Inter | 20px | 600 | 28px |
| `body` | Inter | 16px | 400 | 24px |
| `body-bold` | Inter | 16px | 600 | 24px |
| `caption` | Inter | 14px | 400 | 20px |
| `small` | Inter | 12px | 400 | 16px |
| `button` | Inter | 16px | 700 | 24px |

---

## Spacing / Grille

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Micro espacements |
| `sm` | 8px | Entre éléments liés |
| `md` | 16px | Padding cards |
| `lg` | 24px | Sections |
| `xl` | 32px | Marges écran |
| `2xl` | 48px | Grands espacements |

**Padding écran**: 24px horizontal
**Card padding**: 16px
**Button padding**: 16px vertical, 24px horizontal

---

## Composants Réutilisables

### Buttons

| Variant | Height | Radius | Usage |
|---------|--------|--------|-------|
| `primary` | 56px | 12px | CTA principal |
| `secondary` | 48px | 12px | Actions secondaires |
| `ghost` | 44px | 8px | Actions tertiaires |
| `icon` | 44px | 22px | Boutons icône |

### Cards

```
┌─────────────────────┐
│  Padding: 16px      │
│  Radius: 16px       │
│  Shadow: 0 2 8 #0001│
│  Border: none       │
└─────────────────────┘
```

### Inputs

```
┌─────────────────────┐
│  Height: 52px       │
│  Padding: 16px      │
│  Radius: 12px       │
│  Border: 1px #E5E5E5│
│  Focus: 2px #FF6B00 │
└─────────────────────┘
```

### Bottom Sheet

```
┌─────────────────────┐
│  Radius top: 24px   │
│  Handle: 40x4px     │
│  Snap points:       │
│  - Peek: 25%        │
│  - Half: 50%        │
│  - Full: 90%        │
└─────────────────────┘
```

---

## États Composants

| État | Modification |
|------|-------------|
| `default` | Style de base |
| `hover` | Luminosité +5% |
| `pressed` | Luminosité -10% |
| `disabled` | Opacité 50% |
| `loading` | Spinner remplace contenu |
| `error` | Border red, text red |
| `success` | Border green, icon check |

---

## Animations

| Animation | Duration | Easing |
|-----------|----------|--------|
| `fade` | 200ms | ease-out |
| `slide-up` | 300ms | ease-out |
| `scale` | 150ms | ease-in-out |
| `shake` | 400ms | ease-in-out (3x) |
| `progress` | 1000ms | linear |

---

## Iconographie

**Librairie**: Phosphor Icons (React Native)
**Taille par défaut**: 24px
**Taille boutons**: 20px
**Taille navigation**: 28px
**Weight**: `regular` (défaut), `bold` (accents)

---

# COMPOSANTS FIGMA (Auto-layout)

## Naming Convention

```
[Category]/[Component]/[Variant]/[State]

Exemples:
- Button/Primary/Default
- Button/Primary/Pressed
- Button/Primary/Disabled
- Input/Text/Default
- Input/Text/Focus
- Input/Text/Error
- Card/Route/Active
- Card/Route/Draft
- Card/Stop/Normal
- Card/Stop/HighPriority
- Sheet/Confirmation/Default
- Nav/Bottom/Default
```

---

## Structure Auto-layout Figma

### Button/Primary
```
Frame "Button/Primary" (Auto-layout)
├── Direction: Horizontal
├── Padding: 16v, 24h
├── Gap: 8
├── Align: Center
├── Fill: #FF6B00
├── Radius: 12
├── Min Height: 56
│
├── Icon (optional) - 20x20
└── Text "Label" - Inter 16 Bold #FFFFFF
```

### Card/Stop
```
Frame "Card/Stop" (Auto-layout)
├── Direction: Vertical
├── Padding: 16
├── Gap: 8
├── Fill: #FFFFFF
├── Radius: 16
├── Shadow: 0 2 8 rgba(0,0,0,0.04)
│
├── Row (Auto-layout H)
│   ├── DragHandle ≡
│   ├── Number "1."
│   └── Address text
│
├── Row (Auto-layout H)
│   ├── Postal + City
│   └── Priority dot
│
└── Row (Auto-layout H)
    ├── Name
    └── Phone
```

### Sheet/Confirmation
```
Frame "Sheet/Confirmation" (Auto-layout)
├── Direction: Vertical
├── Padding: 20t, 20h, 34b (safe area)
├── Gap: 16
├── Fill: #1A1A1A
├── Radius: 24t
│
├── Handle (40x4, centered, #666)
├── Header row
├── Input/Address
├── Row (Postal + City)
├── Input/FirstName + LastName
├── Input/Phone
└── Row (Cancel + Confirm buttons)
```

---

## Tokens Figma (Variables)

### Colors
```
colors/primary = #FF6B00
colors/primary-dark = #E55A00
colors/secondary = #22C55E
colors/danger = #EF4444
colors/warning = #F59E0B
colors/surface = #FFFFFF
colors/background = #F5F5F5
colors/text-primary = #1A1A1A
colors/text-secondary = #6B7280
colors/border = #E5E5E5
```

### Spacing
```
spacing/xs = 4
spacing/sm = 8
spacing/md = 16
spacing/lg = 24
spacing/xl = 32
spacing/2xl = 48
```

### Radius
```
radius/sm = 8
radius/md = 12
radius/lg = 16
radius/xl = 24
radius/full = 9999
```

### Typography
```
text/h1 = Inter 32 Bold
text/h2 = Inter 24 Bold
text/h3 = Inter 20 Semibold
text/body = Inter 16 Regular
text/body-bold = Inter 16 Semibold
text/caption = Inter 14 Regular
text/small = Inter 12 Regular
text/button = Inter 16 Bold
```

---

# PRINCIPES UX CLÉS

## 1. Zone du Pouce
- Actions principales dans les 60% bas
- Navigation en bottom bar
- Boutons critiques jamais en haut

## 2. Feedback Immédiat
- Haptic sur chaque action
- Animation de transition
- États loading visibles

## 3. Tolérance aux Erreurs
- Undo disponible 5s après suppression
- Confirmation uniquement pour actions destructives
- Auto-save permanent

## 4. Lisibilité Terrain
- Contraste minimum 7:1
- Pas de gris clair sur fond clair
- Texte 16px minimum pour contenu

## 5. Performance Perçue
- Skeleton loaders
- Optimistic UI
- Animations rapides (<300ms)

## 6. Accessibilité
- Touch targets 48x48px min
- Labels sur tous les boutons icône
- Support VoiceOver/TalkBack

---

# CHECKLIST IMPLÉMENTATION

Pour chaque écran, vérifier:

- [ ] Touch targets ≥ 48px
- [ ] Contraste ≥ 7:1
- [ ] CTA dans zone pouce
- [ ] États loading/error/empty
- [ ] Haptic feedback
- [ ] Animation transitions
- [ ] Safe area respectée
- [ ] Dark mode supporté
- [ ] Keyboard handling
- [ ] Pull-to-refresh si liste

---

*Document généré pour équipe dev DriverPro*
*Version 1.0 — Février 2026*
