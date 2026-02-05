import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { TasksPage } from "./pages/TasksPage";
import { ClientsPage } from "./pages/ClientsPage";
import { CommercialPage } from "./pages/CommercialPage";
import { ContractsPage } from "./pages/ContractsPage";
import { ProcessesPage } from "./pages/ProcessesPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { PayrollPage } from "./pages/PayrollPage";
import { FinancialPage } from "./pages/FinancialPage";
import { SettingsPage } from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/tarefas" element={<TasksPage />} />
            <Route path="/clientes" element={<ClientsPage />} />
            <Route path="/comercial" element={<CommercialPage />} />
            <Route path="/contratos" element={<ContractsPage />} />
            <Route path="/processos" element={<ProcessesPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/folha-pagamento" element={<PayrollPage />} />
            <Route path="/financeiro" element={<FinancialPage />} />
            <Route path="/configuracoes" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
