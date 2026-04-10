import type { MouseEvent } from 'react';

export const collapsedCardClassName = 'min-h-[72px] sm:min-h-[88px] flex flex-col justify-center';

export function getCollapsibleContainerClassName(
  baseClassName: string,
  collapsed: boolean,
  clickable: boolean,
): string {
  return [
    baseClassName,
    collapsed ? collapsedCardClassName : '',
    clickable ? 'cursor-pointer' : '',
  ].filter(Boolean).join(' ');
}

export function shouldToggleCollapse(
  event: MouseEvent<HTMLElement>,
  extraIgnoreSelector = '',
): boolean {
  const target = event.target;

  if (!(target instanceof Element)) {
    return false;
  }

  const ignoreSelector = ['button', 'input', 'textarea', 'a', extraIgnoreSelector]
    .filter(Boolean)
    .join(', ');

  return !target.closest(ignoreSelector);
}
