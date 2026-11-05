import type { ReactNode } from 'react';

// Boxed inline container for live data values, styled exactly like the base
// URL box in the Endpoints section.
export default function LiveDataBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <code
      className="whitespace-nowrap font-mono text-sm font-semibold tabular-nums bg-secondary border border-border px-1.5 py-0.5 text-foreground"
      title={title}
    >
      {children}
    </code>
  );
}
