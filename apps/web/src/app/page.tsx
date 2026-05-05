import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={styles.main}>
      <h1 style={styles.title}>App-Bus</h1>
      <p style={styles.subtitle}>Real-Time Public Transport Tracker for Türkiye</p>
      <p>
        Open the mobile app to track buses, metros, trams, and ferries live in Istanbul and Ankara.
        Or browse stops + routes here → <Link href="/sehir/IST">Istanbul</Link> ·{' '}
        <Link href="/sehir/ANK">Ankara</Link>
      </p>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { maxWidth: 720, margin: '0 auto', padding: '4rem 1.5rem' },
  title: { fontSize: '2.5rem', margin: '0 0 0.5rem' },
  subtitle: { fontSize: '1.125rem', color: 'var(--color-subtext)' },
};
