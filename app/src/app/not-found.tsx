import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-7xl font-extrabold text-accent-light mb-4">404</p>
        <h1 className="text-2xl font-extrabold tracking-tight mb-2">Page not found</h1>
        <p className="text-sm text-muted mb-8">
          This page doesn't exist or was moved. Head back to your dashboard.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 bg-accent hover:opacity-85 text-white font-semibold px-6 py-3 rounded-xl transition-opacity text-sm"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
