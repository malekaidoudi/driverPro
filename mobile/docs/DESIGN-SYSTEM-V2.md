# DriverPro Design System v2.0
## Visual Reskin — 3 Directions

---

# ANALYSE PRÉLIMINAIRE

## Contraintes Terrain (Non-Négociables)
| Contrainte | Implication Design |
|------------|-------------------|
| Soleil direct | Contraste WCAG AAA (7:1 min) |
| Une main | Touch targets 48px min, zone pouce |
| Mouvement | Pas d'animations longues, feedback instantané |
| Gants | Boutons 56px hauteur min |
| Stress | Hiérarchie visuelle ultra-claire |
| B2B Pro | Esthétique sobre, pas ludique |

## Problèmes du Style Actuel
- Orange `#FF6B00` trop saturé → fatigue visuelle
- Manque de profondeur → flat générique
- Pas de système d'élévation cohérent
- Typographie sans caractère

---

# DIRECTION 1 — CARBON PRO

## Philosophie
> "L'outil de précision du professionnel"

Inspiré des interfaces cockpit automobile premium (Tesla, Porsche). 
Dark mode natif avec accents lumineux. Évoque fiabilité, technologie, performance.

## Palette Couleurs

### Backgrounds
```
--bg-primary:       #0D0D0F      // Noir profond
--bg-secondary:     #18181B      // Surface élevée
--bg-tertiary:      #27272A      // Cards
--bg-elevated:      #3F3F46      // Inputs, hover
```

### Textes
```
--text-primary:     #FAFAFA      // Titres, CTA
--text-secondary:   #A1A1AA      // Corps
--text-tertiary:    #71717A      // Hints, placeholders
--text-inverse:     #09090B      // Sur accents
```

### Accents
```
--accent-primary:   #22D3EE      // Cyan électrique (CTA principal)
--accent-success:   #4ADE80      // Vert validation
--accent-warning:   #FBBF24      // Ambre alerte
--accent-danger:    #F87171      // Rouge erreur
--accent-info:      #60A5FA      // Bleu info
```

### Gradients
```
--gradient-cta:     linear-gradient(135deg, #22D3EE 0%, #0EA5E9 100%)
--gradient-success: linear-gradient(135deg, #4ADE80 0%, #22C55E 100%)
--gradient-surface: linear-gradient(180deg, #18181B 0%, #0D0D0F 100%)
```

## Typographie

### Font Stack
```
--font-display:     'Inter', -apple-system, sans-serif
--font-mono:        'JetBrains Mono', monospace
```

### Scale
```
--text-xs:    12px / 16px   // Caption
--text-sm:    14px / 20px   // Body small
--text-base:  16px / 24px   // Body
--text-lg:    18px / 28px   // Body large
--text-xl:    20px / 28px   // Heading 4
--text-2xl:   24px / 32px   // Heading 3
--text-3xl:   30px / 36px   // Heading 2
--text-4xl:   36px / 40px   // Heading 1
```

### Weights
```
--font-normal:   400
--font-medium:   500
--font-semibold: 600
--font-bold:     700
```

## Spacing
```
--space-1:   4px
--space-2:   8px
--space-3:   12px
--space-4:   16px
--space-5:   20px
--space-6:   24px
--space-8:   32px
--space-10:  40px
--space-12:  48px
--space-16:  64px
```

## Border Radius
```
--radius-sm:    6px
--radius-md:    10px
--radius-lg:    14px
--radius-xl:    20px
--radius-full:  9999px
```

## Elevation (Shadows)
```
--shadow-sm:    0 1px 2px rgba(0,0,0,0.4)
--shadow-md:    0 4px 6px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3)
--shadow-lg:    0 10px 15px rgba(0,0,0,0.5), 0 4px 6px rgba(0,0,0,0.3)
--shadow-xl:    0 20px 25px rgba(0,0,0,0.5), 0 8px 10px rgba(0,0,0,0.3)
--shadow-glow:  0 0 20px rgba(34, 211, 238, 0.3)
```

## Composants

