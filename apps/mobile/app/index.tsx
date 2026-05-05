import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import { useAuth } from '@/features/auth/auth-context';
import { theme } from '@/shared/theme';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const apiUrl = (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'unset';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('app.name')}</Text>
      <Text style={styles.subtitle}>{t('app.tagline')}</Text>
      {user && (
        <Text style={styles.greeting}>
          {user.name} ({user.email})
        </Text>
      )}
      <Text style={styles.meta}>API: {apiUrl}</Text>

      <Link href="/(authed)/profile" asChild>
        <Pressable style={styles.btn}>
          <Text style={styles.btnText}>{t('profile.title')}</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
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
  meta: {
    marginTop: theme.spacing.xs,
    fontSize: theme.typography.caption,
    color: theme.colors.subtext,
  },
  btn: {
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
  },
  btnText: { color: theme.colors.primaryFg, fontWeight: '600' },
});
