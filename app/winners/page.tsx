import type { Metadata } from 'next';
import BlockWinnersTable from '@/app/components/BlockWinnersTable';
import { parseBlockParam } from '@/app/utils/winners';

export const metadata: Metadata = {
  title: '24h Shadow Block Winners — Parasite',
  description: 'Highest share winners from the last 24 hours of Bitcoin blocks.',
};

interface WinnersPageProps {
  searchParams: Promise<{ block?: string | string[] }>;
}

export default async function WinnersPage({ searchParams }: WinnersPageProps) {
  const { block } = await searchParams;

  return <BlockWinnersTable initialSelectedHeight={parseBlockParam(block)} />;
}
