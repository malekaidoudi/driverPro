import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeColors {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    textPrimary: string;
    textSecondary: string;
    error: string;
}

interface ThemeContextType {
    theme: ThemeMode;
    activeTheme: 'light' | 'dark';
    colors: ThemeColors;
    setTheme: (theme: ThemeMode) => void;
}

const lightColors: ThemeColors = {
    primary: '#4A90E2',
    secondary: '#50E3C2',
    accent: '#F5A623',
    background: '#F9F9F9',
    surface: '#FFFFFF',
    textPrimary: '#4A4A4A',
    textSecondary: '#9B9B9B',
    error: '#D0021B',
};

const darkColors: ThemeColors = {
    primary: '#4A90E2',
    secondary: '#50E3C2',
    accent: '#F5A623',
    background: '#121212',
    surface: '#1E1E1E',
    textPrimary: '#EAEAEA',
    textSecondary: '#A5A5A5',
    error: '#CF6679',
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
