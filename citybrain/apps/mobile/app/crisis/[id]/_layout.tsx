import { Tabs } from 'expo-router';
import { colors } from '../../../theme/tokens';

export default function CrisisCommandLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.accent,
        headerTitleStyle: { fontFamily: 'monospace', fontSize: 12, letterSpacing: 1 },
        tabBarStyle: {
          backgroundColor: colors.void,
          borderTopColor: colors.border,
          height: 56,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 0.5 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'MAP', tabBarLabel: 'MAP' }} />
      <Tabs.Screen name="timeline" options={{ title: 'AI TRACE', tabBarLabel: 'TRACE' }} />
      <Tabs.Screen name="execution" options={{ title: 'EXEC', tabBarLabel: 'EXEC' }} />
      <Tabs.Screen name="resources" options={{ title: 'ASSETS', tabBarLabel: 'ASSETS' }} />
      <Tabs.Screen name="alerts" options={{ title: 'ALERTS', tabBarLabel: 'ALERTS' }} />
      <Tabs.Screen name="simulation" options={{ title: 'SIM', tabBarLabel: 'SIM' }} />
      <Tabs.Screen name="analysis" options={{ title: 'DELTA', tabBarLabel: 'DELTA' }} />
    </Tabs>
  );
}
