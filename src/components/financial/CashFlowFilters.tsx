import { AccountCategory, TransactionType, FinancialAccount, ACCOUNT_GROUPS, AccountGroupNumber } from '@/types/crm';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Search } from 'lucide-react';

export type TransactionStatus = 'all' | 'projected' | 'executed' | 'mixed';

export interface CashFlowFiltersValues {
  startDate: string;
  endDate: string;
  type?: TransactionType;
  groupNumber?: AccountGroupNumber;
  accountId?: string;
  financialAccountId?: string;
  status?: TransactionStatus;
  searchTerm?: string;
}

interface CashFlowFiltersProps {
  filters: CashFlowFiltersValues;
  onFiltersChange: (filters: CashFlowFiltersValues) => void;
  accounts: AccountCategory[];
  financialAccounts: FinancialAccount[];
  onReset: () => void;
}

export function CashFlowFilters({
  filters,
  onFiltersChange,
  accounts,
  financialAccounts,
  onReset,
}: CashFlowFiltersProps) {
  const updateFilter = <K extends keyof CashFlowFiltersValues>(
    key: K,
    value: CashFlowFiltersValues[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  // Filtrar contas pelo grupo selecionado
  const filteredAccounts = filters.groupNumber
    ? accounts.filter(a => a.group_number === filters.groupNumber)
    : accounts;

  const hasActiveFilters = 
    filters.type || 
    filters.groupNumber || 
    filters.accountId || 
    filters.financialAccountId ||
    filters.status ||
    filters.searchTerm;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Período */}
          <div className="space-y-2">
            <Label>Data Inicial</Label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => updateFilter('startDate', e.target.value)}
              className="w-[140px]"
            />
          </div>
          <div className="space-y-2">
            <Label>Data Final</Label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => updateFilter('endDate', e.target.value)}
              className="w-[140px]"
            />
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={filters.type || 'all'}
              onValueChange={(v) => updateFilter('type', v === 'all' ? undefined : v as TransactionType)}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Grupo */}
          <div className="space-y-2">
            <Label>Grupo</Label>
            <Select
              value={filters.groupNumber?.toString() || 'all'}
              onValueChange={(v) => {
                const groupNum = v === 'all' ? undefined : Number(v) as AccountGroupNumber;
                // Atualizar grupo e limpar conta ao mesmo tempo para evitar race condition
                onFiltersChange({ 
                  ...filters, 
                  groupNumber: groupNum, 
                  accountId: groupNum !== filters.groupNumber ? undefined : filters.accountId 
                });
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os grupos</SelectItem>
                {Object.entries(ACCOUNT_GROUPS).map(([num, name]) => (
                  <SelectItem key={num} value={num}>
                    {num} - {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conta */}
          <div className="space-y-2">
            <Label>Conta</Label>
            <Select
              value={filters.accountId || 'all'}
              onValueChange={(v) => updateFilter('accountId', v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {filteredAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.id} - {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conta Financeira */}
          <div className="space-y-2">
            <Label>Conta Financeira</Label>
            <Select
              value={filters.financialAccountId || 'all'}
              onValueChange={(v) => updateFilter('financialAccountId', v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {financialAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={filters.status || 'all'}
              onValueChange={(v) => updateFilter('status', v === 'all' ? undefined : v as TransactionStatus)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="projected">Projetado</SelectItem>
                <SelectItem value="executed">Realizado</SelectItem>
                <SelectItem value="mixed">Misto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pesquisa */}
          <div className="space-y-2">
            <Label>Pesquisar</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Descrição ou valor..."
                value={filters.searchTerm || ''}
                onChange={(e) => updateFilter('searchTerm', e.target.value || undefined)}
                className="pl-9 w-[200px]"
              />
            </div>
          </div>

          {/* Botão limpar filtros */}
          {hasActiveFilters && (
            <Button variant="ghost" size="icon" onClick={onReset} title="Limpar filtros">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
