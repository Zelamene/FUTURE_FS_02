import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { User } from "../lib/format";

export function useCurrentUser() {
  return useQuery<User | null>({
    queryKey: ["user"],
    queryFn: async () => {
      try {
        return await api.get<User>("/api/auth/me");
      } catch (err: any) {
        if (err?.status === 401) return null;
        throw err;
      }
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // 
    }
    queryClient.setQueryData(["user"], null);
    await queryClient.invalidateQueries();
  };
}
