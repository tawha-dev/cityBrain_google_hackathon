import '../global.css';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useWebSocket } from '../hooks/useWebSocket';
import { colors } from '../theme/tokens';

const queryClient = new QueryClient();

function RootLayoutNav() {
  useWebSocket();
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.accent,
          headerTitleStyle: { fontFamily: 'monospace', fontSize: 12 },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'CITYBRAIN // OPS' }} />
        <Stack.Screen name="crisis/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="lab" options={{ title: 'TEST CONSOLE' }} />
        <Stack.Screen name="demo" options={{ title: 'DEMO CONTROL' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutNav />
    </QueryClientProvider>
  );
}