### Buttons
```css
/* Primary CTA */
.btn-primary {
  background: var(--gradient-cta);
  color: var(--text-inverse);
  height: 56px;
  padding: 0 24px;
  border-radius: var(--radius-lg);
  font-weight: var(--font-semibold);
  font-size: var(--text-base);
  box-shadow: var(--shadow-md), var(--shadow-glow);
  transition: transform 0.15s, box-shadow 0.15s;
}
.btn-primary:active {
  transform: scale(0.98);
  box-shadow: var(--shadow-sm);
}

/* Secondary */
.btn-secondary {
  background: var(--bg-tertiary);
  border: 1px solid var(--bg-elevated);
  color: var(--text-primary);
  height: 56px;
  border-radius: var(--radius-lg);
}

/* Success (Livré) */
.btn-success {
  background: var(--gradient-success);
  color: var(--text-inverse);
  height: 56px;
  border-radius: var(--radius-lg);
}

/* Danger (Échec) */
.btn-danger {
  background: transparent;
  border: 2px solid var(--accent-danger);
  color: var(--accent-danger);
  height: 56px;
  border-radius: var(--radius-lg);
}
```

### Cards
```css
.card {
  background: var(--bg-tertiary);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
  box-shadow: var(--shadow-md);
}
.card-elevated {
  background: var(--gradient-surface);
  border: 1px solid rgba(255,255,255,0.1);
}
```

### Inputs
```css
.input {
  background: var(--bg-elevated);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  height: 52px;
  padding: 0 var(--space-4);
  color: var(--text-primary);
  font-size: var(--text-base);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.input:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.15);
}
```

### Bottom Sheets
```css
.bottom-sheet {
  background: var(--bg-secondary);
  border-top-left-radius: var(--radius-xl);
  border-top-right-radius: var(--radius-xl);
  box-shadow: 0 -10px 40px rgba(0,0,0,0.5);
}
.bottom-sheet-handle {
  width: 36px;
  height: 4px;
  background: var(--bg-elevated);
  border-radius: var(--radius-full);
  margin: var(--space-3) auto var(--space-4);
}
```

### Navigation Bar
```css
.nav-bar {
  background: rgba(13, 13, 15, 0.85);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.nav-title {
  color: var(--text-primary);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
}
```

### Tab Bar
```css
.tab-bar {
  background: var(--bg-secondary);
  border-top: 1px solid rgba(255,255,255,0.06);
}
.tab-item {
  color: var(--text-tertiary);
}
.tab-item-active {
  color: var(--accent-primary);
}
```

## Iconographie
- **Style**: Outlined, 1.5px stroke
- **Library**: Phosphor Icons (Light weight)
- **Size**: 24px standard, 20px compact
- **Color**: Inherit from parent

## Animations
```css
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-slow: 400ms;

/* Micro-interactions */
.haptic-tap { transform: scale(0.98); }
.fade-in { opacity: 0 → 1; duration: var(--duration-normal); }
.slide-up { translateY: 20px → 0; duration: var(--duration-normal); }
```

---

# DIRECTION 2 — ATLAS BLUE

## Philosophie
> "La carte qui guide avec assurance"

Inspiré des apps de navigation premium (Waze Pro, HERE). 
Light mode dominant avec bleu professionnel. Évoque confiance, clarté, précision cartographique.

## Palette Couleurs

### Backgrounds
```
--bg-primary:       #FFFFFF      // Base
--bg-secondary:     #F8FAFC      // Surface
--bg-tertiary:      #F1F5F9      // Cards
--bg-elevated:      #E2E8F0      // Inputs
--bg-dark:          #0F172A      // Overlays, modals
```

### Textes
```
--text-primary:     #0F172A      // Titres
--text-secondary:   #475569      // Corps
--text-tertiary:    #94A3B8      // Hints
--text-inverse:     #FFFFFF      // Sur couleurs
```

### Accents
```
--accent-primary:   #2563EB      // Bleu royal (CTA)
--accent-secondary: #0EA5E9      // Bleu ciel (secondaire)
--accent-success:   #16A34A      // Vert profond
--accent-warning:   #EA580C      // Orange foncé
--accent-danger:    #DC2626      // Rouge vif
```

