import { useSyncExternalStore } from "react";

export const API_URL =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:5000";

export interface ApiErrorShape {
  status: number;
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;
  constructor(shape: ApiErrorShape) {
    super(shape.message);
    this.status = shape.status;
    this.code = shape.code;
    this.fields = shape.fields;
  }
}


let pending = 0;
let slow = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const slowListeners = new Set<(v: boolean) => void>();

function setSlow(v: boolean) {
  if (slow === v) return;
  slow = v;
  slowListeners.forEach((l) => l(v));
}

function trackStart() {
  pending += 1;
  if (pending > 0 && timer === null) {
    timer = setTimeout(() => {
      timer = null;
      if (pending > 0) setSlow(true);
    }, 2000);
  }
}

function trackEnd() {
  pending = Math.max(0, pending - 1);
  if (pending === 0) {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    setSlow(false);
  }
}

export function subscribeSlow(listener: (v: boolean) => void) {
  slowListeners.add(listener);
  listener(slow);
  return () => {
    slowListeners.delete(listener);
  };
}

export function useSlowRequest() {
  return useSyncExternalStore(subscribeSlow, () => slow, () => false);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  trackStart();
  try {
    const res = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    if (res.status === 204) return undefined as unknown as T;
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const err = body?.error ?? {};
      throw new ApiError({
        status: res.status,
        code: err.code || "INTERNAL_ERROR",
        message: err.message || "Couldn't save changes. Try again.",
        fields: err.fields,
      });
    }
    return body as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError({
      status: 0,
      code: "NETWORK_ERROR",
      message: "Couldn't save changes. Try again.",
    });
  } finally {
    trackEnd();
  }
}

export const api = {
  get: <T,>(path: string) => request<T>(path, { method: "GET" }),
  post: <T,>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data === undefined ? undefined : JSON.stringify(data) }),
  patch: <T,>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data === undefined ? undefined : JSON.stringify(data) }),
  del: (path: string) => request<void>(path, { method: "DELETE" }),
};
