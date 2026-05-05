/**
 * Format an ETA second-count for display.
 *   <60s  → "Now"
 *   <60min → "X min"
 *   ≥60min → "HH:MM"
 */
export function formatEta(seconds: number, etaUnix: number, locale: 'tr' | 'en'): string {
  if (seconds <= 60) return locale === 'tr' ? 'Şimdi' : 'Now';
  if (seconds < 60 * 60) {
    const m = Math.round(seconds / 60);
    return locale === 'tr' ? `${m} dk` : `${m} min`;
  }
  const d = new Date(etaUnix * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function etaColor(seconds: number): 'urgent' | 'soon' | 'normal' {
  if (seconds < 120) return 'urgent';
  if (seconds < 300) return 'soon';
  return 'normal';
}
