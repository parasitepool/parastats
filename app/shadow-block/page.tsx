import type { Metadata } from 'next';
import ShadowBlockTopDiffsTable from '@/app/components/ShadowBlockTopDiffsTable';
import { parseBlockParam } from '@/app/utils/shadow-block';

export const metadata: Metadata = {
  title: '24h Shadow Block Top Diffs — Parasite',
  description: 'Highest public share difficulty per Bitcoin block over the last 24 hours.',
};

interface ShadowBlockPageProps {
  searchParams: Promise<{ block?: string | string[] }>;
}

export default async function ShadowBlockPage({ searchParams }: ShadowBlockPageProps) {
  const { block } = await searchParams;

  return <ShadowBlockTopDiffsTable initialSelectedHeight={parseBlockParam(block)} />;
}
