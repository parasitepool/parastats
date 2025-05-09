'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';

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
  className?: string;
}

export default function SortableTable<T>({
  data,
  columns,
  defaultSortColumn,
  defaultSortDirection = 'asc',
  onRowClick,
  className = ''
}: SortableTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<keyof T | undefined>(defaultSortColumn);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultSortDirection);

  const handleSort = (column: keyof T) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortColumn) return 0;
    
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];

    if (aValue === bValue) return 0;
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    const comparison = String(aValue).localeCompare(String(bValue), undefined, { numeric: true });
    return sortDirection === 'asc' ? comparison : -comparison;
  });

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
          {sortedData.map((item, index) => (
            <tr
              key={index}
              className={`hover:bg-foreground/5 ${onRowClick ? 'cursor-pointer' : ''}`}
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
    </div>
  );
}
