import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-content-primary">Page not found</h1>
      <p className="mt-2 text-sm text-content-secondary">
        The page you are looking for does not exist.
      </p>
      <div className="mt-6">
        <Link
          to="/leads"
          className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Back to leads
        </Link>
      </div>
    </div>
  );
}