### Semantic
```
--map-route:        #2563EB      // Tracé principal
--map-destination:  #16A34A      // Marqueur arrivée
--map-current:      #0EA5E9      // Position actuelle
```

### Gradients
```
--gradient-cta:     linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)
--gradient-success: linear-gradient(135deg, #16A34A 0%, #15803D 100%)
--gradient-header:  linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)
```

## Typographie

### Font Stack
```
--font-display:     'SF Pro Display', -apple-system, sans-serif
--font-text:        'SF Pro Text', -apple-system, sans-serif
--font-mono:        'SF Mono', monospace
```

### Scale (identique Direction 1)

## Border Radius
```
--radius-sm:    8px
--radius-md:    12px
--radius-lg:    16px
--radius-xl:    24px
--radius-full:  9999px
```

## Elevation (Shadows)
```
--shadow-sm:    0 1px 2px rgba(15,23,42,0.05)
--shadow-md:    0 4px 6px rgba(15,23,42,0.07), 0 2px 4px rgba(15,23,42,0.05)
--shadow-lg:    0 10px 15px rgba(15,23,42,0.1), 0 4px 6px rgba(15,23,42,0.05)
--shadow-xl:    0 20px 25px rgba(15,23,42,0.1), 0 8px 10px rgba(15,23,42,0.05)
--shadow-card:  0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.06)
```

## Composants

### Buttons
```css
/* Primary CTA */
.btn-primary {
  background: var(--gradient-cta);
  color: var(--text-inverse);
  height: 56px;
  padding: 0 28px;
  border-radius: var(--radius-lg);
  font-weight: var(--font-semibold);
  box-shadow: var(--shadow-lg), 0 0 0 0 rgba(37,99,235,0);
  transition: all 0.2s var(--ease-out-expo);
}
.btn-primary:active {
  transform: scale(0.98);
  box-shadow: var(--shadow-sm), 0 0 0 4px rgba(37,99,235,0.2);
}

/* Secondary */
.btn-secondary {
  background: var(--bg-primary);
  border: 2px solid var(--accent-primary);
  color: var(--accent-primary);
  height: 56px;
  border-radius: var(--radius-lg);
}

/* Success */
.btn-success {
  background: var(--gradient-success);
  color: var(--text-inverse);
  height: 56px;
  border-radius: var(--radius-lg);
}

/* Danger */
.btn-danger {
  background: var(--bg-primary);
  border: 2px solid var(--accent-danger);
  color: var(--accent-danger);
  height: 56px;
  border-radius: var(--radius-lg);
}
```

### Cards
```css
.card {
  background: var(--bg-primary);
  border: 1px solid rgba(15,23,42,0.08);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
  box-shadow: var(--shadow-card);
}
.card-stop {
  border-left: 4px solid var(--accent-primary);
}
.card-stop-delivered {
  border-left-color: var(--accent-success);
  background: rgba(22,163,74,0.05);
}
```

### Inputs
```css
.input {
  background: var(--bg-primary);
  border: 2px solid var(--bg-elevated);
  border-radius: var(--radius-md);
  height: 52px;
  padding: 0 var(--space-4);
  color: var(--text-primary);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.input:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
}
```

### Bottom Sheets
```css
.bottom-sheet {
  background: var(--bg-primary);
  border-top-left-radius: var(--radius-xl);
  border-top-right-radius: var(--radius-xl);
  box-shadow: 0 -4px 20px rgba(15,23,42,0.15);
}
.bottom-sheet-handle {
  width: 40px;
  height: 5px;
  background: var(--bg-elevated);
  border-radius: var(--radius-full);
}
```

### Navigation
```css
.nav-bar {
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(15,23,42,0.08);
}
```

### Map Overlays
```css
.map-info-banner {
  background: var(--bg-dark);
  color: var(--text-inverse);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  box-shadow: var(--shadow-xl);
}
```

