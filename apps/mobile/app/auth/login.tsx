import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginRequestSchema, type LoginRequest } from '@app-bus/types';
import { apiClient } from '@/shared/api';
import { useAuth } from '@/features/auth/auth-context';
import { mapAuthError } from '@/features/auth/error-mapper';
import { theme } from '@/shared/theme';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { setUser } = useAuth();
  const { control, handleSubmit, formState } = useForm<LoginRequest>({
    resolver: zodResolver(LoginRequestSchema),
    defaultValues: { email: '', password: '' },
  });
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (data: LoginRequest) => {
    setSubmitting(true);
    try {
      const res = await apiClient.login(data);
      setUser(res.user);
      router.replace('/');
    } catch (err) {
      Alert.alert(t('common.error'), mapAuthError(err, t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth.login.title')}</Text>

      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextInput
            style={styles.input}
            placeholder={t('auth.login.email')}
            value={field.value}
            onChangeText={field.onChange}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
          />
        )}
      />
      {formState.errors.email && (
        <Text style={styles.fieldErr}>{formState.errors.email.message}</Text>
      )}

      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextInput
            style={styles.input}
            placeholder={t('auth.login.password')}
            value={field.value}
            onChangeText={field.onChange}
            secureTextEntry
            textContentType="password"
          />
        )}
      />

      <Pressable
        style={[styles.btn, styles.primary, submitting && { opacity: 0.6 }]}
        onPress={handleSubmit(onSubmit)}
        disabled={submitting}
      >
        <Text style={styles.btnPrimaryText}>{t('auth.login.submit')}</Text>
      </Pressable>

      <Link href="/auth/forgot-password" asChild>
        <Pressable style={styles.linkBtn}>
          <Text style={styles.linkText}>{t('auth.login.forgot')}</Text>
        </Pressable>
      </Link>
      <Link href="/auth/register" asChild>
        <Pressable style={styles.linkBtn}>
          <Text style={styles.linkText}>{t('auth.login.no_account')}</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: theme.spacing.lg, backgroundColor: theme.colors.background },
  title: {
    fontSize: theme.typography.title,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.sm,
    fontSize: theme.typography.body,
    color: theme.colors.text,
  },
  fieldErr: {
    color: theme.colors.danger,
    fontSize: theme.typography.caption,
    marginBottom: theme.spacing.sm,
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
  linkBtn: { paddingVertical: 12, alignItems: 'center' },
  linkText: { color: theme.colors.primary, fontSize: theme.typography.body },
});
