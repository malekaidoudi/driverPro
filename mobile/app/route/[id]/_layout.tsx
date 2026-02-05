import { Stack } from 'expo-router';

export default function RouteIdLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="optimized" />
            <Stack.Screen name="execute" />
            <Stack.Screen name="navigate" options={{ presentation: 'fullScreenModal' }} />
        </Stack>
    );
}
