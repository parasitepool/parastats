import React, { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: ReactNode;
  icon: ReactNode;
  loading?: boolean;
  compact?: boolean;
}

export default function StatCard({
  title,
  value,
  icon,
  loading = false,
  compact = false,
}: StatCardProps) {
  const padding = compact ? 'py-2 px-3' : 'p-4';
  const headerSpacing = compact ? 'mb-1' : 'mb-2';
  const titleLeading = compact ? 'leading-tight' : '';
  const valueLeading = compact ? 'leading-tight' : '';

  if (loading) {
    return (
      <div className={`bg-background ${padding} shadow-md border border-border h-full`}>
        <div className={`flex items-start ${headerSpacing}`}>
          <div className="mr-2 text-accent-3">{icon}</div>
          <h3 className={`text-sm font-medium text-accent-2 ${titleLeading}`}>{title}</h3>
        </div>
        <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className={`bg-background ${padding} shadow-md border border-border h-full`}>
      <div className={`flex items-start ${headerSpacing}`}>
        <div className="mr-2 text-accent-3">{icon}</div>
        <h3 className={`text-sm font-medium text-accent-2 ${titleLeading}`}>{title}</h3>
      </div>
      <div className={`text-2xl font-semibold ${valueLeading}`}>{value}</div>
    </div>
  );
}
