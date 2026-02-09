import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

// ============================================
// DESIGN SYSTEM V2 — UPS DRIVER
// Light: UPS Gold | Dark: UPS Brown
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
// UPS GOLD — Light Mode
// UPS Brand: Gold #FFB500, Brown #351C15
// ============================================
const lightColors: ThemeColors = {
    // Primary - UPS Gold
    primary: '#FFB500',
    primaryHover: '#E6A300',
    primaryMuted: 'rgba(255, 181, 0, 0.15)',

    // Semantic
    success: '#16A34A',
    successMuted: 'rgba(22, 163, 74, 0.1)',
    warning: '#F59E0B',
    warningMuted: 'rgba(245, 158, 11, 0.1)',
    danger: '#DC2626',
    dangerMuted: 'rgba(220, 38, 38, 0.1)',
    info: '#644117',

    // Backgrounds
    bgPrimary: '#FFFFFF',
    bgSecondary: '#FDF8F0',
    bgTertiary: '#F5EDE0',
    bgElevated: '#E8DFD0',
    bgInverse: '#351C15',

    // Text
    textPrimary: '#351C15',
    textSecondary: '#644117',
    textTertiary: '#8B7355',
    textInverse: '#FFFFFF',

    // Borders
    border: 'rgba(53, 28, 21, 0.12)',
    borderMuted: 'rgba(53, 28, 21, 0.06)',
    borderFocus: '#FFB500',

    // Map
    mapRoute: '#644117',
    mapMarker: '#FFB500',
    mapCurrent: '#351C15',

    // Shadow
    shadowColor: 'rgba(53, 28, 21, 0.15)',

    // Legacy
    surface: '#FFFFFF',
    background: '#FDF8F0',
};

// ============================================
// UPS BROWN — Dark Mode
// UPS Brand: Gold #FFB500, Brown #351C15
// ============================================
const darkColors: ThemeColors = {
    // Primary - UPS Gold (stands out on brown)
    primary: '#FFB500',
    primaryHover: '#FFCA4D',
    primaryMuted: 'rgba(255, 181, 0, 0.2)',

    // Semantic
    success: '#4ADE80',
    successMuted: 'rgba(74, 222, 128, 0.15)',
    warning: '#FBBF24',
    warningMuted: 'rgba(251, 191, 36, 0.15)',
    danger: '#F87171',
    dangerMuted: 'rgba(248, 113, 113, 0.15)',
    info: '#FFD666',

    // Backgrounds - UPS Brown tones
    bgPrimary: '#1A0F0A',
    bgSecondary: '#251812',
    bgTertiary: '#351C15',
    bgElevated: '#4A2A1F',
    bgInverse: '#FDF8F0',

    // Text
    textPrimary: '#FDF8F0',
    textSecondary: '#D4C4B0',
    textTertiary: '#A08060',
    textInverse: '#1A0F0A',

    // Borders
    border: 'rgba(255, 181, 0, 0.15)',
    borderMuted: 'rgba(255, 181, 0, 0.08)',
    borderFocus: '#FFB500',

    // Map
    mapRoute: '#FFB500',
    mapMarker: '#4ADE80',
    mapCurrent: '#FFD666',

    // Shadow
    shadowColor: 'rgba(0, 0, 0, 0.6)',

    // Legacy
    surface: '#251812',
    background: '#1A0F0A',
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
