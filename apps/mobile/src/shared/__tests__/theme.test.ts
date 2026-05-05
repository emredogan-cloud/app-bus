import { theme } from '../theme';

describe('theme tokens', () => {
  it('exposes consistent spacing scale', () => {
    expect(theme.spacing.xs).toBeLessThan(theme.spacing.sm);
    expect(theme.spacing.sm).toBeLessThan(theme.spacing.md);
    expect(theme.spacing.md).toBeLessThan(theme.spacing.lg);
  });

  it('uses hex colors', () => {
    Object.values(theme.colors).forEach((c) => {
      expect(c).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });
});
