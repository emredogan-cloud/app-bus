import 'react-native-gesture-handler';
import '@/i18n';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '@/features/auth/auth-context';
import { theme } from '@/shared/theme';

const sentryDsn = Constants.expoConfig?.extra?.sentryDsn as string | undefined;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    enableAutoSessionTracking: true,
    tracesSampleRate: 0.1,
  });
}

function NavGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === 'auth';
    if (!user && !inAuthGroup) {
      router.replace('/auth/welcome');
    } else if (user && inAuthGroup) {
      router.replace('/');
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }
  return <>{children}</>;
}

function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <AuthProvider>
        <NavGate>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="auth/welcome" />
            <Stack.Screen name="auth/login" options={{ headerShown: true, title: '' }} />
            <Stack.Screen name="auth/register" options={{ headerShown: true, title: '' }} />
            <Stack.Screen name="auth/kvkk-consent" options={{ headerShown: true, title: '' }} />
            <Stack.Screen name="auth/forgot-password" options={{ headerShown: true, title: '' }} />
            <Stack.Screen name="(authed)/profile" options={{ headerShown: true, title: '' }} />
          </Stack>
        </NavGate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default sentryDsn ? Sentry.wrap(RootLayout) : RootLayout;
