import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-6xl font-bold text-[var(--accent-blue)]">404</div>
      <h1 className="text-xl font-semibold">Page Not Found</h1>
      <p className="max-w-md text-sm text-[var(--text-muted)]">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 rounded-md bg-[var(--accent-blue)]/15 px-4 py-2 text-sm font-medium text-[var(--accent-blue)] transition-colors hover:bg-[var(--accent-blue)]/25"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
