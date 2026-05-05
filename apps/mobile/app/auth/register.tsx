import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterRequestSchema, type RegisterRequest } from '@app-bus/types';
import { apiClient } from '@/shared/api';
import { useAuth } from '@/features/auth/auth-context';
import { mapAuthError } from '@/features/auth/error-mapper';
import { theme } from '@/shared/theme';

// Form fields type — covers what the user enters before KVKK acceptance.
// `kvkk_consent_version` and `locale` are filled in here as defaults.
type FormFields = {
  email: string;
  password: string;
  name: string;
  locale: 'tr' | 'en';
  kvkk_consent_version: string;
};

export default function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const { setUser } = useAuth();
  const { control, handleSubmit, formState } = useForm<FormFields>({
    resolver: zodResolver(RegisterRequestSchema) as never,
    defaultValues: {
      email: '',
      password: '',
      name: '',
      locale: i18n.language === 'en' ? 'en' : 'tr',
      kvkk_consent_version: 'pending', // filled in by KVKK screen on confirm
    },
  });
  const [submitting, setSubmitting] = useState(false);

  // Pattern: this screen collects email/name/password, then routes to /auth/kvkk-consent
  // which (on accept) calls back here with the version + marketing flag, then we POST.
  const onSubmit = (data: FormFields) => {
    router.push({
      pathname: '/auth/kvkk-consent',
      params: { pending: JSON.stringify(data) },
    });
  };

  // (kvkk-consent navigates back with finalize callback: see kvkk-consent.tsx)
  const finalizeFromKvkk = async (data: RegisterRequest, marketingOptIn: boolean) => {
    setSubmitting(true);
    try {
      const res = await apiClient.register({ ...data, marketing_opt_in: marketingOptIn });
      setUser(res.user);
      router.replace('/');
    } catch (err) {
      Alert.alert(t('common.error'), mapAuthError(err, t));
    } finally {
      setSubmitting(false);
    }
  };

  // Expose finalize so the KVKK screen can call it via global event bus.
  // For Phase 1 we keep it simple: persist to module scope.
  registerFinalizer = finalizeFromKvkk;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth.register.title')}</Text>

      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextInput
            style={styles.input}
            placeholder={t('auth.register.name')}
            value={field.value}
            onChangeText={field.onChange}
            autoCapitalize="words"
            textContentType="name"
          />
        )}
      />
      {formState.errors.name && (
        <Text style={styles.fieldErr}>{formState.errors.name.message}</Text>
      )}

      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextInput
            style={styles.input}
            placeholder={t('auth.register.email')}
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
            placeholder={t('auth.register.password')}
            value={field.value}
            onChangeText={field.onChange}
            secureTextEntry
            textContentType="newPassword"
          />
        )}
      />
      {formState.errors.password && (
        <Text style={styles.fieldErr}>{formState.errors.password.message}</Text>
      )}

      <Pressable
        style={[styles.btn, styles.primary, submitting && { opacity: 0.6 }]}
        onPress={handleSubmit(onSubmit)}
        disabled={submitting}
      >
        <Text style={styles.btnPrimaryText}>{t('auth.register.submit')}</Text>
      </Pressable>

      <Link href="/auth/login" asChild>
        <Pressable style={styles.linkBtn}>
          <Text style={styles.linkText}>{t('auth.register.have_account')}</Text>
        </Pressable>
      </Link>
    </View>
  );
}

// In-memory finalizer pointer — set by Register screen, called by KVKK screen.
// Acceptable for Phase 1: KVKK screen always navigates back to register flow context.
export let registerFinalizer:
  | ((data: RegisterRequest, marketingOptIn: boolean) => Promise<void>)
  | null = null;

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
