import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { colors, typography } from '../../src/constants/theme';

export default function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: typography.xs,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="records" options={{ title: 'Records' }} />
      <Tabs.Screen name="visits" options={{ title: 'Visits' }} />
      <Tabs.Screen name="medications" options={{ title: 'Medications' }} />
      <Tabs.Screen name="report/[id]" options={{ href: null }} />
      <Tabs.Screen name="trend/[canonicalName]" options={{ href: null }} />
      <Tabs.Screen name="visit/new" options={{ href: null }} />
      <Tabs.Screen name="visit/[id]" options={{ href: null }} />
      <Tabs.Screen name="medication/new" options={{ href: null }} />
      <Tabs.Screen name="medication/[id]" options={{ href: null }} />
    </Tabs>
  );
}
