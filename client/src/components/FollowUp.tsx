import { formatShortDate, getFollowUpState } from "../lib/format";

export function FollowUp({ value }: { value: string | null }) {
  const state = getFollowUpState(value);
  if (state === "none") return <span className="text-[13px] text-content-tertiary">—</span>;
  if (state === "upcoming")
    return <span className="text-[13px] text-content-secondary tabular-nums">{formatShortDate(value)}</span>;
  const overdue = state === "overdue";
  return (
    <span className="inline-flex items-center gap-1">
      <span
        aria-hidden="true"
        className="inline-block h-[6px] w-[6px] rounded-full"
        style={{ backgroundColor: overdue ? "var(--danger)" : "var(--warning)" }}
      />
      <span
        className="text-xs font-medium"
        style={{ color: overdue ? "var(--danger)" : "var(--warning)" }}
      >
        {overdue ? "Overdue" : "Due today"}
      </span>
      <span className="text-[13px] text-content-secondary tabular-nums">{formatShortDate(value)}</span>
    </span>
  );
}
