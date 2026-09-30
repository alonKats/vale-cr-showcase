import type { Metadata } from 'next';

import { ResultsScreen } from '@/components/ResultsScreen';
import { SITE_NAME } from '@/lib/seo';
import { buildStats } from '@/lib/stats.server';

export const metadata: Metadata = {
  title: `Buscar — ${SITE_NAME}`,
};

export default function Buscar() {
  return <ResultsScreen stats={buildStats()} />;
}
