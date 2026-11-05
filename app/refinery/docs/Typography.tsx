import type { ReactNode } from 'react';

// Inline unit label: keeps abbreviations like PHd/THd visually separate from
// prose without adding a box.
export function Unit({ children }: { children: ReactNode }) {
  return (
    <span className="mx-0.5 whitespace-nowrap text-[0.9em] font-semibold tracking-[0.08em] text-foreground">
      {children}
    </span>
  );
}

// Key term emphasis for the glossary-style definitions.
export function Term({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>;
}

// Tabular figures with extra weight for numeric values in running text.
export function Num({ children }: { children: ReactNode }) {
  return (
    <span className="whitespace-nowrap font-semibold tabular-nums text-foreground">
      {children}
    </span>
  );
}
