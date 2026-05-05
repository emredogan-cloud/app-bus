import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/features/auth/auth-context';
import { theme } from '@/shared/theme';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={styles.title}>{t('app.name')}</Text>
        <Text style={styles.subtitle}>{t('app.tagline')}</Text>
        {user && (
          <Text style={styles.greeting}>
            {user.name} ({user.email})
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        <Link href="/(authed)/search" asChild>
          <Pressable style={[styles.btn, styles.primary]}>
            <Text style={styles.btnPrimaryText}>{t('transit.search.title')}</Text>
          </Pressable>
        </Link>
        <Link href="/(authed)/map" asChild>
          <Pressable style={[styles.btn, styles.secondary]}>
            <Text style={styles.btnSecondaryText}>{t('transit.map.coming_soon')}</Text>
          </Pressable>
        </Link>
        <Link href="/(authed)/profile" asChild>
          <Pressable style={[styles.btn, styles.secondary]}>
            <Text style={styles.btnSecondaryText}>{t('profile.title')}</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: theme.spacing.lg, backgroundColor: theme.colors.background },
  title: { fontSize: theme.typography.title, fontWeight: '700', color: theme.colors.text },
  subtitle: {
    fontSize: theme.typography.subtitle,
    marginTop: theme.spacing.sm,
    color: theme.colors.subtext,
  },
  greeting: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.body,
    color: theme.colors.text,
  },
  actions: { gap: theme.spacing.sm },
  btn: { paddingVertical: 14, borderRadius: theme.radius.md, alignItems: 'center' },
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
