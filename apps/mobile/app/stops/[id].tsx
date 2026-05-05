import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/shared/api';
import { useStopEtas } from '@/features/eta/use-stop-etas';
import { etaColor, formatEta } from '@/features/eta/format-eta';
import { theme } from '@/shared/theme';

type Stop = Awaited<ReturnType<typeof apiClient.getStop>>;

export default function StopDetailScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [stop, setStop] = useState<Stop | null>(null);
  const [error, setError] = useState<string | null>(null);
  const etas = useStopEtas(id);

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

  const locale = (i18n.language === 'en' ? 'en' : 'tr') as 'tr' | 'en';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: theme.spacing.lg }}>
      <Text style={styles.title}>{stop.name_tr}</Text>
      <Text style={styles.subtitle}>
        {stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}
      </Text>

      <Text style={styles.section}>{t('transit.stop.lines')}</Text>
      {etas === null && <ActivityIndicator color={theme.colors.primary} />}
      {etas !== null && etas.length === 0 && (
        <Text style={styles.muted}>
          {locale === 'tr'
            ? 'Önümüzdeki saatte yaklaşan araç yok.'
            : 'No vehicles in the next hour.'}
        </Text>
      )}
      {etas?.map((e, idx) => {
        const c = etaColor(e.eta_seconds);
        return (
          <View key={`${e.route_id}-${idx}`} style={styles.row}>
            <Text style={styles.routeBadge}>{e.route_code}</Text>
            <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
              <Text style={styles.rowText}>{e.headsign ?? e.route_code}</Text>
              <Text style={styles.rowMeta}>
                {e.source === 'live'
                  ? locale === 'tr'
                    ? 'Canlı'
                    : 'Live'
                  : locale === 'tr'
                    ? 'Tarifeden'
                    : 'Scheduled'}{' '}
                · {e.confidence}
              </Text>
            </View>
            <Text style={[styles.eta, etaStyle(c)]}>
              {formatEta(e.eta_seconds, e.eta_unix, locale)}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

function etaStyle(c: 'urgent' | 'soon' | 'normal') {
  switch (c) {
    case 'urgent':
      return { color: theme.colors.danger };
    case 'soon':
      return { color: theme.colors.warning };
    default:
      return { color: theme.colors.success };
  }
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
    marginBottom: theme.spacing.sm,
  },
  muted: { color: theme.colors.subtext, marginTop: theme.spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  rowText: { color: theme.colors.text, fontSize: theme.typography.body },
  rowMeta: { color: theme.colors.subtext, fontSize: theme.typography.caption, marginTop: 2 },
  routeBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    backgroundColor: theme.colors.primary,
    color: theme.colors.primaryFg,
    borderRadius: theme.radius.sm,
    fontWeight: '700',
    minWidth: 56,
    textAlign: 'center',
  },
  eta: { fontSize: theme.typography.subtitle, fontWeight: '700' },
  error: { color: theme.colors.danger, fontSize: theme.typography.body },
});
