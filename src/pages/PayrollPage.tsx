import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RefreshCw,
  Search,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Users,
} from 'lucide-react';
import {
  usePayrollObligations,
  useUpdateObligationStatus,
  useBatchCompleteObligations,
  useSyncGClick,
  usePayrollStats,
  PayrollObligationStatus,
} from '@/hooks/usePayrollObligations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PayrollFilters {
  search: string;
  status: PayrollObligationStatus | 'all';
  competence: string;
  department: string;
}

const statusConfig: Record<PayrollObligationStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  pending: { label: 'Pendente', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  delayed: { label: 'Atrasada após a meta', variant: 'destructive', icon: <AlertTriangle className="h-3 w-3" /> },
  completed: { label: 'Concluída', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
};

export function PayrollPage() {
  const { data: obligations = [], isLoading } = usePayrollObligations();
  const { data: stats } = usePayrollStats();
  const updateStatus = useUpdateObligationStatus();
  const batchComplete = useBatchCompleteObligations();
  const syncGClick = useSyncGClick();

  const [filters, setFilters] = useState<PayrollFilters>({
    search: '',
    status: 'all',
    competence: 'all',
    department: 'all',
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>('obrigacoes');

  // Get unique competences and departments for filters
  const competences = useMemo(() => {
    const unique = [...new Set(obligations.map(o => o.competence))];
    return unique.sort().reverse();
  }, [obligations]);

  const departments = useMemo(() => {
    const unique = [...new Set(obligations.map(o => o.department))];
    return unique.sort();
  }, [obligations]);

  // Filter obligations
  const filteredObligations = useMemo(() => {
    return obligations.filter(ob => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (
          !ob.client_name.toLowerCase().includes(searchLower) &&
          !ob.client_cnpj.includes(filters.search)
        ) {
          return false;
        }
      }
      if (filters.status !== 'all' && ob.status !== filters.status) return false;
      if (filters.competence !== 'all' && ob.competence !== filters.competence) return false;
      if (filters.department !== 'all' && ob.department !== filters.department) return false;
      return true;
    });
  }, [obligations, filters]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredObligations.map(o => o.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
  };

  const handleBatchComplete = () => {
    if (selectedIds.length === 0) return;
    batchComplete.mutate(selectedIds, {
      onSuccess: () => setSelectedIds([]),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Folha de Pagamento</h1>
          <p className="text-muted-foreground">
            Acompanhe as obrigações de folha de pagamento das empresas
          </p>
        </div>
        <Button
          onClick={() => syncGClick.mutate()}
          disabled={syncGClick.isPending}
          variant="outline"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${syncGClick.isPending ? 'animate-spin' : ''}`} />
          Sincronizar com G-Click
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-muted/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Obrigações</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-orange-50 dark:bg-orange-950">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats?.pending || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-red-50 dark:bg-red-950">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.delayed || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 dark:bg-green-950">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.completed || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="obrigacoes" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            {stats?.pending || 0} Obrigações
          </TabsTrigger>
          <TabsTrigger value="solicitacoes" className="gap-2">
            0 Solicitações
          </TabsTrigger>
          <TabsTrigger value="agendamentos" className="gap-2">
            0 Agendamentos
          </TabsTrigger>
          <TabsTrigger value="cobrancas" className="gap-2">
            0 Cobranças
          </TabsTrigger>
          <TabsTrigger value="certificados" className="gap-2">
            0 Certificados e Procurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="obrigacoes" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="O que você está procurando?"
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="pl-10"
                  />
                </div>

                <Select
                  value={filters.status}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, status: value as PayrollObligationStatus | 'all' }))}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="delayed">Atrasada</SelectItem>
                    <SelectItem value="completed">Concluída</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.competence}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, competence: value }))}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Competência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas Competências</SelectItem>
                    {competences.map(comp => (
                      <SelectItem key={comp} value={comp}>{comp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.department}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, department: value }))}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Departamentos</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedIds.length > 0 && (
                <div className="mt-4 flex items-center gap-4 p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">
                    {selectedIds.length} selecionada(s)
                  </span>
                  <Button
                    size="sm"
                    onClick={handleBatchComplete}
                    disabled={batchComplete.isPending}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Marcar como Concluídas
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredObligations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">Nenhuma obrigação encontrada</h3>
                  <p className="text-muted-foreground mt-1">
                    Clique em "Sincronizar com G-Click" para importar as obrigações.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.length === filteredObligations.length && filteredObligations.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-12">No</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Competência</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status do Cliente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredObligations.map((obligation, index) => (
                      <TableRow key={obligation.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(obligation.id)}
                            onCheckedChange={(checked) => handleSelectOne(obligation.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <Badge variant={statusConfig[obligation.status].variant} className="gap-1">
                            {statusConfig[obligation.status].icon}
                            {statusConfig[obligation.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell>{obligation.department}</TableCell>
                        <TableCell>{obligation.obligation_name}</TableCell>
                        <TableCell>{obligation.competence}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{obligation.client_name}</div>
                            <div className="text-xs text-muted-foreground">{obligation.client_cnpj}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={obligation.client_status === 'Ativo' ? 'outline' : 'secondary'}>
                            {obligation.client_status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="solicitacoes">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Nenhuma solicitação</h3>
              <p className="text-muted-foreground">As solicitações aparecerão aqui</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agendamentos">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Nenhum agendamento</h3>
              <p className="text-muted-foreground">Os agendamentos aparecerão aqui</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cobrancas">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Nenhuma cobrança</h3>
              <p className="text-muted-foreground">As cobranças aparecerão aqui</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certificados">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Nenhum certificado ou procuração</h3>
              <p className="text-muted-foreground">Os certificados e procurações aparecerão aqui</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
