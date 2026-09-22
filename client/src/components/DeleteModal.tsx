import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useToast } from "../hooks/useToast";
import { useDialogFocus } from "../hooks/useDialogFocus";

interface Props {
  open: boolean;
  leadId: string;
  leadName: string;
  onClose: () => void;
}

export function DeleteModal({ open, leadId, leadName, onClose }: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { notify } = useToast();
  const dialogRef = useDialogFocus(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const mutation = useMutation({
    mutationFn: () => api.del(`/api/leads/${leadId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.removeQueries({ queryKey: ["leads", leadId] });
      notify("Lead deleted.", "success");
      onClose();
      navigate("/leads", { replace: true });
    },
    onError: () => notify("Couldn't save changes. Try again.", "error"),
  });

  if (!open) return null;

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
        aria-label="Delete this lead?"
        className="w-full max-w-modal rounded-xl border border-border bg-surface p-6 shadow-md"
      >
        <h2 className="mb-4 text-lg font-semibold text-content-primary">Delete this lead?</h2>
        <p className="mb-5 text-sm text-content-secondary">
          This also removes notes and activity for {leadName}. This can&apos;t be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-border bg-surface px-4 text-sm font-medium text-content-primary hover:bg-subtle"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            className="h-9 rounded-md bg-danger px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {mutation.isPending ? "Deleting…" : "Delete lead"}
          </button>
        </div>
      </div>
    </div>
  );
}
