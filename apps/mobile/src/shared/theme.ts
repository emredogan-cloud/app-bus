/**
 * Design tokens — single source for spacing, color, type.
 * Phase 0 baseline; refined in Phase 7 (hardening).
 */

export const colors = {
  background: '#FAFAFA',
  surface: '#FFFFFF',
  text: '#0F172A',
  subtext: '#475569',
  primary: '#0E7490',
  primaryFg: '#FFFFFF',
  border: '#E2E8F0',
  danger: '#DC2626',
  warning: '#F59E0B',
  success: '#16A34A',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const typography = {
  title: 32,
  subtitle: 18,
  body: 16,
  caption: 12,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 16,
  pill: 999,
} as const;

export const theme = {
  colors,
  spacing,
  typography,
  radius,
};

export type Theme = typeof theme;
