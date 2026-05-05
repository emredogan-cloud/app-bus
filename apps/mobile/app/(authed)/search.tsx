import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/shared/api';
import { useDebounced } from '@/shared/use-debounced';
import { theme } from '@/shared/theme';

interface SearchResults {
  stops: Array<{ id: string; name_tr: string; lat: number; lng: number }>;
  routes: Array<{ id: string; code: string; name_tr: string; mode: string }>;
}

export default function SearchScreen() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const debounced = useDebounced(q, 300);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (debounced.length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiClient
      .search({ q: debounced, limit: 20 })
      .then((res) => {
        if (!cancelled) setResults(res);
      })
      .catch(() => {
        if (!cancelled) setResults(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder={t('transit.search.placeholder')}
        value={q}
        onChangeText={setQ}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
      />

      {loading && (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: theme.spacing.md }} />
      )}

      {!loading && q.length > 0 && q.length < 2 && (
        <Text style={styles.hint}>{t('transit.search.min_chars')}</Text>
      )}

      {!loading && results && (
        <FlatList
          data={[
            ...results.routes.map((r) => ({ kind: 'route' as const, ...r })),
            ...results.stops.map((s) => ({ kind: 'stop' as const, ...s, code: '', mode: '' })),
          ]}
          keyExtractor={(item) => `${item.kind}:${item.id}`}
          ListHeaderComponent={
            <Text style={styles.section}>
              {results.routes.length + results.stops.length === 0
                ? t('transit.search.empty')
                : `${results.routes.length} ${t('transit.search.routes')} · ${results.stops.length} ${t('transit.search.stops')}`}
            </Text>
          }
          renderItem={({ item }) =>
            item.kind === 'route' ? (
              <Pressable style={styles.row}>
                <Text style={styles.routeBadge}>{item.code}</Text>
                <Text style={styles.rowText}>{item.name_tr}</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.row} onPress={() => router.push(`/stops/${item.id}`)}>
                <Text style={styles.stopIcon}>📍</Text>
                <Text style={styles.rowText}>{item.name_tr}</Text>
              </Pressable>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: theme.spacing.lg, backgroundColor: theme.colors.background },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    fontSize: theme.typography.body,
    color: theme.colors.text,
  },
  hint: { marginTop: theme.spacing.md, color: theme.colors.subtext },
  section: {
    marginTop: theme.spacing.md,
    color: theme.colors.subtext,
    fontSize: theme.typography.caption,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  rowText: {
    marginLeft: theme.spacing.md,
    color: theme.colors.text,
    fontSize: theme.typography.body,
    flexShrink: 1,
  },
  routeBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    backgroundColor: theme.colors.primary,
    color: theme.colors.primaryFg,
    borderRadius: theme.radius.sm,
    fontWeight: '700',
    minWidth: 48,
    textAlign: 'center',
  },
  stopIcon: { fontSize: 20 },
});
