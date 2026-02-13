import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useAutoBackup } from "@/hooks/useAutoBackup";
import { DashboardPage } from "./pages/DashboardPage";
import { TasksPage } from "./pages/TasksPage";
import { AgendaPage } from "./pages/AgendaPage";
import { ClientsPage } from "./pages/ClientsPage";
import { CommercialPage } from "./pages/CommercialPage";
import { ContractsPage } from "./pages/ContractsPage";
import { ProcessesPage } from "./pages/ProcessesPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { PayrollPage } from "./pages/PayrollPage";
import { FinancialPage } from "./pages/FinancialPage";
import { PricingPage } from "./pages/PricingPage";
import { CoraPage } from "./pages/CoraPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AuthPage } from "./pages/AuthPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { isAuthenticated, isLoading } = useAuth();
  useAutoBackup();

  if (isLoading) {
    return null; // AppLayout handles loading state
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/tarefas" element={<TasksPage />} />
        <Route path="/agenda" element={<AgendaPage />} />
        <Route path="/clientes" element={<ClientsPage />} />
        <Route path="/comercial" element={<CommercialPage />} />
        <Route path="/contratos" element={<ContractsPage />} />
        <Route path="/processos" element={<ProcessesPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/folha-pagamento" element={<PayrollPage />} />
        <Route path="/financeiro" element={<FinancialPage />} />
        <Route path="/precificacao" element={<PricingPage />} />
        <Route path="/cora" element={<CoraPage />} />
        <Route path="/configuracoes" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

function AuthRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <AuthPage />;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/auth" element={<AuthRoutes />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
