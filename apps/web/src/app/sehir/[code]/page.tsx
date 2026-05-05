import { notFound } from 'next/navigation';
import Link from 'next/link';
import { publicApi } from '@/lib/api';

interface Props {
  params: Promise<{ code: string }>;
}

export const revalidate = 300; // ISR: re-render at most every 5 min

export async function generateMetadata({ params }: Props) {
  const { code } = await params;
  const cu = code.toUpperCase();
  return {
    title: `${cu === 'IST' ? 'İstanbul' : 'Ankara'} hatları — App-Bus`,
    description: `Tüm aktif toplu taşıma hatları ve durakları.`,
  };
}

export default async function CityPage({ params }: Props) {
  const { code } = await params;
  const cu = code.toUpperCase();
  if (cu !== 'IST' && cu !== 'ANK') notFound();

  const routes = await publicApi.listRoutes(cu as 'IST' | 'ANK', { limit: 50 });

  return (
    <main style={styles.main}>
      <h1>{cu === 'IST' ? 'İstanbul' : 'Ankara'}</h1>
      <h2>Aktif hatlar ({routes.items.length})</h2>
      <ul style={styles.ul}>
        {routes.items.map((r) => (
          <li key={r.id} style={styles.li}>
            <Link href={`/hat/${r.id}`}>
              <span style={styles.code}>{r.code}</span>
              <span style={styles.name}>{r.name_tr}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { maxWidth: 960, margin: '0 auto', padding: '2rem 1.5rem' },
  ul: { listStyle: 'none', padding: 0 },
  li: { padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' },
  code: {
    display: 'inline-block',
    minWidth: 64,
    padding: '2px 8px',
    background: 'var(--color-primary)',
    color: '#fff',
    borderRadius: 4,
    fontWeight: 700,
    marginRight: 12,
  },
  name: { color: 'var(--color-text)' },
};
