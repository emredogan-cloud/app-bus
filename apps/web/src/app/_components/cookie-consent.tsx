'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'app-bus.cookie-consent.v1';

/**
 * KVKK + GDPR cookie consent. Sticky bottom bar; persists choice in localStorage.
 * Only "strictly necessary" cookies are set before consent.
 */
export function CookieConsent() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setShown(!localStorage.getItem(STORAGE_KEY));
  }, []);

  const accept = (mode: 'all' | 'necessary') => {
    localStorage.setItem(STORAGE_KEY, mode);
    setShown(false);
  };

  if (!shown) return null;

  return (
    <div style={styles.bar}>
      <p style={styles.text}>
        Bu site KVKK + GDPR çerçevesinde çerez kullanır. Kabul ederek tüm çerezleri
        etkinleştirebilir veya yalnızca zorunlu çerezleri kullanabilirsiniz.
      </p>
      <div style={styles.actions}>
        <button onClick={() => accept('necessary')} style={styles.btnSecondary}>
          Yalnızca zorunlu
        </button>
        <button onClick={() => accept('all')} style={styles.btnPrimary}>
          Tümünü kabul et
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '1rem 1.5rem',
    background: '#fff',
    borderTop: '1px solid var(--color-border)',
    boxShadow: '0 -4px 24px rgba(0,0,0,0.06)',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
    zIndex: 999,
  },
  text: { margin: 0, flex: 1, minWidth: 280, color: 'var(--color-text)', fontSize: '0.9rem' },
  actions: { display: 'flex', gap: '0.5rem' },
  btnPrimary: {
    padding: '0.5rem 1rem',
    background: 'var(--color-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: '0.5rem 1rem',
    background: '#fff',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    cursor: 'pointer',
  },
};