## Iconographie
- **Style**: Filled for active states, outlined for inactive
- **Library**: Lucide Icons
- **Weights**: 2px stroke

## Animations
```css
/* Sheet spring */
.sheet-enter {
  animation: slideUp 0.35s var(--ease-out-expo);
}
/* Button press */
.btn-press {
  animation: pulse 0.15s ease-out;
}
/* Route trace */
.route-draw {
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000 → 0;
  animation-duration: 1.5s;
}
```

---

# DIRECTION 3 — SLATE INDUSTRIAL

## Philosophie
> "L'efficacité brute de l'industrie"

Inspiré du design industriel allemand (Braun, Bosch Pro). 
Neutral avec touches de couleur fonctionnelles. Évoque robustesse, durabilité, sérieux.

## Palette Couleurs

### Backgrounds
```
--bg-primary:       #FAFAF9      // Stone 50
--bg-secondary:     #F5F5F4      // Stone 100
--bg-tertiary:      #E7E5E4      // Stone 200
--bg-elevated:      #D6D3D1      // Stone 300
--bg-inverse:       #1C1917      // Stone 900
```

### Textes
```
--text-primary:     #1C1917      // Stone 900
--text-secondary:   #57534E      // Stone 600
--text-tertiary:    #A8A29E      // Stone 400
--text-inverse:     #FAFAF9      // Stone 50
```

### Accents (Fonctionnels uniquement)
```
--accent-action:    #0D9488      // Teal 600 (CTA unique)
--accent-success:   #059669      // Emerald 600
--accent-warning:   #D97706      // Amber 600
--accent-danger:    #DC2626      // Red 600
--accent-info:      #0284C7      // Sky 600
```

### Industrial Markers
```
--marker-start:     #0D9488      // Teal
--marker-stop:      #1C1917      // Noir
--marker-done:      #059669      // Vert
--route-line:       #1C1917      // Noir
```

## Typographie

### Font Stack
```
--font-display:     'DM Sans', sans-serif
--font-mono:        'IBM Plex Mono', monospace
```

### Caractéristiques
- Majuscules pour labels
- Espacement lettres +0.5% pour titres
- Chiffres tabulaires pour données

## Border Radius
```
--radius-sm:    4px       // Minimal, industriel
--radius-md:    6px
--radius-lg:    8px
--radius-xl:    12px
--radius-full:  9999px
```

## Elevation (Shadows) — Subtiles
```
--shadow-sm:    0 1px 2px rgba(28,25,23,0.04)
--shadow-md:    0 2px 4px rgba(28,25,23,0.06)
--shadow-lg:    0 4px 8px rgba(28,25,23,0.08)
--shadow-xl:    0 8px 16px rgba(28,25,23,0.1)
--shadow-inset: inset 0 1px 2px rgba(28,25,23,0.06)
```

## Composants

### Buttons
```css
/* Primary — Minimal, fort */
.btn-primary {
  background: var(--accent-action);
  color: var(--text-inverse);
  height: 56px;
  padding: 0 32px;
  border-radius: var(--radius-md);
  font-weight: var(--font-semibold);
  font-size: var(--text-base);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border: none;
  transition: background 0.15s;
}
.btn-primary:active {
  background: #0F766E; /* Teal 700 */
}

/* Secondary — Outlined */
.btn-secondary {
  background: transparent;
  border: 2px solid var(--bg-inverse);
  color: var(--text-primary);
  height: 56px;
  border-radius: var(--radius-md);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Ghost — Text only */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  height: 48px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

### Cards
```css
.card {
  background: var(--bg-primary);
  border: 1px solid var(--bg-tertiary);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}
