import type { ReactNode } from 'react';

interface CardHeaderProps {
  title: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  titleClassName?: string;
}

export default function CardHeader({
  title,
  icon,
  action,
  className = '',
  titleClassName = 'text-xl sm:text-2xl font-bold',
}: CardHeaderProps) {
  return (
    <div className={`flex items-center justify-between ${className}`.trim()}>
      <div className="flex items-center">
        {icon && <div className="mr-2 text-accent-3">{icon}</div>}
        <h2 className={titleClassName}>{title}</h2>
      </div>
      {action}
    </div>
  );
}
