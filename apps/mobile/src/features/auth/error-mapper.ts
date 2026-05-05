import { ApiError, NetworkError } from '@app-bus/api-client';
import type { TFunction } from 'i18next';

/** Translate an ApiError / NetworkError into a user-facing string. */
export function mapAuthError(err: unknown, t: TFunction): string {
  if (err instanceof ApiError) {
    const code = err.problem.code;
    if (code && (`auth.errors.${code}` as string)) {
      const tr = t(`auth.errors.${code}`, { defaultValue: '' });
      if (tr) return tr;
    }
    return err.problem.detail ?? t('common.error');
  }
  if (err instanceof NetworkError) return t('auth.errors.network');
  return t('common.error');
}
