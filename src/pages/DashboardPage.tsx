import { useDashboardStats } from '@/hooks/useDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  FileText,
  CheckSquare,
  TrendingUp,
  DollarSign,
  AlertCircle,
  FolderKanban,
  UserPlus,
} from 'lucide-react';

export function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats();

  const cards = [
    {
      title: 'Clientes Ativos',
      value: stats?.totalClients || 0,
      icon: <Users className="h-5 w-5 text-blue-500" />,
      color: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      title: 'Contratos Ativos',
      value: stats?.activeContracts || 0,
      icon: <FileText className="h-5 w-5 text-green-500" />,
      color: 'bg-green-50 dark:bg-green-950',
    },
    {
      title: 'Tarefas Pendentes',
      value: stats?.pendingTasks || 0,
      icon: <CheckSquare className="h-5 w-5 text-orange-500" />,
      color: 'bg-orange-50 dark:bg-orange-950',
    },
    {
      title: 'Leads Abertos',
      value: stats?.openLeads || 0,
      icon: <TrendingUp className="h-5 w-5 text-purple-500" />,
      color: 'bg-purple-50 dark:bg-purple-950',
    },
    {
      title: 'Receita do Mês',
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.monthlyRevenue || 0),
      icon: <DollarSign className="h-5 w-5 text-emerald-500" />,
      color: 'bg-emerald-50 dark:bg-emerald-950',
    },
    {
      title: 'Pagamentos Atrasados',
      value: stats?.overdueTransactions || 0,
      icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      color: 'bg-red-50 dark:bg-red-950',
    },
    {
      title: 'Processos em Andamento',
      value: stats?.processesInProgress || 0,
      icon: <FolderKanban className="h-5 w-5 text-cyan-500" />,
      color: 'bg-cyan-50 dark:bg-cyan-950',
    },
    {
      title: 'Onboardings Ativos',
      value: stats?.onboardingsInProgress || 0,
      icon: <UserPlus className="h-5 w-5 text-pink-500" />,
      color: 'bg-pink-50 dark:bg-pink-950',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do seu escritório</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className={card.color}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              {card.icon}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">{card.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
