import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '@/shared/theme';

/**
 * Map screen — placeholder.
 *
 * MapLibre + Protomaps native module wiring lands in Phase 4 (live WebSocket
 * stream). The native install requires:
 *   • EAS Build dev client (Expo Go does not bundle MapLibre)
 *   • app.config.ts plugin: `[ '@maplibre/maplibre-react-native/expo-plugin' ]`
 *   • EXPO_PUBLIC_TILE_URL pointing to the Protomaps PMTiles on S3+CloudFront
 *
 * The Phase 2 listing/search/detail UX works without the map.
 */
export default function MapScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <Text style={styles.icon}>🗺️</Text>
      <Text style={styles.title}>{t('transit.map.coming_soon')}</Text>
      <Text style={styles.body}>{t('transit.map.placeholder_msg')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  icon: { fontSize: 48, marginBottom: theme.spacing.md },
  title: {
    fontSize: theme.typography.subtitle,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  body: { color: theme.colors.subtext, textAlign: 'center' },
});
