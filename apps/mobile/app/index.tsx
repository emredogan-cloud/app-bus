import { StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { theme } from '@/shared/theme';

export default function HomeScreen() {
  const apiUrl = (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'unset';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>App-Bus</Text>
      <Text style={styles.subtitle}>Real-Time Public Transport Tracker</Text>
      <Text style={styles.meta}>Phase 0: skeleton</Text>
      <Text style={styles.meta}>API: {apiUrl}</Text>
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
  title: {
    fontSize: theme.typography.title,
    fontWeight: '700',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.typography.subtitle,
    marginTop: theme.spacing.sm,
    color: theme.colors.subtext,
  },
  meta: {
    marginTop: theme.spacing.xs,
    fontSize: theme.typography.caption,
    color: theme.colors.subtext,
  },
});
