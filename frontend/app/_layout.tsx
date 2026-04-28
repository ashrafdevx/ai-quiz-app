import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '../store/authStore';

const queryClient = new QueryClient();

export default function RootLayout() {
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    restoreSession();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          {/* Auth screens — no animation, no back gesture (never swiped back to) */}
          <Stack.Screen
            name="(auth)"
            options={{ gestureEnabled: false, animation: 'none' }}
          />
          {/* Tab shell — no animation, no back gesture (base app layer after login) */}
          <Stack.Screen
            name="(tabs)"
            options={{ gestureEnabled: false, animation: 'none' }}
          />
          {/* Session screens — slide in from right, back gesture is intentional */}
          <Stack.Screen
            name="session"
            options={{ animation: 'slide_from_right' }}
          />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
