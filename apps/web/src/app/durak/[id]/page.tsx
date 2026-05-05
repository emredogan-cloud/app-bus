import { notFound } from 'next/navigation';
import { publicApi } from '@/lib/api';

interface Props {
  params: Promise<{ id: string }>;
}

export const revalidate = 300;

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  try {
    const stop = await publicApi.getStop(id);
    return {
      title: `${stop.name_tr} durağı — App-Bus`,
      description: `Canlı geliş süreleri, geçen hatlar ve harita.`,
      openGraph: {
        title: stop.name_tr,
        description: 'Canlı geliş süreleri için App-Bus',
        type: 'website',
      },
    };
  } catch {
    return { title: 'Durak — App-Bus' };
  }
}

export default async function StopPage({ params }: Props) {
  const { id } = await params;
  const stop = await publicApi.getStop(id).catch(() => null);
  if (!stop) notFound();

  return (
    <main style={styles.main}>
      <h1>{stop.name_tr}</h1>
      <p style={styles.coords}>
        {stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}
      </p>

      <h2>Geçen hatlar</h2>
      <ul style={styles.ul}>
        {stop.lines.map((l, i) => (
          <li key={`${l.route.id}-${i}`} style={styles.li}>
            <span style={styles.code}>{l.route.code}</span>
            <span>{l.route.name_tr}</span>
            <span style={styles.dir}>· {l.direction === 'outbound' ? 'Gidiş' : 'Dönüş'}</span>
          </li>
        ))}
      </ul>

      <p style={styles.hint}>
        Canlı ETA için <a href="/">App-Bus mobil uygulaması</a> indirin.
      </p>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Place',
            name: stop.name_tr,
            geo: { '@type': 'GeoCoordinates', latitude: stop.lat, longitude: stop.lng },
          }),
        }}
      />
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem' },
  coords: { color: 'var(--color-subtext)' },
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
  dir: { color: 'var(--color-subtext)', marginLeft: 8 },
  hint: { marginTop: '2rem', color: 'var(--color-subtext)' },
};
