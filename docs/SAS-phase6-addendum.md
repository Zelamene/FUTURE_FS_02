# SAS Phase 6 addendum — realtime cache strategy

SAS §3.3 ("Push-to-Cache Updates") is superseded for this build:

> Realtime events received over the SSE stream invalidate the affected
> query keys rather than merging payloads into the cache. `lead.created`,
> `lead.updated` and `lead.deleted` invalidate `["leads"]` plus the affected
> `["leads", id]`; `activity.created` invalidates `["leads", leadId]`; the
> stream `open` event invalidates everything once to reconcile missed events
> (FR-RT-5). This keeps the client cache consistent with server-side
> filtering and sorting, which cannot be replicated safely in client-side
> merge code. The admin's own mutations remain optimistic and do not depend
> on the stream (FR-RT-6, NFR-USE-2).

Reason: filtered list queries (`?status&search`, fixed `sort=followUpDate_asc`,
`limit 50`) make push-to-cache unreliable — inserting an unfiltered payload
into a filtered cache shows rows the filter would exclude. One refetch per
event against a warm backend is well within NFR-PERF-4.
