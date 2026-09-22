import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { useCurrentUser } from "./hooks/useCurrentUser";
import { ToastProvider } from "./hooks/useToast";
import { ToastHost } from "./components/ToastHost";
import { SlowBanner } from "./components/SlowBanner";
import { Shell } from "./components/Shell";
import { PageSkeleton } from "./components/Skeletons";
import { LoginPage } from "./pages/Login";
import { LeadsPage } from "./pages/Leads";
import { LeadDetailPage } from "./pages/LeadDetail";
import { CapturePage } from "./pages/Capture";
import { NotFoundPage } from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useCurrentUser();
  const location = useLocation();
  if (isLoading) return <PageSkeleton />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

function RootRedirect() {
  const { data: user, isLoading } = useCurrentUser();
  if (isLoading) return <PageSkeleton />;
  if (user) return <Navigate to="/leads" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <SlowBanner />
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<Navigate to="/leads" replace />} />
            <Route
              path="/leads"
              element={
                <RequireAuth>
                  <Shell>
                    <LeadsPage />
                  </Shell>
                </RequireAuth>
              }
            />
            <Route
              path="/leads/:id"
              element={
                <RequireAuth>
                  <Shell>
                    <LeadDetailPage />
                  </Shell>
                </RequireAuth>
              }
            />
            <Route path="/capture" element={<CapturePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <ToastHost />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
