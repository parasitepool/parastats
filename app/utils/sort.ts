export type SortDirection = 'asc' | 'desc';

/**
 * Sorts a copy of `data` using the same comparison rules as SortableTable.
 * Numeric strings sort numerically and null/undefined values stay last.
 */
export function sortTableData<T>(
  data: readonly T[],
  column: keyof T | undefined,
  direction: SortDirection,
): T[] {
  if (!column) return [...data];

  return [...data].sort((a, b) => {
    const aValue = a[column];
    const bValue = b[column];

    if (aValue === bValue) return 0;
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    const comparison = String(aValue).localeCompare(String(bValue), undefined, { numeric: true });
    return direction === 'asc' ? comparison : -comparison;
  });
}
