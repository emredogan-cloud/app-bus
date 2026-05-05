import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/shared/api';
import { theme } from '@/shared/theme';

type Favorite = Awaited<ReturnType<typeof apiClient.listFavorites>>[number];

export default function FavoritesScreen() {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<Favorite[] | null>(null);
  const locale = (i18n.language === 'en' ? 'en' : 'tr') as 'tr' | 'en';

  const refresh = () => apiClient.listFavorites().then(setItems);

  useEffect(() => {
    refresh();
  }, []);

  const onRemove = async (id: string) => {
    try {
      await apiClient.removeFavorite(id);
      refresh();
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    }
  };

  if (!items) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.icon}>★</Text>
        <Text style={styles.title}>
          {locale === 'tr' ? 'Henüz favori yok' : 'No favorites yet'}
        </Text>
        <Text style={styles.subtitle}>
          {locale === 'tr'
            ? 'Bir durağa kalp simgesine dokunarak ekleyebilirsin.'
            : 'Tap the heart on any stop to add it.'}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: theme.spacing.lg }}
      data={items}
      keyExtractor={(it) => it.id}
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          onPress={() =>
            item.target_type === 'stop' ? router.push(`/stops/${item.target_id}`) : null
          }
        >
          <Text style={styles.icon2}>{item.target_type === 'stop' ? '📍' : '🚌'}</Text>
          <Text style={styles.rowText}>{item.label ?? item.target_id.slice(0, 8)}</Text>
          <Pressable onPress={() => onRemove(item.id)} hitSlop={16}>
            <Text style={styles.remove}>✕</Text>
          </Pressable>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  icon: { fontSize: 56, marginBottom: theme.spacing.md, color: theme.colors.subtext },
  icon2: { fontSize: 22 },
  title: {
    fontSize: theme.typography.subtitle,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: { color: theme.colors.subtext, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  rowText: {
    flex: 1,
    marginLeft: theme.spacing.md,
    color: theme.colors.text,
    fontSize: theme.typography.body,
  },
  remove: { color: theme.colors.subtext, fontSize: 20, paddingHorizontal: theme.spacing.sm },
});
