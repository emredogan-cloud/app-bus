import type { ExpoConfig } from 'expo/config';

const variant = process.env.APP_VARIANT ?? 'development';

const variantConfig: Record<string, { name: string; bundleId: string; scheme: string }> = {
  development: {
    name: 'App-Bus (Dev)',
    bundleId: 'tr.appbus.app.dev',
    scheme: 'appbus-dev',
  },
  preview: {
    name: 'App-Bus (Preview)',
    bundleId: 'tr.appbus.app.preview',
    scheme: 'appbus-preview',
  },
  production: {
    name: 'App-Bus',
    bundleId: 'tr.appbus.app',
    scheme: 'appbus',
  },
};

const v = variantConfig[variant] ?? variantConfig.development;

const config: ExpoConfig = {
  name: v.name,
  slug: 'app-bus',
  version: '0.0.1',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  scheme: v.scheme,
  ios: {
    supportsTablet: true,
    bundleIdentifier: v.bundleId,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: v.bundleId,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0e7490',
    },
  },
  web: {
    bundler: 'metro',
    output: 'static',
  },
  plugins: [
    'expo-router',
    [
      '@sentry/react-native/expo',
      {
        organization: process.env.SENTRY_ORG ?? 'app-bus',
        project: process.env.SENTRY_PROJECT ?? 'mobile',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    kvkkVersion: process.env.EXPO_PUBLIC_KVKK_VERSION ?? '2026-05-05',
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
};

export default config;
