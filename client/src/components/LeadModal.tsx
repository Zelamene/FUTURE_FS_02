import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "../lib/api";
import { toDateInputValue } from "../lib/format";
import type { Lead, LeadSource, LeadStatus } from "../lib/format";
import { useToast } from "../hooks/useToast";
import { useDialogFocus } from "../hooks/useDialogFocus";

interface Props {
  open: boolean;
  onClose: () => void;
}

const inputClass =
  "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-content-primary placeholder:text-content-tertiary focus:border-accent";
const labelClass = "mb-[6px] block text-xs font-medium text-content-secondary";

export function LeadModal({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [source, setSource] = useState<LeadSource>("contact-form");
  const [status, setStatus] = useState<LeadStatus>("new");
  const [followUp, setFollowUp] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const dialogRef = useDialogFocus(open);

  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setPhone("");
      setCompany("");
      setSource("contact-form");
      setStatus("new");
      setFollowUp("");
      setFieldErrors({});
    }
  }, [open ]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<Lead>("/api/leads", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      notify("Lead created.", "success");
      onClose();
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.fields) setFieldErrors(err.fields);
      notify("Couldn't save changes. Try again.", "error");
    },
  });

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    mutation.mutate({
      name,
      email,
      phone: phone || null,
      company: company || null,
      source,
      status,
      followUpDate: followUp ? new Date(`${followUp}T00:00:00`).toISOString() : null,
    });
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Add lead"
        className="w-full max-w-modal rounded-xl border border-border bg-surface p-6 shadow-md"
      >
        <h2 className="mb-4 text-lg font-semibold text-content-primary">Add lead</h2>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="new-name" className={labelClass}>
              Name <span aria-hidden="true" style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              id="new-name"
              className={inputClass}
              placeholder="Thandi Mokoena"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            {fieldErrors.name && <p className="mt-[6px] text-xs text-danger">{fieldErrors.name}</p>}
          </div>
          <div>
            <label htmlFor="new-email" className={labelClass}>
              Email <span aria-hidden="true" style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              id="new-email"
              type="email"
              className={inputClass}
              placeholder="thandi@example.co.za"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {fieldErrors.email && <p className="mt-[6px] text-xs text-danger">{fieldErrors.email}</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="new-phone" className={labelClass}>
                Phone
              </label>
              <input
                id="new-phone"
                className={inputClass}
                placeholder="0821234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="new-company" className={labelClass}>
                Company
              </label>
              <input
                id="new-company"
                className={inputClass}
                placeholder="Mokoena Consulting"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="new-source" className={labelClass}>
                Source
              </label>
              <select
                id="new-source"
                className={inputClass}
                value={source}
                onChange={(e) => setSource(e.target.value as LeadSource)}
              >
                <option value="contact-form">Contact form</option>
                <option value="referral">Referral</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="new-status" className={labelClass}>
                Status
              </label>
              <select
                id="new-status"
                className={inputClass}
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus)}
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="converted">Converted</option>
                <option value="lost">Lost</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="new-followup" className={labelClass}>
              Follow-up date
            </label>
            <input
              id="new-followup"
              type="date"
              className={inputClass}
              value={followUp || toDateInputValue(null)}
              onChange={(e) => setFollowUp(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-md border border-border bg-surface px-4 text-sm font-medium text-content-primary hover:bg-subtle"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="h-9 rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {mutation.isPending ? "Saving…" : "Add lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
