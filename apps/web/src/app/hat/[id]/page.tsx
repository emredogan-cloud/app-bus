import { notFound } from 'next/navigation';
import { publicApi } from '@/lib/api';

interface Props {
  params: Promise<{ id: string }>;
}

export const revalidate = 300;

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  try {
    const route = await publicApi.getRoute(id);
    return {
      title: `${route.code} — ${route.name_tr} | App-Bus`,
      description: `Hat detayları, durak listesi ve canlı geliş süreleri.`,
    };
  } catch {
    return { title: 'Hat — App-Bus' };
  }
}

export default async function RoutePage({ params }: Props) {
  const { id } = await params;
  const route = await publicApi.getRoute(id).catch(() => null);
  if (!route) notFound();

  return (
    <main style={styles.main}>
      <h1>
        <span style={styles.badge}>{route.code}</span>
        {route.name_tr}
      </h1>
      <p style={styles.meta}>Mod: {route.mode}</p>

      <p style={styles.hint}>
        Bu hattın canlı haritası ve geliş süreleri için <a href="/">App-Bus mobil uygulamasını</a>{' '}
        indirin.
      </p>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem' },
  badge: {
    display: 'inline-block',
    minWidth: 64,
    padding: '4px 10px',
    background: 'var(--color-primary)',
    color: '#fff',
    borderRadius: 4,
    fontWeight: 700,
    marginRight: 12,
  },
  meta: { color: 'var(--color-subtext)' },
  hint: { marginTop: '2rem', color: 'var(--color-subtext)' },
};
