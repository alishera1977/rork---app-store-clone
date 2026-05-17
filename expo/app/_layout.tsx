import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

import { useAppTheme, AppThemeProvider } from '@/hooks/useAppTheme';
import { NotificationsProvider } from '@/hooks/useNotifications';
import NotificationsSoftPrompt from '@/components/NotificationsSoftPrompt';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { colors: Colors } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Назад',
        headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.text,
        contentStyle: { backgroundColor: Colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

function ThemedApp() {
  const { themeMode } = useAppTheme();

  return (
    <>
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <RootLayoutNav />
      <NotificationsSoftPrompt />
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppThemeProvider>
          <NotificationsProvider>
            <ThemedApp />
          </NotificationsProvider>
        </AppThemeProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
