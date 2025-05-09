import React, { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: ReactNode;
  icon: ReactNode;
  loading?: boolean;
}

export default function StatCard({ title, value, icon, loading = false }: StatCardProps) {
  if (loading) {
    return (
      <div className="bg-background p-4 shadow-md border border-border h-full">
        <div className="flex items-start mb-2">
          <div className="mr-2 text-accent-3">{icon}</div>
          <h3 className="text-sm font-medium text-accent-2">{title}</h3>
        </div>
        <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="bg-background p-4 shadow-md border border-border h-full">
      <div className="flex items-start mb-2">
        <div className="mr-2 text-accent-3">{icon}</div>
        <h3 className="text-sm font-medium text-accent-2">{title}</h3>
      </div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
} 