import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-gray-200 text-center shadow-sm">
        <span className="text-4xl font-extrabold text-indigo-600">404</span>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Page Not Found</h1>
        <p className="text-sm text-gray-500 mt-1">
          The page you are looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

