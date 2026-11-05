import type { Metadata } from 'next';
import EndpointsSection from './EndpointsSection';
import ExamplesSection from './ExamplesSection';
import OverviewSection from './OverviewSection';

export const metadata: Metadata = {
  title: 'Refinery Docs',
  description:
    'Public API for the Parasite Refinery hashrate router: order book, order details, and order creation.',
};

export default function RefineryDocsPage() {
  return (
    <>
      <OverviewSection />
      <EndpointsSection />
      <ExamplesSection />
    </>
  );
}
