'use client';

import { useId, type ReactNode } from 'react';
import { InfoIcon } from './icons';

interface InfoHintProps {
  children: ReactNode;
  /** Extra classes for the tooltip bubble (e.g. a specific width). */
  tooltipClassName?: string;
}

/**
 * Info icon with a tooltip that is reachable by keyboard focus, not just
 * hover: the icon wrapper is focusable and described by the tooltip for
 * screen readers.
 */
export default function InfoHint({ children, tooltipClassName = '' }: InfoHintProps) {
  const tooltipId = useId();

  return (
    <span className="relative inline-flex group" tabIndex={0} aria-describedby={tooltipId}>
      <InfoIcon className="h-4 w-4 text-foreground/60 cursor-help" />
      <span
        id={tooltipId}
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-0 -translate-y-2 p-2 bg-background border border-border rounded shadow-lg text-xs font-normal text-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity z-10 ${tooltipClassName}`}
      >
        {children}
      </span>
    </span>
  );
}