.card-numbered {
  position: relative;
}
.card-numbered::before {
  content: attr(data-number);
  position: absolute;
  left: -12px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  background: var(--bg-inverse);
  color: var(--text-inverse);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  font-weight: var(--font-bold);
}
```

### Inputs
```css
.input {
  background: var(--bg-primary);
  border: 1px solid var(--bg-tertiary);
  border-bottom: 2px solid var(--bg-elevated);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  height: 52px;
  padding: 0 var(--space-4);
  color: var(--text-primary);
}
.input:focus {
  border-bottom-color: var(--accent-action);
}
.input-label {
  text-transform: uppercase;
  font-size: var(--text-xs);
  letter-spacing: 1px;
  color: var(--text-tertiary);
}
```

### Bottom Sheets
```css
.bottom-sheet {
  background: var(--bg-primary);
  border-top: 2px solid var(--bg-inverse);
  border-radius: 0; /* Angles droits = industriel */
}
.bottom-sheet-handle {
  width: 48px;
  height: 3px;
  background: var(--bg-elevated);
}
```

### Status Indicators
```css
.status-badge {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: var(--font-semibold);
}
.status-badge-success {
  background: rgba(5,150,105,0.1);
  color: var(--accent-success);
}
```

### Data Display
```css
.stat-value {
  font-family: var(--font-mono);
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}
.stat-label {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-tertiary);
}
```

## Iconographie
- **Style**: Outlined, géométrique
- **Library**: Tabler Icons
- **Weight**: 1.5px stroke
- **Particularity**: Icônes carrées préférées aux rondes

## Animations — Minimales
```css
--ease-industrial: cubic-bezier(0.4, 0, 0.2, 1);
--duration-instant: 100ms;
--duration-fast: 200ms;

