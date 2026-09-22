import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, api } from "../lib/api";
import {
  describeActivity,
  formatShortDate,
  toDateInputValue,
  type LeadDetail,
  type LeadStatus,
} from "../lib/format";
import { StatusBadge } from "../components/StatusBadge";
import { FollowUp } from "../components/FollowUp";
import { PageSkeleton } from "../components/Skeletons";
import { DeleteModal } from "../components/DeleteModal";
import { useToast } from "../hooks/useToast";

const inputClass =
  "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-content-primary placeholder:text-content-tertiary focus:border-accent";
const labelClass = "mb-[6px] block text-xs font-medium text-content-secondary";
const STATUSES: LeadStatus[] = ["new", "contacted", "converted", "lost"];

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [noteBody, setNoteBody] = useState("");
  const [followUpDraft, setFollowUpDraft] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const detail = useQuery<LeadDetail>({
    queryKey: ["leads", id],
    queryFn: () => api.get<LeadDetail>(`/api/leads/${id}`),
    enabled: Boolean(id),
  });

  useEffect(() => {
    setNoteBody("");
    setFollowUpDraft(null);
    setDeleteOpen(false);
  }, [id]);

  const statusMutation = useMutation({
    mutationFn: (status: LeadStatus) => api.patch<LeadDetail>(`/api/leads/${id}`, { status }),
    onMutate: async (status) => {
      await queryClient.cancelQueries({ queryKey: ["leads", id] });
      const previous = queryClient.getQueryData<LeadDetail>(["leads", id]);
      if (previous) queryClient.setQueryData(["leads", id], { ...previous, status });
      return { previous };
    },
    onError: (err, _status, context: any) => {
      if (context?.previous) queryClient.setQueryData(["leads", id], context.previous);
      notify("Couldn't save changes. Try again.", "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["leads", id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const followUpMutation = useMutation({
    mutationFn: (followUpDate: string | null) =>
      api.patch<LeadDetail>(`/api/leads/${id}`, { followUpDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads", id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setFollowUpDraft(null);
      notify("Lead updated.", "success");
    },
    onError: () => notify("Couldn't save changes. Try again.", "error"),
  });

  const noteMutation = useMutation({
    mutationFn: (body: string) => api.post(`/api/leads/${id}/notes`, { body }),
    onSuccess: () => {
      setNoteBody("");
      queryClient.invalidateQueries({ queryKey: ["leads", id] });
      notify("Note added.", "success");
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.fields?.body) notify(err.fields.body, "error");
      else notify("Couldn't save changes. Try again.", "error");
    },
  });

  if (detail.isLoading) return <PageSkeleton />;
  if (detail.isError || !detail.data) {
    return (
      <div>
        <button
          type="button"
          onClick={() => navigate("/leads", { replace: true })}
          className="text-sm text-accent"
        >
          Back to leads
        </button>
        <p role="alert" className="mt-4 text-sm text-danger">
          Couldn&apos;t load this lead. It may have been deleted.
        </p>
      </div>
    );
  }

  const lead = detail.data;
  const followUpValue = followUpDraft !== null ? followUpDraft : toDateInputValue(lead.followUpDate);

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate("/leads")}
        className="text-sm text-accent"
      >
        Back to leads
      </button>

      <div className="mt-5 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-content-primary">{lead.name}</h1>
        <StatusBadge status={lead.status} />
      </div>

      <section aria-label="Details" className="mt-6 rounded-lg border border-border bg-surface p-4 md:p-5">
        <h2 className="text-md font-medium text-content-primary">Details</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs text-content-tertiary">Email</dt>
            <dd className="text-content-primary">{lead.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-content-tertiary">Phone</dt>
            <dd className="text-content-primary">{lead.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-content-tertiary">Company</dt>
            <dd className="text-content-primary">{lead.company ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-content-tertiary">Source</dt>
            <dd className="capitalize text-content-primary">{lead.source}</dd>
          </div>
          <div>
            <dt className="text-xs text-content-tertiary">Follow-up</dt>
            <dd>
              <FollowUp value={lead.followUpDate} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-content-tertiary">Last contacted</dt>
            <dd className="text-content-primary tabular-nums">{formatShortDate(lead.lastContactedAt)}</dd>
          </div>
        </dl>
      </section>

      <section aria-label="Status" className="mt-6">
        <h2 className="text-md font-medium text-content-primary">Status</h2>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Change status">
          {STATUSES.map((s) => {
            const active = lead.status === s;
            return (
              <button
                key={s}
                type="button"
                disabled={statusMutation.isPending}
                onClick={() => {
                  if (!active) statusMutation.mutate(s);
                }}
                aria-pressed={active}
                className="h-8 rounded-full border px-3 text-[13px] font-medium capitalize disabled:cursor-not-allowed disabled:opacity-40"
                style={
                  active
                    ? { borderColor: "transparent", ...pillFill(s) }
                    : { borderColor: "var(--border-default)", color: "var(--text-secondary)", backgroundColor: "transparent" }
                }
              >
                {s}
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label="Follow-up date" className="mt-8">
        <h2 className="text-md font-medium text-content-primary">Follow-up date</h2>
        <div className="mt-3 flex max-w-[360px] flex-col gap-3">
          <div>
            <label htmlFor="followup-date" className={labelClass}>
              Date
            </label>
            <input
              id="followup-date"
              type="date"
              className={inputClass}
              value={followUpValue}
              onChange={(e) => setFollowUpDraft(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={followUpMutation.isPending || followUpValue === toDateInputValue(lead.followUpDate)}
              onClick={() =>
                followUpMutation.mutate(
                  followUpValue ? new Date(`${followUpValue}T00:00:00`).toISOString() : null
                )
              }
              className="h-9 rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save changes
            </button>
            {lead.followUpDate && (
              <button
                type="button"
                disabled={followUpMutation.isPending}
                onClick={() => followUpMutation.mutate(null)}
                className="h-9 rounded-md border border-border bg-surface px-4 text-sm font-medium text-content-primary hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

      <section aria-label="Notes" className="mt-8">
        <h2 className="text-md font-medium text-content-primary">Notes</h2>
        <form
          className="mt-3 max-w-[560px]"
          onSubmit={(e) => {
            e.preventDefault();
            if (noteBody.trim()) noteMutation.mutate(noteBody.trim());
          }}
        >
          <label htmlFor="note-body" className={labelClass}>
            Add a note
          </label>
          <textarea
            id="note-body"
            className="min-h-[96px] w-full resize-y rounded-md border border-border bg-surface px-3 py-[10px] text-sm text-content-primary placeholder:text-content-tertiary focus:border-accent"
            placeholder="Called back, asked for a quote by Friday."
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
          />
          <div className="mt-2">
            <button
              type="submit"
              disabled={noteMutation.isPending || !noteBody.trim()}
              className="h-9 rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {noteMutation.isPending ? "Adding…" : "Add note"}
            </button>
          </div>
        </form>
        <ul className="mt-4 flex max-w-[560px] flex-col gap-2">
          {lead.notes.length === 0 && (
            <li className="text-sm text-content-secondary">No notes yet.</li>
          )}
          {lead.notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-border bg-surface p-4">
              <p className="text-sm text-content-primary">{n.body}</p>
              <p className="mt-2 text-xs text-content-tertiary tabular-nums">
                {formatShortDate(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Activity" className="mt-8">
        <h2 className="text-md font-medium text-content-primary">Activity</h2>
        {lead.activity.length === 0 ? (
          <p className="mt-3 text-sm text-content-secondary">No activity yet.</p>
        ) : (
          <ol className="mt-3 flex max-w-[560px] flex-col gap-2">
            {lead.activity.map((a) => (
              <li key={a.id} className="rounded-lg border border-border bg-surface p-4">
                <p className="text-sm text-content-primary">{describeActivity(a)}</p>
                <p className="mt-1 text-xs text-content-tertiary tabular-nums">
                  {formatShortDate(a.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="mt-8 border-t border-border pt-6">
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="h-9 rounded-md border border-border bg-surface px-4 text-sm font-medium text-danger hover:bg-subtle"
        >
          Delete lead
        </button>
      </div>

      <DeleteModal
        open={deleteOpen}
        leadId={lead.id}
        leadName={lead.name}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}

function pillFill(s: LeadStatus): React.CSSProperties {
  switch (s) {
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
