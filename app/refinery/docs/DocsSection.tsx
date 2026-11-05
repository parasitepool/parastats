import type { ReactNode } from 'react';

export default function DocsSection({
  id,
  title,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className="scroll-mt-4 border border-border bg-background shadow-sm"
    >
      <summary className="flex cursor-pointer select-none items-center p-4 hover:bg-secondary-hover sm:p-6 list-none">
        <h2 className="text-xl font-semibold">{title}</h2>
      </summary>
      <div className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">{children}</div>
    </details>
  );
}
