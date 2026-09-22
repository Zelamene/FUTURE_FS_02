import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { ApiError, api } from "../lib/api";
import type { User } from "../lib/format";

const inputClass =
  "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-content-primary placeholder:text-content-tertiary focus:border-accent";
const labelClass = "mb-[6px] block text-xs font-medium text-content-secondary";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: { email: string; password: string }) =>
      api.post<User>("/api/auth/login", payload),
    onSuccess: (user) => {
      queryClient.setQueryData(["user"], user);
      const from = location.state?.from?.pathname
        ? location.state.from.pathname + (location.state.from.search ?? "")
        : "/leads";
      navigate(from, { replace: true });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.fields) {
        const first = Object.values(err.fields)[0];
        setError(first ?? "Invalid email or password");
      } else {
        setError("Invalid email or password");
      }
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-16">
      <div className="w-full max-w-[360px]">
        <h1 className="text-center text-2xl font-semibold text-content-primary">CRM</h1>
        <p className="mt-2 text-center text-sm text-content-secondary">Sign in to manage your leads.</p>
        <form
          className="mt-8 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            mutation.mutate({ email, password });
          }}
        >
          <div>
            <label htmlFor="login-email" className={labelClass}>
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              className={inputClass}
              placeholder="admin@crm.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="login-password" className={labelClass}>
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              className={inputClass}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && (
              <p role="alert" className="mt-[6px] text-xs text-danger">
                {error}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="h-11 rounded-md bg-accent px-5 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {mutation.isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-content-tertiary">
          Public? <Link to="/capture" className="text-accent">Submit an enquiry</Link>
        </p>
      </div>
    </div>
  );
}
