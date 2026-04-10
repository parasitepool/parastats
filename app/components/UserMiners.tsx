'use client';

import Link from 'next/link';
import type { MouseEvent } from 'react';
import type { ProcessedWorkerData } from '@/app/api/user/[address]/route';
import { formatDifficulty, formatHashrate, formatRelativeTime, parseHashrate } from '@/app/utils/formatters';
import { PickaxeIcon } from '@/app/components/icons';
import { getCollapsibleContainerClassName, shouldToggleCollapse } from './collapsible';
import CardHeader from './CardHeader';
import SortableTable from './SortableTable';

interface UserMinersProps {
  workers?: ProcessedWorkerData[] | null;
  isLoading: boolean;
  collapsed: boolean;
  onToggle: () => void;
}

const columns = [
  {
    key: 'name' as const,
    header: 'Name',
    render: (value: ProcessedWorkerData['name']) => (
      <Link href="#" className="text-foreground font-bold hover:underline">
        {value}
      </Link>
    ),
  },
  {
    key: 'hashrate' as const,
    header: 'Hashrate',
    render: (value: ProcessedWorkerData['hashrate']) => formatHashrate(parseHashrate(value)),
  },
  {
    key: 'bestDifficulty' as const,
    header: 'Best Difficulty',
    render: (value: ProcessedWorkerData['bestDifficulty']) => formatDifficulty(value),
  },
  {
    key: 'lastSubmission' as const,
    header: 'Last Submission',
    render: (value: ProcessedWorkerData['lastSubmission']) => formatRelativeTime(parseInt(value)),
  },
];

export default function UserMiners({ workers, isLoading, collapsed, onToggle }: UserMinersProps) {
  const containerClassName = getCollapsibleContainerClassName(
    'w-full bg-background border border-border p-4 sm:p-6 shadow-md',
    collapsed,
    true,
  );

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!shouldToggleCollapse(event, '[data-collapse-ignore]')) {
      return;
    }

    onToggle();
  };

  return (
    <div className={containerClassName} onClick={handleClick}>
      <CardHeader
        title={isLoading ? 'Miners' : `Miners(${workers?.length || 0})`}
        icon={<PickaxeIcon />}
        className={collapsed ? '' : 'mb-4 sm:mb-6'}
        titleClassName="text-xl sm:text-2xl font-semibold"
      />

      {!collapsed && (
        <>
          <div className="hidden md:block" data-collapse-ignore>
            {isLoading ? (
              <div className="space-y-3">
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
            ) : workers ? (
              <SortableTable
                data={workers}
                columns={columns}
                defaultSortColumn="hashrate"
                defaultSortDirection="desc"
              />
            ) : null}
          </div>

          <div className="md:hidden space-y-4">
            {isLoading ? (
              <>
                <div className="bg-background border border-border p-4 shadow-sm space-y-3">
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
                <div className="bg-background border border-border p-4 shadow-sm space-y-3">
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
              </>
            ) : workers ? (
              workers.map(worker => (
                <div key={worker.id} className="bg-background border border-border p-4 shadow-sm">
                  <Link href="#" className="text-foreground font-bold text-lg block mb-2 hover:underline">
                    {worker.name}
                  </Link>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-500">Hashrate</p>
                      <p className="font-medium">{formatHashrate(parseHashrate(worker.hashrate))}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Best Difficulty</p>
                      <p className="font-medium">{formatDifficulty(worker.bestDifficulty)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Last Submission</p>
                      <p className="font-medium">{formatRelativeTime(parseInt(worker.lastSubmission))}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
