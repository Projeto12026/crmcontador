import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  TrendingUp,
  FileText,
  FolderKanban,
  UserPlus,
  DollarSign,
  Calculator,
  Settings,
  ClipboardList,
  LogOut,
  Loader2,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: <LayoutDashboard className="h-5 w-5 shrink-0" /> },
  { label: 'Tarefas', href: '/tarefas', icon: <CheckSquare className="h-5 w-5 shrink-0" /> },
  { label: 'Comercial', href: '/comercial', icon: <TrendingUp className="h-5 w-5 shrink-0" /> },
  { label: 'Clientes', href: '/clientes', icon: <Users className="h-5 w-5 shrink-0" /> },
  { label: 'Processos', href: '/processos', icon: <FolderKanban className="h-5 w-5 shrink-0" /> },
  { label: 'Contratos', href: '/contratos', icon: <FileText className="h-5 w-5 shrink-0" /> },
  { label: 'Onboarding', href: '/onboarding', icon: <UserPlus className="h-5 w-5 shrink-0" /> },
  { label: 'Folha de Pagamento', href: '/folha-pagamento', icon: <ClipboardList className="h-5 w-5 shrink-0" /> },
  { label: 'Financeiro', href: '/financeiro', icon: <DollarSign className="h-5 w-5 shrink-0" /> },
  { label: 'Precificação', href: '/precificacao', icon: <Calculator className="h-5 w-5 shrink-0" /> },
];

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading, signOut, isAuthenticated } = useAuth();
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex h-14 items-center gap-2 px-2 md:h-12">
            <span className="truncate text-base font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
              CRM Contador
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === item.href}
                      tooltip={item.label}
                    >
                      <Link to={item.href}>
                        {item.icon}
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location.pathname === '/configuracoes'} tooltip="Configurações">
                <Link to="/configuracoes">
                  <Settings className="h-5 w-5 shrink-0" />
                  <span>Configurações</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Sair" onClick={handleSignOut}>
                <LogOut className="h-5 w-5 shrink-0" />
                <span>Sair</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="p-2 group-data-[collapsible=icon]:hidden">
            <p className="truncate px-2 text-xs text-sidebar-foreground/70">{user?.email}</p>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 md:h-12">
          <SidebarTrigger className="-ml-1 md:-ml-0" aria-label="Abrir/fechar menu" />
          <h1 className="truncate text-lg font-semibold md:text-base">CRM Contador</h1>
        </header>
        <div className="min-w-0 flex-1 overflow-auto p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
