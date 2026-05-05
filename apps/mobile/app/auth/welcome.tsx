import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { theme } from '@/shared/theme';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }} />
      <Text style={styles.title}>{t('auth.welcome.title')}</Text>
      <Text style={styles.subtitle}>{t('auth.welcome.subtitle')}</Text>
      <View style={{ flex: 1 }} />
      <Link href="/auth/register" asChild>
        <Pressable style={[styles.btn, styles.primary]}>
          <Text style={styles.btnPrimaryText}>{t('auth.welcome.register')}</Text>
        </Pressable>
      </Link>
      <Link href="/auth/login" asChild>
        <Pressable style={[styles.btn, styles.secondary]}>
          <Text style={styles.btnSecondaryText}>{t('auth.welcome.login')}</Text>
        </Pressable>
      </Link>
      {/* OAuth buttons land in Phase 1 follow-up — bind to expo-auth-session + apple auth */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: theme.spacing.lg, backgroundColor: theme.colors.background },
  title: { fontSize: theme.typography.title, fontWeight: '700', color: theme.colors.text },
  subtitle: {
    fontSize: theme.typography.subtitle,
    color: theme.colors.subtext,
    marginTop: theme.spacing.sm,
  },
  btn: {
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  primary: { backgroundColor: theme.colors.primary },
  btnPrimaryText: {
    color: theme.colors.primaryFg,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
  secondary: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  btnSecondaryText: {
    color: theme.colors.text,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
});
