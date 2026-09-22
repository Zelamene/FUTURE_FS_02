import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import type { LeadListResponse } from "../lib/format";
import { StatusBadge } from "../components/StatusBadge";
import { FollowUp } from "../components/FollowUp";
import { ListSkeleton } from "../components/Skeletons";
import { LeadModal } from "../components/LeadModal";

export function LeadsPage() {
  const [params, setParams] = useSearchParams();
  const statusParam = params.get("status") ?? "";
  const searchParam = params.get("search") ?? "";
  const [draft, setDraft] = useState(searchParam);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setDraft(searchParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (draft !== searchParam) {
        const next = new URLSearchParams(params);
        if (draft) next.set("search", draft);
        else next.delete("search");
        setParams(next, { replace: true });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [draft, searchParam, params, setParams]);

  const status = ["new", "contacted", "converted", "lost"].includes(statusParam) ? statusParam : "";

  const query = useQuery<LeadListResponse>({
    queryKey: ["leads", { status, search: searchParam }],
    queryFn: () => {
      const q = new URLSearchParams();
      if (status) q.set("status", status);
      if (searchParam) q.set("search", searchParam);
      q.set("sort", "followUpDate_asc");
      q.set("limit", "50");
      q.set("offset", "0");
      return api.get<LeadListResponse>(`/api/leads?${q.toString()}`);
    },
  });

  const onStatusChange = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set("status", value);
    else next.delete("status");
    setParams(next, { replace: true });
  };

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-content-primary">Leads</h1>
        <span className="text-xs text-content-secondary tabular-nums">
          {query.data ? `${query.data.total} total` : ""}
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="w-full md:max-w-[320px]">
          <label htmlFor="lead-search" className="mb-[6px] block text-xs font-medium text-content-secondary">
            Search
          </label>
          <input
            id="lead-search"
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-content-primary placeholder:text-content-tertiary focus:border-accent"
            placeholder="Name, email or company"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="lead-status" className="mb-[6px] block text-xs font-medium text-content-secondary">
            Status
          </label>
          <select
            id="lead-status"
            className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-content-primary focus:border-accent"
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="converted">Converted</option>
            <option value="lost">Lost</option>
          </select>
        </div>
      </div>

      <div className="mt-6">
        {query.isLoading && <ListSkeleton />}
        {query.isError && (
          <p role="alert" className="text-sm text-danger">
            Couldn&apos;t load leads. Try again.
          </p>
        )}
        {query.data && query.data.data.length === 0 && (
          <div className="rounded-lg border border-border bg-surface px-6 py-14 text-center">
            <p className="text-sm text-content-secondary">No leads yet.</p>
            <p className="mt-1 text-sm text-content-secondary">
              Leads submitted through your contact form will appear here.
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="h-8 rounded-md bg-accent px-3 text-[13px] font-medium text-white hover:bg-accent-hover"
              >
                Add lead manually
              </button>
            </div>
          </div>
        )}
        {query.data && query.data.data.length > 0 && (
          <>
            <div className="flex flex-col gap-2 md:hidden">
              {query.data.data.map((lead) => (
                <Link
                  key={lead.id}
                  to={`/leads/${lead.id}`}
                  className="rounded-lg border border-border bg-surface p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-md font-medium text-content-primary">{lead.name}</span>
                    <StatusBadge status={lead.status} />
                  </div>
                  <p className="mt-1 text-sm text-content-secondary">{lead.email}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs capitalize text-content-tertiary">{lead.source}</span>
                    <FollowUp value={lead.followUpDate} />
                  </div>
                </Link>
              ))}
            </div>
            <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-[0.05em] text-content-secondary">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Follow-up</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.data.map((lead) => (
                    <tr key={lead.id} className="border-b border-border last:border-b-0 hover:bg-subtle">
                      <td className="h-[52px] px-4 text-[13px] text-content-primary">
                        <Link to={`/leads/${lead.id}`} className="text-accent">
                          {lead.name}
                        </Link>
                      </td>
                      <td className="h-[52px] px-4 text-[13px] text-content-secondary">{lead.email}</td>
                      <td className="h-[52px] px-4">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="h-[52px] px-4">
                        <FollowUp value={lead.followUpDate} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <LeadModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
