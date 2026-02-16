import 'react-native-gesture-handler';

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PortalProvider } from '@gorhom/portal';
import { AuthProvider } from '../src/contexts/AuthContext';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { warmupBackend } from '../src/services/api';
import { useKeepAwake } from 'expo-keep-awake';

function RootLayoutContent() {
    // Keep screen awake while app is open
    useKeepAwake();

    // Warm up backend on app start (handles Render cold start)
    useEffect(() => {
        warmupBackend();
    }, []);
    const { activeTheme, colors } = useTheme();

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={activeTheme === 'dark' ? 'light' : 'dark'} />
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
            </Stack>
        </View>
    );
}

export default function RootLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemeProvider>
                <AuthProvider>
                    <PortalProvider>
                        <BottomSheetModalProvider>
                            <RootLayoutContent />
                        </BottomSheetModalProvider>
                    </PortalProvider>
                </AuthProvider>
            </ThemeProvider>
        </GestureHandlerRootView>
    );
}
