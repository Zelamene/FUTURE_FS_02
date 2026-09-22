import { useSlowRequest } from "../lib/api";

export function SlowBanner() {
  const slow = useSlowRequest();
  if (!slow) return null;
  return (
    <div role="status" className="border-b border-border bg-surface px-4 py-2 text-center">
      <span className="text-[13px] text-content-secondary">Waking up the server…</span>
    </div>
  );
}
