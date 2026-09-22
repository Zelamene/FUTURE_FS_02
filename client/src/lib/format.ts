export type LeadStatus = "new" | "contacted" | "converted" | "lost";
export type LeadSource = "contact-form" | "referral" | "whatsapp" | "other";

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  source: LeadSource;
  status: LeadStatus;
  followUpDate: string | null;
  lastContactedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  leadId: string;
  authorId: string | null;
  source: string | null;
  body: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  leadId: string;
  actorId: string | null;
  type: "lead_created" | "lead_updated" | "status_changed" | "follow_up_set" | "note_added";
  meta: any;
  createdAt: string;
}

export interface LeadDetail extends Lead {
  notes: Note[];
  activity: Activity[];
}

export interface LeadListResponse {
  data: Lead[];
  total: number;
  limit: number;
  offset: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[d.getMonth()]}`;
}

export function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type FollowUpState = "overdue" | "today" | "upcoming" | "none";

export function getFollowUpState(iso: string | null, now = new Date()): FollowUpState {
  if (!iso) return "none";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "none";
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  if (day.getTime() < startOfToday.getTime()) return "overdue";
  if (day.getTime() === startOfToday.getTime()) return "today";
  return "upcoming";
}

export function describeActivity(a: Activity): string {
  const meta = a.meta ?? {};
  switch (a.type) {
    case "lead_created":
      return meta.source ? `Lead created from ${meta.source}` : "Lead created";
    case "lead_updated":
      return Array.isArray(meta.fields) && meta.fields.length > 0
        ? `Updated ${meta.fields.join(", ")}`
        : "Lead updated";
    case "status_changed":
      return `Status changed from ${meta.from ?? "—"} to ${meta.to ?? "—"}`;
    case "follow_up_set":
      return meta.to ? `Follow-up set for ${formatShortDate(meta.to)}` : "Follow-up cleared";
    case "note_added":
      return "Note added";
    default:
      return "Activity recorded";
  }
}