/* Pas d'animations décoratives */
/* Uniquement feedback fonctionnel */
.feedback-success {
  background-color: var(--accent-success);
  transition: background-color var(--duration-instant);
}
```

---

# TOKENS DESIGN SYSTEM — FORMAT EXPORT

## JSON Tokens (Figma / Style Dictionary)

```json
{
  "color": {
    "carbon": {
      "bg": {
        "primary": { "value": "#0D0D0F" },
        "secondary": { "value": "#18181B" },
        "tertiary": { "value": "#27272A" },
        "elevated": { "value": "#3F3F46" }
      },
      "text": {
        "primary": { "value": "#FAFAFA" },
        "secondary": { "value": "#A1A1AA" },
        "tertiary": { "value": "#71717A" }
      },
      "accent": {
        "primary": { "value": "#22D3EE" },
        "success": { "value": "#4ADE80" },
        "warning": { "value": "#FBBF24" },
        "danger": { "value": "#F87171" }
      }
    },
    "atlas": {
      "bg": {
        "primary": { "value": "#FFFFFF" },
        "secondary": { "value": "#F8FAFC" },
        "tertiary": { "value": "#F1F5F9" }
      },
      "text": {
        "primary": { "value": "#0F172A" },
        "secondary": { "value": "#475569" }
      },
      "accent": {
        "primary": { "value": "#2563EB" },
        "success": { "value": "#16A34A" },
        "danger": { "value": "#DC2626" }
      }
    },
    "slate": {
      "bg": {
        "primary": { "value": "#FAFAF9" },
        "secondary": { "value": "#F5F5F4" },
        "inverse": { "value": "#1C1917" }
      },
      "text": {
        "primary": { "value": "#1C1917" },
        "secondary": { "value": "#57534E" }
      },
      "accent": {
        "action": { "value": "#0D9488" },
        "success": { "value": "#059669" }
      }
    }
  },
  "spacing": {
    "1": { "value": "4px" },
    "2": { "value": "8px" },
    "3": { "value": "12px" },
    "4": { "value": "16px" },
    "5": { "value": "20px" },
    "6": { "value": "24px" },
    "8": { "value": "32px" },
    "10": { "value": "40px" },
    "12": { "value": "48px" },
    "16": { "value": "64px" }
  },
  "radius": {
    "carbon": {
      "sm": { "value": "6px" },
      "md": { "value": "10px" },
      "lg": { "value": "14px" },
      "xl": { "value": "20px" }
    },
    "atlas": {
      "sm": { "value": "8px" },
      "md": { "value": "12px" },
      "lg": { "value": "16px" },
      "xl": { "value": "24px" }
    },
    "slate": {
      "sm": { "value": "4px" },
      "md": { "value": "6px" },
      "lg": { "value": "8px" },
      "xl": { "value": "12px" }
    }
  },
  "typography": {
    "carbon": {
      "fontFamily": { "value": "'Inter', -apple-system, sans-serif" }
    },
    "atlas": {
      "fontFamily": { "value": "'SF Pro Display', -apple-system, sans-serif" }
    },
    "slate": {
      "fontFamily": { "value": "'DM Sans', sans-serif" }
    },
    "size": {
      "xs": { "value": "12px" },
      "sm": { "value": "14px" },
      "base": { "value": "16px" },
      "lg": { "value": "18px" },
      "xl": { "value": "20px" },
      "2xl": { "value": "24px" },
      "3xl": { "value": "30px" },
      "4xl": { "value": "36px" }
    }
  },
  "component": {
    "button": {
      "height": { "value": "56px" },
      "heightCompact": { "value": "48px" },
      "minTouchTarget": { "value": "48px" }
    },
    "input": {
      "height": { "value": "52px" }
    },
    "card": {
      "padding": { "value": "20px" }
    },
    "bottomSheet": {
      "handleWidth": { "value": "40px" },
      "handleHeight": { "value": "4px" }
    }
  }
}
```

---

# RECOMMANDATION FINALE

## Pour DriverPro : **DIRECTION 1 — CARBON PRO**

### Pourquoi ?

| Critère | Carbon Pro | Atlas Blue | Slate Industrial |
|---------|------------|------------|------------------|
| **Lisibilité soleil** | ⭐⭐⭐ Dark = moins éblouissant | ⭐⭐ Light réfléchit | ⭐⭐ Neutral ok |
| **Fatigue visuelle** | ⭐⭐⭐ Moins de lumière émise | ⭐⭐ Blanc fatigant | ⭐⭐ Correct |
| **Contraste WCAG** | ⭐⭐⭐ 15:1 sur dark | ⭐⭐⭐ 12:1 sur light | ⭐⭐⭐ 11:1 |
| **Look premium** | ⭐⭐⭐ Tesla/Porsche vibe | ⭐⭐ Pro mais classique | ⭐⭐ Industriel froid |
| **Différenciation** | ⭐⭐⭐ Unique sur le marché | ⭐ Standard app nav | ⭐⭐ Niche |
| **Nuit/Tunnel** | ⭐⭐⭐ Natif dark | ⭐ Éblouissant | ⭐ Éblouissant |

### Arguments Clés

1. **Terrain** : Les livreurs travaillent tôt le matin et tard le soir. Un dark mode natif réduit la fatigue oculaire sur longues journées.

2. **Différenciation** : Toutes les apps concurrentes (Stuart, Uber Driver, Amazon Flex) sont en light mode. Carbon Pro positionne DriverPro comme premium/tech-forward.

3. **Soleil** : Contrairement aux idées reçues, un écran sombre avec texte clair est PLUS lisible en plein soleil qu'un écran blanc qui réfléchit (effet miroir).

4. **Perception marque** : Le cyan électrique sur fond noir évoque la tech de pointe, la précision, la performance — valeurs alignées avec "optimisation de tournées".

### Implémentation Recommandée

```
Phase 1: Tokens + Couleurs de base
Phase 2: Composants principaux (Buttons, Cards, Inputs)
Phase 3: Navigation + Sheets
Phase 4: États + Animations
Phase 5: Polishing + Micro-interactions
```

### Alternative

Si le client préfère un look plus "corporate classique" → **Atlas Blue**
Si le client cible l'industrie/logistique lourde → **Slate Industrial**

---

## FICHIERS À CRÉER

1. `tailwind.config.js` — Mise à jour tokens
2. `src/theme/colors.ts` — Export couleurs
3. `src/theme/spacing.ts` — Export spacing
4. `src/theme/typography.ts` — Export typo
5. `src/components/ui/Button.tsx` — Nouveau style
6. `src/components/ui/Card.tsx` — Nouveau style
7. `src/components/ui/Input.tsx` — Nouveau style

---

*Document généré le 04/02/2026*
*Version: 2.0*
*Auteur: Design System Engineer*
