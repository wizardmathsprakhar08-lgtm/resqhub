import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { getDatabase } from '../src/database/db';
import { colors } from '../src/theme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent auto hiding until initialized
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => {
    try {
      // Initialize local SQLite tables on app startup
      getDatabase();
    } catch (e) {
      console.error('Failed to initialize database on startup:', e);
    } finally {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="alert/active"
          options={{
            headerShown: false,
            gestureEnabled: false, // Prevent accidental swipe back during active emergency
          }}
        />
        <Stack.Screen name="contacts/add" options={{ headerShown: false }} />
        <Stack.Screen name="guides/index" options={{ headerShown: false }} />
        <Stack.Screen name="instructions/index" options={{ headerShown: false }} />
        <Stack.Screen name="settings/message" options={{ headerShown: false }} />
        <Stack.Screen name="settings/history" options={{ headerShown: false }} />
        <Stack.Screen name="settings/permissions" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
