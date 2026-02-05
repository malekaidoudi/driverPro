/**
 * ============================================
 * DESIGN SYSTEM V2 — TOKENS
 * Light: Atlas Blue | Dark: Carbon Pro
 * ============================================
 */

// ============================================
// SPACING TOKENS
// ============================================
export const spacing = {
  px: 1,
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  // Semantic
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

// ============================================
// BORDER RADIUS TOKENS
// ============================================
export const radius = {
  none: 0,
  sm: 6,
  DEFAULT: 8,
  md: 10,
  lg: 14,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
} as const;

// ============================================
// TYPOGRAPHY TOKENS
// ============================================
export const typography = {
  fontFamily: {
    sans: 'Inter',
    mono: 'JetBrains Mono',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  lineHeight: {
    xs: 16,
    sm: 20,
    base: 24,
    lg: 28,
    xl: 28,
    '2xl': 32,
    '3xl': 36,
    '4xl': 40,
  },
  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;

// ============================================
// COMPONENT SIZE TOKENS
// ============================================
export const componentSizes = {
  button: {
    height: 56,
    heightSm: 48,
    minWidth: 120,
    paddingX: 24,
    paddingXSm: 16,
  },
  input: {
    height: 52,
    paddingX: 16,
  },
  card: {
    padding: 20,
    paddingSm: 16,
  },
  touchTarget: {
    min: 48,
  },
  icon: {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
  },
  bottomSheet: {
    handleWidth: 40,
    handleHeight: 4,
    borderRadius: 20,
  },
  navBar: {
    height: 56,
  },
  tabBar: {
    height: 84,
  },
} as const;

// ============================================
// SHADOW TOKENS
// ============================================
export const shadows = {
  light: {
    sm: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 6,
      elevation: 3,
    },
    lg: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 15,
      elevation: 6,
    },
    xl: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.1,
      shadowRadius: 25,
      elevation: 10,
    },
    card: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
    },
  },
  dark: {
    sm: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.4,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 6,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.5,
      shadowRadius: 15,
      elevation: 6,
    },
    xl: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.5,
      shadowRadius: 25,
      elevation: 10,
    },
    card: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 2,
    },
    glow: {
      shadowColor: '#22D3EE',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 0,
    },
  },
} as const;

// ============================================
// ANIMATION TOKENS
// ============================================
export const animation = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 400,
  },
  easing: {
    outExpo: 'cubic-bezier(0.16, 1, 0.3, 1)',
    inOutExpo: 'cubic-bezier(0.87, 0, 0.13, 1)',
  },
} as const;

// ============================================
// Z-INDEX TOKENS
// ============================================
export const zIndex = {
  base: 0,
  card: 10,
  sticky: 100,
  header: 200,
  overlay: 300,
  modal: 400,
  popover: 500,
  toast: 600,
} as const;

// ============================================
// STATIC COLOR PALETTES
// ============================================
export const palettes = {
  // Atlas Blue (Light Mode Primary)
  atlas: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
  },
  // Carbon Cyan (Dark Mode Primary)
  carbon: {
    50: '#ECFEFF',
    100: '#CFFAFE',
    200: '#A5F3FC',
    300: '#67E8F9',
    400: '#22D3EE',
    500: '#06B6D4',
    600: '#0891B2',
    700: '#0E7490',
    800: '#155E75',
    900: '#164E63',
  },
  // Emerald (Success)
  emerald: {
    400: '#4ADE80',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
  },
  // Red (Danger)
  red: {
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
  },
  // Amber (Warning)
  amber: {
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
  },
  // Slate (Light mode neutrals)
  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#020617',
  },
  // Zinc (Dark mode neutrals)
  zinc: {
    50: '#FAFAFA',
    100: '#F4F4F5',
    200: '#E4E4E7',
    300: '#D4D4D8',
    400: '#A1A1AA',
    500: '#71717A',
    600: '#52525B',
    700: '#3F3F46',
    800: '#27272A',
    900: '#18181B',
    950: '#0D0D0F',
  },
} as const;

// ============================================
// HELPER FUNCTION
// ============================================
export const getShadow = (isDark: boolean, size: keyof typeof shadows.light) => {
  return isDark ? shadows.dark[size] : shadows.light[size];
};

export default {
  spacing,
  radius,
  typography,
  componentSizes,
  shadows,
  animation,
  zIndex,
  palettes,
  getShadow,
};
