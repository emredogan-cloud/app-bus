import { useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RegisterRequestSchema, type RegisterRequest } from '@app-bus/types';
import { theme } from '@/shared/theme';
import { registerFinalizer } from './register';
import Constants from 'expo-constants';

const KVKK_VERSION =
  (Constants.expoConfig?.extra?.kvkkVersion as string | undefined) ?? '2026-05-05';

export default function KvkkConsentScreen() {
  const { t } = useTranslation();
  const { pending } = useLocalSearchParams<{ pending: string }>();
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const atBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 24;
    if (atBottom) setScrolledToEnd(true);
  };

  const onAccept = async () => {
    if (!scrolledToEnd || submitting) return;
    setSubmitting(true);
    try {
      const data = JSON.parse(pending ?? '{}') as Partial<RegisterRequest>;
      const validated = RegisterRequestSchema.parse({
        ...data,
        kvkk_consent_version: KVKK_VERSION,
      });
      if (!registerFinalizer) {
        // Defensive — should never happen because kvkk screen is only reached via /auth/register
        router.replace('/auth/welcome');
        return;
      }
      await registerFinalizer(validated, marketing);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth.kvkk.title')}</Text>
      <ScrollView style={styles.scroll} onScroll={onScroll} scrollEventThrottle={32}>
        <Text style={styles.body}>{t('auth.kvkk.intro')}</Text>
        {(t('auth.kvkk.items', { returnObjects: true }) as string[]).map((item, i) => (
          <Text key={i} style={styles.body}>
            • {item}
          </Text>
        ))}
        <Text style={[styles.body, { marginTop: theme.spacing.md }]}>
          {t('auth.kvkk.data_residency')}
        </Text>
        <Text style={[styles.body, { marginTop: theme.spacing.md }]}>{t('auth.kvkk.rights')}</Text>
        <View style={{ height: theme.spacing.xl }} />
      </ScrollView>

      <View style={styles.row}>
        <Switch value={marketing} onValueChange={setMarketing} />
        <Text style={styles.marketing}>{t('auth.kvkk.marketing')}</Text>
      </View>

      {!scrolledToEnd && <Text style={styles.hint}>{t('auth.kvkk.scroll_required')}</Text>}

      <Pressable
        style={[styles.btn, scrolledToEnd ? styles.primary : styles.disabled]}
        onPress={onAccept}
        disabled={!scrolledToEnd || submitting}
      >
        <Text style={styles.btnPrimaryText}>{t('auth.kvkk.accept')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: theme.spacing.lg, backgroundColor: theme.colors.background },
  title: {
    fontSize: theme.typography.title,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  scroll: { flex: 1 },
  body: {
    fontSize: theme.typography.body,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: theme.spacing.sm },
  marketing: { marginLeft: theme.spacing.sm, color: theme.colors.text, flexShrink: 1 },
  hint: { color: theme.colors.subtext, fontSize: theme.typography.caption, textAlign: 'center' },
  btn: {
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  primary: { backgroundColor: theme.colors.primary },
  disabled: { backgroundColor: theme.colors.border },
  btnPrimaryText: {
    color: theme.colors.primaryFg,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
});
