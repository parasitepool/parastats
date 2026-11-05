'use client';

import type { ReactNode } from 'react';
import { useState, useMemo } from 'react';

interface Column<T> {
  key: keyof T;
  header: string;
  render?: (value: T[keyof T], item: T) => ReactNode;
}

interface SortableTableProps<T> {
  data: T[];
  columns: Column<T>[];
  defaultSortColumn?: keyof T;
  defaultSortDirection?: 'asc' | 'desc';
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T) => string;
  className?: string;
  pageSize?: number;
  page?: number;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void | Promise<void>;
  onLoadPrevious?: () => void | Promise<void>;
  total?: number | null;
}

export default function SortableTable<T>({
  data,
  columns,
  defaultSortColumn,
  defaultSortDirection = 'asc',
  onRowClick,
  rowClassName,
  className = '',
  pageSize,
  page: controlledPage,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onLoadPrevious,
  total = null,
}: SortableTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<keyof T | undefined>(defaultSortColumn);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultSortDirection);
  const [currentPage, setCurrentPage] = useState(0);

  const handleSort = (column: keyof T) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => [...data].sort((a, b) => {
    if (!sortColumn) return 0;

    const aValue = a[sortColumn];
    const bValue = b[sortColumn];

    if (aValue === bValue) return 0;
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    const comparison = String(aValue).localeCompare(String(bValue), undefined, { numeric: true });
    return sortDirection === 'asc' ? comparison : -comparison;
  }), [data, sortColumn, sortDirection]);

  const totalPages = pageSize ? Math.ceil(sortedData.length / pageSize) : 1;
  const clampedPage = Math.min(currentPage, Math.max(0, totalPages - 1));
  const controlled = controlledPage !== undefined;
  const displayPage = controlledPage ?? clampedPage;
  const displayData = pageSize && !controlled
    ? sortedData.slice(clampedPage * pageSize, (clampedPage + 1) * pageSize)
    : sortedData;
  const atLastPage = controlled || clampedPage >= totalPages - 1;
  const canLoadMore = Boolean(atLastPage && hasMore && onLoadMore);
  const nextDisabled = loadingMore || (atLastPage && !canLoadMore);
  const loadedThrough = controlled && pageSize
    ? displayPage * pageSize + sortedData.length
    : sortedData.length;
  const totalForDisplay = total != null ? Math.max(total, loadedThrough) : loadedThrough;

  if (clampedPage !== currentPage) setCurrentPage(clampedPage);

  const handleNextPage = async () => {
    if (controlled) {
      await onLoadMore?.();
      return;
    }
    if (atLastPage && canLoadMore) {
      await onLoadMore?.();
    }
    setCurrentPage(clampedPage + 1);
  };

  const handlePreviousPage = async () => {
    if (controlled) {
      await onLoadPrevious?.();
      return;
    }
    setCurrentPage(clampedPage - 1);
  };

  const showPagination = pageSize && (
    controlled
      ? displayPage > 0 || (sortedData.length > 0 && hasMore)
      : sortedData.length > 0 && (totalPages > 1 || hasMore)
  );
  const rangeStart = displayData.length > 0 ? displayPage * (pageSize ?? sortedData.length) + 1 : 0;
  const rangeEnd = displayData.length > 0
    ? displayPage * (pageSize ?? sortedData.length) + displayData.length
    : 0;

  return (
    <div className={`overflow-x-auto w-full ${className}`}>
      <table className="w-full min-w-full divide-y divide-border">
        <thead className="bg-foreground">
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                scope="col"
                className="px-6 py-3 text-left text-sm text-background uppercase tracking-wider cursor-pointer hover:bg-foreground/90"
                onClick={() => handleSort(column.key)}
              >
                <div className="flex items-center">
                  {column.header}
                  {sortColumn === column.key && (
                    <span className="ml-2">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-background divide-y divide-border">
          {displayData.map((item, index) => (
            <tr
              key={index}
              className={`hover:bg-foreground/5 ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName ? rowClassName(item) : ''}`}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((column) => (
                <td key={String(column.key)} className="px-6 py-4 whitespace-nowrap">
                  {column.render
                    ? column.render(item[column.key], item)
                    : String(item[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {showPagination && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-border">
          <span className="text-sm text-foreground/60">
            {rangeStart}–{rangeEnd} of {totalForDisplay}{total == null && hasMore ? '+' : ''}
          </span>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 text-sm border border-border hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={displayPage === 0 || loadingMore || (controlled && !onLoadPrevious)}
              onClick={handlePreviousPage}
            >
              Prev
            </button>
            <button
              className="px-3 py-1 text-sm border border-border hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={nextDisabled}
              onClick={handleNextPage}
            >
              {loadingMore ? 'Loading…' : 'Next'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
