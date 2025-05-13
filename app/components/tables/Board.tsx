'use client';

import { ReactNode, useRef, useState, useEffect } from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '../icons';

export interface BoardColumn<T> {
  key: keyof T;
  header: string;
  align?: 'left' | 'right';
  render?: (value: unknown, item: T) => React.ReactNode;
}

interface BoardProps<T> {
  title: string | ReactNode;
  data: T[];
  columns: BoardColumn<T>[];
  timeRange?: {
    current: string;
    options: string[];
    onChange: (range: string) => void;
  };
  isLoading?: boolean;
}

export default function Board<T extends { id: number; rank?: number }>({
  title,
  data,
  columns,
  timeRange,
  isLoading
}: BoardProps<T>) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScroll = () => {
    if (tableRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = tableRef.current;
      setCanScrollUp(scrollTop > 0);
      setCanScrollDown(scrollTop < scrollHeight - clientHeight - 1); // -1 to account for rounding
    }
  };

  useEffect(() => {
    checkScroll();
  }, [data]);

  if (isLoading) {
    return (
      <div className="bg-background p-6 shadow-md border border-border">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">{title}</h2>
        </div>
        <div className="h-[450px] flex items-center justify-center">
          <div className="text-foreground/60">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background p-6 shadow-md border border-border">
      <div className="flex flex-col md:flex-row justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">{title}</h2>
        {timeRange && (
          <div className="flex space-x-2">
            {timeRange.options.map((option) => (
              <button
                key={option}
                onClick={() => timeRange.onChange(option)}
                className={`px-3 py-1 transition-colors cursor-pointer ${
                  timeRange.current === option 
                    ? 'bg-foreground text-background' 
                    : 'bg-secondary text-foreground/80 hover:bg-primary-hover hover:text-foreground'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="relative">
        <div 
          ref={tableRef}
          onScroll={checkScroll}
          className="overflow-y-auto h-[450px] relative scrollbar-thin scrollbar-thumb-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-foreground/30"
        >
          <table className="w-full">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b border-border">
                <th className="px-2 sm:px-4 py-2 text-left text-sm font-medium text-accent-2 uppercase tracking-wider">
                  #
                </th>
                {columns.map((column) => (
                  <th 
                    key={column.key.toString()}
                    className={`px-2 sm:px-4 py-2 text-${column.align || 'left'} text-sm font-medium text-accent-2 uppercase tracking-wider`}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((item, index) => (
                <tr 
                  key={item.id} 
                  className="hover:bg-foreground/5 transition-colors"
                >
                  <td className="px-2 sm:px-4 py-2 whitespace-nowrap">
                    <div className="flex items-center">
                      {item.rank && item.rank <= 3 ? (
                        <div className={`
                          inline-flex items-center justify-center font-bold text-sm
                          ${
                            item.rank === 1 ? 'bg-accent-1 text-foreground' : 
                            item.rank === 2 ? 'bg-accent-2 text-foreground' : 
                            'bg-accent-3 text-foreground'
                          }
                        `}>
                          {item.rank}
                        </div>
                      ) : (
                        <div className="inline-flex items-center justify-center text-foreground/80">
                          {item.rank || index + 1}
                        </div>
                      )}
                    </div>
                  </td>
                  {columns.map((column) => (
                    <td 
                      key={column.key.toString()}
                      className={`px-2 sm:px-4 py-3 whitespace-nowrap text-sm ${column.align === 'right' ? 'text-right' : ''} text-foreground font-mono`}
                    >
                      {column.render 
                        ? column.render(item[column.key], item)
                        : item[column.key] as ReactNode}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="absolute right-1 bottom-0 flex flex-col gap-1 opacity-50">
          {canScrollUp && (
            <button 
              onClick={() => tableRef.current?.scrollBy({ top: -100, behavior: 'smooth' })}
              className="p-1 rounded-full bg-background border border-border shadow-md hover:bg-foreground/5 transition-colors"
              aria-label="Scroll up"
            >
              <ChevronUpIcon className="h-4 w-4 text-foreground/60" />
            </button>
          )}
          {canScrollDown && (
            <button 
              onClick={() => tableRef.current?.scrollBy({ top: 100, behavior: 'smooth' })}
              className="p-1 rounded-full bg-background border border-border shadow-md hover:bg-foreground/5 transition-colors"
              aria-label="Scroll down"
            >
              <ChevronDownIcon className="h-4 w-4 text-foreground/60" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
