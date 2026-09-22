export function ListSkeleton() {
  return (
    <div aria-label="Loading leads…" role="status" className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-5">
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div aria-label="Loading…" role="status" className="mx-auto w-full max-w-content px-4 py-8 md:px-8">
      <div className="h-[22px] w-40 animate-pulse rounded bg-muted" />
      <div className="mt-5 h-9 w-full max-w-[320px] animate-pulse rounded-md bg-muted" />
      <div className="mt-6 flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[52px] animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
