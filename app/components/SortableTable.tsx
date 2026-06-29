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
  const displayData = pageSize ? sortedData.slice(clampedPage * pageSize, (clampedPage + 1) * pageSize) : sortedData;

  if (clampedPage !== currentPage) setCurrentPage(clampedPage);

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
      {pageSize && totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-border">
          <span className="text-sm text-foreground/60">
            {clampedPage * pageSize + 1}–{Math.min((clampedPage + 1) * pageSize, sortedData.length)} of {sortedData.length}
          </span>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 text-sm border border-border hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={clampedPage === 0}
              onClick={() => setCurrentPage(clampedPage - 1)}
            >
              Prev
            </button>
            <button
              className="px-3 py-1 text-sm border border-border hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={clampedPage >= totalPages - 1}
              onClick={() => setCurrentPage(clampedPage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
