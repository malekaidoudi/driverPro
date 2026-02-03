import { useTheme as useThemeContext } from '../contexts/ThemeContext';

export const useTheme = () => {
    const { theme, activeTheme, colors, setTheme } = useThemeContext();

    const isDark = activeTheme === 'dark';

    const themedStyle = <T extends Record<string, unknown>>(
        lightStyle: T,
        darkStyle: T
    ): T => (isDark ? darkStyle : lightStyle);

    const themedValue = <T>(lightValue: T, darkValue: T): T =>
        isDark ? darkValue : lightValue;

    return {
        theme,
        activeTheme,
        colors,
        setTheme,
        isDark,
        themedStyle,
        themedValue,
    };
};

export type { ThemeMode } from '../contexts/ThemeContext';
