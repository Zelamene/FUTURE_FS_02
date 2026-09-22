import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Moon, Sun, Plus, LogOut, ChevronDown } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import { useLogout } from "../hooks/useCurrentUser";
import { useRealtime } from "../hooks/useRealtime";
import type { ConnectionState } from "../hooks/useRealtime";
import { LeadModal } from "./LeadModal";

export function Shell({ children }: { children: React.ReactNode }) {
  const { theme, toggle } = useTheme();
  const logout = useLogout();
  const navigate = useNavigate();
  const connection = useRealtime(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-canvas text-content-primary">
      <header className="sticky top-0 z-30 h-14 border-b border-border bg-surface">
        <div className="mx-auto flex h-full w-full max-w-content items-center justify-between px-4 md:px-8">
          <Link to="/leads" className="text-md font-semibold text-content-primary">
            CRM
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex h-8 min-h-[44px] items-center gap-[6px] rounded-md bg-accent px-3 text-[13px] font-medium text-white hover:bg-accent-hover md:min-h-0"
            >
              <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
              Add lead
            </button>
            <button
              type="button"
              onClick={toggle}
              aria-label="Toggle theme"
              className="flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-content-secondary hover:bg-subtle hover:text-content-primary md:min-h-0 md:min-w-0 md:p-2"
            >
              {theme === "dark" ? (
                <Sun size={16} strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <Moon size={16} strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>
            <ConnectionDot state={connection} />
            <div className="relative">
              <button
                type="button"
                aria-label="Account menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-9 min-h-[44px] items-center gap-1 rounded-md px-2 text-content-secondary hover:bg-subtle hover:text-content-primary md:min-h-0"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-subtle text-xs font-medium text-content-secondary">
                  A
                </span>
                <ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-border bg-surface p-1 shadow-md">
                  <button
                    type="button"
                    onClick={onLogout}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-content-primary hover:bg-subtle"
                  >
                    <LogOut size={16} strokeWidth={1.5} aria-hidden="true" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-content px-4 py-6 md:px-8 md:py-8">{children}</main>
      <LeadModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

function ConnectionDot({ state }: { state: ConnectionState }) {
  const color =
    state === "connected" ? "var(--success)" : state === "connecting" ? "var(--warning)" : "var(--text-tertiary)";
  const title =
    state === "connected" ? "Connected" : state === "connecting" ? "Reconnecting" : "Disconnected";
  return (
    <span className="flex items-center px-1" title={title} aria-label={title} role="status">
      <span aria-hidden="true" className="inline-block h-[6px] w-[6px] rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}
