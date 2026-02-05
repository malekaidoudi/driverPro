import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

// ============================================
// DESIGN SYSTEM V2
// Light: Atlas Blue | Dark: Carbon Pro
// ============================================

interface ThemeColors {
    // Primary action color
    primary: string;
    primaryHover: string;
    primaryMuted: string;

    // Semantic colors
    success: string;
    successMuted: string;
    warning: string;
    warningMuted: string;
    danger: string;
    dangerMuted: string;
    info: string;

    // Backgrounds
    bgPrimary: string;
    bgSecondary: string;
    bgTertiary: string;
    bgElevated: string;
    bgInverse: string;

    // Text
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    textInverse: string;

    // Borders
    border: string;
    borderMuted: string;
    borderFocus: string;

    // Map specific
    mapRoute: string;
    mapMarker: string;
    mapCurrent: string;

    // Shadows (as colors for RN)
    shadowColor: string;

    // Legacy aliases (for backward compatibility)
    surface: string;
    background: string;
}

interface ThemeContextType {
    theme: ThemeMode;
    activeTheme: 'light' | 'dark';
    colors: ThemeColors;
    setTheme: (theme: ThemeMode) => void;
    isDark: boolean;
}

// ============================================
// ATLAS BLUE — Light Mode
// Premium navigation app inspired
// ============================================
const lightColors: ThemeColors = {
    // Primary - Royal Blue
    primary: '#2563EB',
    primaryHover: '#1D4ED8',
    primaryMuted: 'rgba(37, 99, 235, 0.1)',

    // Semantic
    success: '#16A34A',
    successMuted: 'rgba(22, 163, 74, 0.1)',
    warning: '#D97706',
    warningMuted: 'rgba(217, 119, 6, 0.1)',
    danger: '#DC2626',
    dangerMuted: 'rgba(220, 38, 38, 0.1)',
    info: '#0284C7',

    // Backgrounds
    bgPrimary: '#FFFFFF',
    bgSecondary: '#F8FAFC',
    bgTertiary: '#F1F5F9',
    bgElevated: '#E2E8F0',
    bgInverse: '#0F172A',

    // Text
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textTertiary: '#94A3B8',
    textInverse: '#FFFFFF',

    // Borders
    border: 'rgba(15, 23, 42, 0.08)',
    borderMuted: 'rgba(15, 23, 42, 0.04)',
    borderFocus: '#2563EB',

    // Map
    mapRoute: '#2563EB',
    mapMarker: '#16A34A',
    mapCurrent: '#0EA5E9',

    // Shadow
    shadowColor: 'rgba(15, 23, 42, 0.1)',

    // Legacy
    surface: '#FFFFFF',
    background: '#F8FAFC',
};

// ============================================
// CARBON PRO — Dark Mode
// Premium cockpit inspired (Tesla/Porsche)
// ============================================
const darkColors: ThemeColors = {
    // Primary - Electric Cyan
    primary: '#22D3EE',
    primaryHover: '#06B6D4',
    primaryMuted: 'rgba(34, 211, 238, 0.15)',

    // Semantic
    success: '#4ADE80',
    successMuted: 'rgba(74, 222, 128, 0.15)',
    warning: '#FBBF24',
    warningMuted: 'rgba(251, 191, 36, 0.15)',
    danger: '#F87171',
    dangerMuted: 'rgba(248, 113, 113, 0.15)',
    info: '#60A5FA',

    // Backgrounds
    bgPrimary: '#0D0D0F',
    bgSecondary: '#18181B',
    bgTertiary: '#27272A',
    bgElevated: '#3F3F46',
    bgInverse: '#FAFAFA',

    // Text
    textPrimary: '#FAFAFA',
    textSecondary: '#A1A1AA',
    textTertiary: '#71717A',
    textInverse: '#0D0D0F',

    // Borders
    border: 'rgba(255, 255, 255, 0.06)',
    borderMuted: 'rgba(255, 255, 255, 0.03)',
    borderFocus: '#22D3EE',

    // Map
    mapRoute: '#22D3EE',
    mapMarker: '#4ADE80',
    mapCurrent: '#60A5FA',

    // Shadow
    shadowColor: 'rgba(0, 0, 0, 0.5)',

    // Legacy
    surface: '#18181B',
    background: '#0D0D0F',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const [theme, setThemeState] = useState<ThemeMode>('system');

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const savedTheme = await AsyncStorage.getItem('theme');
            if (savedTheme) {
                setThemeState(savedTheme as ThemeMode);
            }
        } catch (error) {
            console.error('Failed to load theme:', error);
        }
    };

    const setTheme = async (newTheme: ThemeMode) => {
        try {
            await AsyncStorage.setItem('theme', newTheme);
            setThemeState(newTheme);
        } catch (error) {
            console.error('Failed to save theme:', error);
        }
    };

    const activeTheme: 'light' | 'dark' =
        theme === 'system' ? (systemColorScheme === 'dark' ? 'dark' : 'light') : theme;

    const isDark = activeTheme === 'dark';
    const colors = isDark ? darkColors : lightColors;

    return (
        <ThemeContext.Provider value={{ theme, activeTheme, colors, setTheme, isDark }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
