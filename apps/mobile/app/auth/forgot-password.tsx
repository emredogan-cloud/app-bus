import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '@/shared/api';
import { mapAuthError } from '@/features/auth/error-mapper';
import { theme } from '@/shared/theme';

const Schema = z.object({ email: z.string().email().toLowerCase() });
type FormData = z.infer<typeof Schema>;

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { control, handleSubmit, formState } = useForm<FormData>({
    resolver: zodResolver(Schema),
    defaultValues: { email: '' },
  });
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      await apiClient.forgotPassword(data.email);
      Alert.alert(t('auth.forgot.title'), t('auth.forgot.sent'), [
        { text: t('common.continue'), onPress: () => router.replace('/auth/login') },
      ]);
    } catch (err) {
      Alert.alert(t('common.error'), mapAuthError(err, t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth.forgot.title')}</Text>
      <Text style={styles.intro}>{t('auth.forgot.intro')}</Text>

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

      <Pressable
        style={[styles.btn, styles.primary, submitting && { opacity: 0.6 }]}
        onPress={handleSubmit(onSubmit)}
        disabled={submitting}
      >
        <Text style={styles.btnPrimaryText}>{t('auth.forgot.submit')}</Text>
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
    marginBottom: theme.spacing.sm,
  },
  intro: {
    color: theme.colors.subtext,
    fontSize: theme.typography.body,
    marginBottom: theme.spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    fontSize: theme.typography.body,
    color: theme.colors.text,
  },
  fieldErr: {
    color: theme.colors.danger,
    fontSize: theme.typography.caption,
    marginTop: theme.spacing.xs,
  },
  btn: {
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  primary: { backgroundColor: theme.colors.primary },
  btnPrimaryText: {
    color: theme.colors.primaryFg,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
});
