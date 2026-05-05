import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const sentryDsn = Constants.expoConfig?.extra?.sentryDsn as string | undefined;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    enableAutoSessionTracking: true,
    tracesSampleRate: 0.1,
  });
}

function RootLayout() {
  useEffect(() => {
    // Phase 0 placeholder for any deferred init (i18n, MMKV, etc.)
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: 'App-Bus' }} />
      </Stack>
    </SafeAreaProvider>
  );
}

export default sentryDsn ? Sentry.wrap(RootLayout) : RootLayout;
