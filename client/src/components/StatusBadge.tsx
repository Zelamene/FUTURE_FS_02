import type { LeadStatus } from "../lib/format";

const LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  converted: "Converted",
  lost: "Lost",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className="inline-flex h-[22px] items-center rounded-full px-2 text-xs font-medium"
      style={badgeStyle(status)}
    >
      {LABELS[status]}
    </span>
  );
}

function badgeStyle(status: LeadStatus): React.CSSProperties {
  switch (status) {
    case "new":
      return { backgroundColor: "var(--neutral-subtle-bg)", color: "var(--text-secondary)" };
    case "contacted":
      return { backgroundColor: "var(--warning-subtle-bg)", color: "var(--warning)" };
    case "converted":
      return { backgroundColor: "var(--success-subtle-bg)", color: "var(--success)" };
    case "lost":
      return { backgroundColor: "var(--danger-subtle-bg)", color: "var(--danger)" };
  }
}
