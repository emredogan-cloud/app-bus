import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useTranslation } from 'react-i18next';
import { theme } from './theme';

/**
 * Compact banner that appears when the device loses connectivity. Hosts of
 * authed screens render this at the top so users always know when they're
 * looking at cached data.
 */
export function NetworkBanner() {
  const { i18n } = useTranslation();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected));
    });
    return () => sub();
  }, []);

  if (online) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        {i18n.language === 'en'
          ? 'Offline — showing cached data'
          : 'Çevrimdışı — önbellekten gösteriliyor'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: theme.colors.warning,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.md,
  },
  text: { color: '#FFFFFF', fontSize: theme.typography.caption, fontWeight: '600' },
});
