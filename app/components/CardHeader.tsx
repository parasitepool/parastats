import Link from 'next/link';
import type { ReactNode } from 'react';

interface CardHeaderProps {
  title: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  href?: string;
  className?: string;
  titleClassName?: string;
}

export default function CardHeader({
  title,
  icon,
  action,
  href,
  className = '',
  titleClassName = 'text-xl sm:text-2xl font-bold',
}: CardHeaderProps) {
  const heading = (
    <>
      {icon && <span className="mr-2 text-accent-3">{icon}</span>}
      <h2 className={titleClassName}>{title}</h2>
    </>
  );

  return (
    <div className={`flex items-center justify-between ${className}`.trim()}>
      {href ? (
        <Link href={href} className="flex items-center transition-colors hover:text-accent-3">
          {heading}
        </Link>
      ) : (
        <div className="flex items-center">{heading}</div>
      )}
      {action}
    </div>
  );
}
