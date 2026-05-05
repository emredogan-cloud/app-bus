import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/shared/api';
import { theme } from '@/shared/theme';

type Stop = Awaited<ReturnType<typeof apiClient.getStop>>;

export default function StopDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [stop, setStop] = useState<Stop | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    apiClient
      .getStop(id)
      .then((s) => !cancelled && setStop(s))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!stop) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const linesByDirection = stop.lines.reduce(
    (acc, l) => {
      const arr = acc[l.direction] ?? [];
      arr.push(l);
      acc[l.direction] = arr;
      return acc;
    },
    {} as Record<string, typeof stop.lines>,
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: theme.spacing.lg }}>
      <Text style={styles.title}>{stop.name_tr}</Text>
      <Text style={styles.subtitle}>
        {stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}
      </Text>

      <Text style={styles.section}>{t('transit.stop.lines')}</Text>
      {stop.lines.length === 0 && <Text style={styles.muted}>{t('transit.stop.no_lines')}</Text>}

      {(['outbound', 'inbound'] as const).map((dir) => {
        const lines = linesByDirection[dir] ?? [];
        if (lines.length === 0) return null;
        return (
          <View key={dir}>
            <Text style={styles.dirHeader}>
              {t(`transit.stop.directions.${dir}` as 'transit.stop.directions.outbound')}
            </Text>
            {lines
              .sort((a, b) => a.sequence - b.sequence)
              .map((l) => (
                <View key={l.route.id} style={styles.row}>
                  <Text style={styles.routeBadge}>{l.route.code}</Text>
                  <Text style={styles.rowText}>{l.route.name_tr}</Text>
                </View>
              ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  title: { fontSize: theme.typography.title, fontWeight: '700', color: theme.colors.text },
  subtitle: { color: theme.colors.subtext, marginTop: theme.spacing.xs },
  section: {
    marginTop: theme.spacing.lg,
    color: theme.colors.subtext,
    fontSize: theme.typography.caption,
    textTransform: 'uppercase',
  },
  muted: { color: theme.colors.subtext, marginTop: theme.spacing.sm },
  dirHeader: {
    marginTop: theme.spacing.md,
    color: theme.colors.text,
    fontSize: theme.typography.subtitle,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
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
  error: { color: theme.colors.danger, fontSize: theme.typography.body },
});
