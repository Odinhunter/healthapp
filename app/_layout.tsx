import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuth } from '../src/hooks/useAuth';
import ErrorBoundary from '../src/components/common/ErrorBoundary';
import { colors } from '../src/constants/theme';

function AuthGate() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (user && inAuthGroup) {
      // Don't redirect away from create-profile — verify.tsx handles post-auth routing
      const segs = segments as string[];
      if (segs[1] === 'create-profile') return;
      router.replace('/(app)');
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen
        name="upload"
        options={{
          presentation: 'transparentModal',
          headerShown: false,
          animation: 'none',
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/**
 * Root layout. The boundary sits OUTSIDE AuthGate deliberately — AuthGate
 * itself renders (session restore, redirect effects), so a throw in there
 * needs catching too. Everything below this point is covered.
 */
export default function RootLayout() {
  const router = useRouter();

  return (
    <ErrorBoundary
      // (app)/_layout redirects to welcome if there's no session, so this is
      // safe to call regardless of auth state.
      onGoHome={() => router.replace('/(app)')}
    >
      <AuthGate />
    </ErrorBoundary>
  );
}
