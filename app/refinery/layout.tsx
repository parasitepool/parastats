import type { ReactNode } from 'react';
import RefineryShell from './RefineryShell';

export default function RefineryLayout({ children }: { children: ReactNode }) {
  return <RefineryShell>{children}</RefineryShell>;
}
