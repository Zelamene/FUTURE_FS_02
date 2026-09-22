import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_URL } from "../lib/api";

export type ConnectionState = "connected" | "connecting" | "disconnected";

export function useRealtime(enabled: boolean) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ConnectionState>("connecting");

  useEffect(() => {
    if (!enabled) {
      setState("disconnected");
      return;
    }
    setState("connecting");
    const es = new EventSource(`${API_URL}/api/events`, { withCredentials: true });

    const invalidateFor = (event: MessageEvent) => {
      try {
        const { type, payload } = JSON.parse(event.data);
        if (type === "lead.created" || type === "lead.updated" || type === "lead.deleted") {
          queryClient.invalidateQueries({ queryKey: ["leads"] });
          const id = payload?.lead?.id ?? payload?.leadId;
          if (id) queryClient.invalidateQueries({ queryKey: ["leads", id] });
        } else if (type === "activity.created") {
          if (payload?.leadId) queryClient.invalidateQueries({ queryKey: ["leads", payload.leadId] });
        }
      } catch {
        queryClient.invalidateQueries({ queryKey: ["leads"] });
      }
    };

    const onOpen = () => {
      setState("connected");

      queryClient.invalidateQueries();
    };
    const onError = () => {
      if (es.readyState === EventSource.CLOSED) setState("disconnected");
      else setState("connecting");
    };

    es.addEventListener("open", onOpen as EventListener);
    es.addEventListener("error", onError as EventListener);
    es.addEventListener("lead.created", invalidateFor as EventListener);
    es.addEventListener("lead.updated", invalidateFor as EventListener);
    es.addEventListener("lead.deleted", invalidateFor as EventListener);
    es.addEventListener("activity.created", invalidateFor as EventListener);

    return () => es.close();
  }, [enabled, queryClient]);

  return state;
}
