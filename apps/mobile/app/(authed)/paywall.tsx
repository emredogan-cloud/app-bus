import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { theme } from '@/shared/theme';

/**
 * Paywall — Phase 8 placeholder.
 *
 * The full RevenueCat purchase flow lands once the Apple/Google paid
 * developer accounts are configured. The product offerings are:
 *   • Monthly  ₺49 / $4.99
 *   • Yearly   ₺399 / $39.99 (~33% off)
 *
 * Premium unlocks:
 *   • Ad-free experience
 *   • Unlimited favorites (free tier capped at 5)
 *   • Biometric unlock
 *   • Priority support
 *   • Smart route suggestions teaser (Phase 13)
 *   • Watch faces (Phase 12)
 */
export default function PaywallScreen() {
  const { i18n } = useTranslation();
  const en = i18n.language === 'en';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{en ? 'App-Bus Premium' : 'App-Bus Premium'}</Text>
      <Text style={styles.subtitle}>
        {en
          ? 'Unlock unlimited favorites, ad-free, biometric unlock, and more.'
          : 'Sınırsız favori, reklamsız deneyim, biyometrik kilit ve daha fazlası.'}
      </Text>

      <View style={styles.plan}>
        <Text style={styles.planTitle}>{en ? 'Yearly' : 'Yıllık'}</Text>
        <Text style={styles.planPrice}>
          {en ? '₺399 / year — save 33%' : '₺399 / yıl — %33 indirim'}
        </Text>
      </View>
      <View style={styles.plan}>
        <Text style={styles.planTitle}>{en ? 'Monthly' : 'Aylık'}</Text>
        <Text style={styles.planPrice}>{en ? '₺49 / month' : '₺49 / ay'}</Text>
      </View>

      <Pressable style={[styles.btn, styles.primary]} disabled>
        <Text style={styles.btnPrimaryText}>
          {en ? 'Upgrade (coming soon)' : 'Yükselt (yakında)'}
        </Text>
      </Pressable>

      <Pressable onPress={() => router.back()} style={styles.linkBtn}>
        <Text style={styles.link}>{en ? 'Maybe later' : 'Belki sonra'}</Text>
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
    marginTop: theme.spacing.xl,
  },
  subtitle: {
    fontSize: theme.typography.body,
    color: theme.colors.subtext,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  plan: {
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
  },
  planTitle: { fontSize: theme.typography.subtitle, fontWeight: '600', color: theme.colors.text },
  planPrice: { color: theme.colors.subtext, marginTop: 4 },
  btn: {
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  primary: { backgroundColor: theme.colors.primary, opacity: 0.6 },
  btnPrimaryText: {
    color: theme.colors.primaryFg,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
  linkBtn: { paddingVertical: 12, alignItems: 'center', marginTop: theme.spacing.sm },
  link: { color: theme.colors.primary, fontSize: theme.typography.body },
});
