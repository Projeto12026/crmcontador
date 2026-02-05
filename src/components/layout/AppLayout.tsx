import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  TrendingUp,
  FileText,
  FolderKanban,
  UserPlus,
  DollarSign,
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
  { label: 'Dashboard', href: '/', icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: 'Tarefas', href: '/tarefas', icon: <CheckSquare className="h-5 w-5" /> },
  { label: 'Comercial', href: '/comercial', icon: <TrendingUp className="h-5 w-5" /> },
  { label: 'Clientes', href: '/clientes', icon: <Users className="h-5 w-5" /> },
  { label: 'Processos', href: '/processos', icon: <FolderKanban className="h-5 w-5" /> },
  { label: 'Contratos', href: '/contratos', icon: <FileText className="h-5 w-5" /> },
  { label: 'Onboarding', href: '/onboarding', icon: <UserPlus className="h-5 w-5" /> },
  { label: 'Folha de Pagamento', href: '/folha-pagamento', icon: <ClipboardList className="h-5 w-5" /> },
  { label: 'Financeiro', href: '/financeiro', icon: <DollarSign className="h-5 w-5" /> },
];

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading, signOut, isAuthenticated } = useAuth();

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to auth if not authenticated
  if (!isAuthenticated) {
    // Don't show layout, let App.tsx handle the redirect
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card">
        <div className="flex h-16 items-center border-b px-6">
          <h1 className="text-xl font-bold text-primary">CRM Contador</h1>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                location.pathname === item.href
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-4 left-4 right-4 space-y-2">
          <Link
            to="/configuracoes"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              location.pathname === '/configuracoes'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Settings className="h-5 w-5" />
            Configurações
          </Link>
          <div className="border-t pt-2">
            <p className="truncate px-3 text-xs text-muted-foreground mb-2">
              {user?.email}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 flex-1 p-6">
        {children}
      </main>
    </div>
  );
}
