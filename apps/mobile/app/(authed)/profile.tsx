import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useAuth } from '@/features/auth/auth-context';
import { apiClient } from '@/shared/api';
import { theme } from '@/shared/theme';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const [biometric, setBiometric] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const onToggleBiometric = async (next: boolean) => {
    if (next && user.premium_tier !== 'premium') {
      // Premium gate — actual purchase flow lands in Phase 8.
      Alert.alert('Premium', 'Biometric unlock is available with Premium.');
      return;
    }
    if (next) {
      const has = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!has || !enrolled) {
        Alert.alert('Biometric', 'No biometric enrolled on this device.');
        return;
      }
      const { success } = await LocalAuthentication.authenticateAsync({
        promptMessage: t('profile.biometric_unlock'),
      });
      if (success) setBiometric(true);
    } else {
      setBiometric(false);
    }
  };

  const onDelete = () => {
    Alert.alert(t('profile.delete_account'), t('profile.delete_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.delete_confirm_yes'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await apiClient.deleteAccount();
            await signOut();
            router.replace('/auth/welcome');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const onExport = async () => {
    setBusy(true);
    try {
      const data = await apiClient.exportData();
      Alert.alert(t('profile.export_data'), JSON.stringify(data, null, 2).slice(0, 1024));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: theme.spacing.lg }}>
      <Text style={styles.title}>{t('profile.title')}</Text>

      <View style={styles.row}>
        <Text style={styles.label}>{t('profile.name')}</Text>
        <Text style={styles.value}>{user.name}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{t('profile.email')}</Text>
        <Text style={styles.value}>{user.email}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{t('profile.locale')}</Text>
        <Text style={styles.value}>{user.locale.toUpperCase()}</Text>
      </View>

      <View style={styles.toggleRow}>
        <Text style={styles.value}>{t('profile.biometric_unlock')}</Text>
        <Switch value={biometric} onValueChange={onToggleBiometric} />
      </View>

      <Pressable style={[styles.btn, styles.secondary]} onPress={onExport} disabled={busy}>
        <Text style={styles.btnSecondaryText}>{t('profile.export_data')}</Text>
      </Pressable>

      <Pressable
        style={[styles.btn, styles.secondary]}
        onPress={async () => {
          await signOut();
          router.replace('/auth/welcome');
        }}
        disabled={busy}
      >
        <Text style={styles.btnSecondaryText}>{t('profile.logout')}</Text>
      </Pressable>

      <Pressable style={[styles.btn, styles.danger]} onPress={onDelete} disabled={busy}>
        <Text style={styles.btnDangerText}>{t('profile.delete_account')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  title: {
    fontSize: theme.typography.title,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  label: { color: theme.colors.subtext, fontSize: theme.typography.body },
  value: { color: theme.colors.text, fontSize: theme.typography.body, fontWeight: '500' },
  btn: {
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
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
  danger: { backgroundColor: theme.colors.danger },
  btnDangerText: { color: '#FFFFFF', fontSize: theme.typography.body, fontWeight: '600' },
});
