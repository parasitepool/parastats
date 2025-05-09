import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
      <p className="text-lg mb-8">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="px-4 py-2 bg-background text-foreground hover:bg-muted transition-colors"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
