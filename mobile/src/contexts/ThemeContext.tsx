import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeColors {
    primary: string;
    primaryDark: string;
    secondary: string;
    danger: string;
    warning: string;
    surface: string;
    background: string;
    textPrimary: string;
    textSecondary: string;
    border: string;
}

interface ThemeContextType {
    theme: ThemeMode;
    activeTheme: 'light' | 'dark';
    colors: ThemeColors;
    setTheme: (theme: ThemeMode) => void;
}

const lightColors: ThemeColors = {
    primary: '#FF6B00',
    primaryDark: '#E55A00',
    secondary: '#22C55E',
    danger: '#EF4444',
    warning: '#F59E0B',
    surface: '#FFFFFF',
    background: '#F5F5F5',
    textPrimary: '#1A1A1A',
    textSecondary: '#6B7280',
    border: '#E5E5E5',
};

const darkColors: ThemeColors = {
    primary: '#FF6B00',
    primaryDark: '#E55A00',
    secondary: '#22C55E',
    danger: '#EF4444',
    warning: '#F59E0B',
    surface: '#1A1A1A',
    background: '#0D0D0D',
    textPrimary: '#FFFFFF',
    textSecondary: '#9CA3AF',
    border: '#374151',
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

    const colors = activeTheme === 'dark' ? darkColors : lightColors;

    return (
        <ThemeContext.Provider value={{ theme, activeTheme, colors, setTheme }}>
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
