"use client";

interface InfoCardProps {
  label: string;
  value: string;
  isMono?: boolean;
  className?: string;
  copyable?: boolean;
  children?: React.ReactNode;
}

export default function InfoCard({ 
  label, 
  value, 
  isMono = false, 
  className = "", 
  copyable = true,
  children 
}: InfoCardProps) {
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className={`bg-foreground/5 border border-border p-3 ${className}`}>
      <div className="text-xs font-medium text-accent-2 mb-2">{label}</div>
      {children || (
        <div 
          className={`${isMono ? 'font-mono text-sm' : 'text-base'} ${
            copyable ? 'cursor-pointer hover:bg-foreground/10 transition-colors p-1' : 'p-1'
          } break-all`}
          onClick={copyable ? () => copyToClipboard(value) : undefined}
          title={copyable ? "Click to copy" : undefined}
        >
          {value}
        </div>
      )}
    </div>
  );
}
