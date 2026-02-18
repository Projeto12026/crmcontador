import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, addMonths, parseISO, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, TrendingUp, TrendingDown, FolderTree, Wallet, Plus, CalendarRange, BarChart3, CalendarClock, Landmark, FileDown } from 'lucide-react';
import { exportTransactionsPdf, exportProjectionPdf, exportDashboardPdf, exportInstallmentsPdf, exportAccountsPdf } from '@/lib/pdf-export';

import { useAccountCategories, useAccountCategoriesFlat, useCreateAccountCategory, useUpdateAccountCategory, useDeleteAccountCategory } from '@/hooks/useAccountCategories';
import { useFinancialAccounts } from '@/hooks/useFinancialAccounts';
import { useCashFlowTransactions, useCashFlowSummary, useCreateCashFlowTransaction, useUpdateCashFlowTransaction, useSettleTransaction, useDeleteCashFlowTransaction } from '@/hooks/useCashFlow';
import { useClients } from '@/hooks/useClients';

import { AccountCategoryTree } from '@/components/financial/AccountCategoryTree';
import { AccountCategoryDialog } from '@/components/financial/AccountCategoryDialog';
import { DeleteConfirmDialog } from '@/components/financial/DeleteConfirmDialog';
import { CashFlowSummaryCards } from '@/components/financial/CashFlowSummaryCards';
import { TransactionsTable } from '@/components/financial/TransactionsTable';
import { TransactionFormDialog } from '@/components/financial/TransactionFormDialog';
import { CashFlowProjectionView } from '@/components/financial/CashFlowProjectionView';
import { CashFlowFilters, CashFlowFiltersValues } from '@/components/financial/CashFlowFilters';
import { FinancialDashboardView } from '@/components/financial/FinancialDashboardView';
import { DashboardFilters, DashboardFilterValues } from '@/components/financial/DashboardFilters';
import { InstallmentExpensesView } from '@/components/financial/InstallmentExpensesView';
import { FinancialAccountsManager } from '@/components/financial/FinancialAccountsManager';
import { TransactionType, AccountCategory, AccountGroupNumber, AccountCategoryFormData, ACCOUNT_GROUPS, CashFlowTransaction } from '@/types/crm';

export function FinancialPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<TransactionType>('income');
  const [editingTransaction, setEditingTransaction] = useState<CashFlowTransaction | null>(null);
  
  // Estado para dialog de categoria
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AccountCategory | null>(null);
  const [newCategoryParentId, setNewCategoryParentId] = useState<string | undefined>();
  const [newCategoryGroup, setNewCategoryGroup] = useState<AccountGroupNumber | undefined>();
  
  // Estado para confirmação de exclusão
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  
  // Filtros do fluxo de caixa
  const [filters, setFilters] = useState<CashFlowFiltersValues>({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });
  
  // Período da projeção (6 meses a partir de hoje)
  const [projectionStartDate, setProjectionStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [projectionMonths, setProjectionMonths] = useState(6);
  
  // Filtros do dashboard
  const [dashboardFilter, setDashboardFilter] = useState<DashboardFilterValues>({
    startDate: format(startOfYear(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfYear(new Date()), 'yyyy-MM-dd'),
  });
  
  // Queries — filtrar categorias para mostrar apenas Financeiro (IDs com prefixo F + grupos 1-6 e 100+)
  const { data: allCategories, isLoading: loadingCategories } = useAccountCategories();
  const { data: allCategoriesFlat } = useAccountCategoriesFlat();
  const { data: financialAccounts } = useFinancialAccounts();

  const categories = useMemo(() => {
    if (!allCategories) return allCategories;
    return allCategories.filter(c => c.id.startsWith('F') || c.group_number <= 4 || c.group_number >= 100);
  }, [allCategories]);

  const categoriesFlat = useMemo(() => {
    if (!allCategoriesFlat) return allCategoriesFlat;
    return allCategoriesFlat.filter(c => c.id.startsWith('F') || c.group_number <= 4 || c.group_number >= 100);
  }, [allCategoriesFlat]);
  const { data: transactions, isLoading: loadingTransactions } = useCashFlowTransactions({
    startDate: filters.startDate,
    endDate: filters.endDate,
    accountId: filters.accountId,
    type: filters.type,
    financialAccountId: filters.financialAccountId,
    source: 'financeiro',
  });
  
  // Transações para projeção (período estendido)
  const projectionEndDate = format(addMonths(startOfMonth(new Date(projectionStartDate)), projectionMonths), 'yyyy-MM-dd');
  const { data: projectionTransactions, isLoading: loadingProjection } = useCashFlowTransactions({
    startDate: projectionStartDate,
    endDate: projectionEndDate,
    source: 'financeiro',
  });

  // Transações para parceladas (busca ampla - todos os dados)
  const { data: allTransactions, isLoading: loadingAll } = useCashFlowTransactions({ source: 'financeiro' });
  
  // Transações para dashboard (filtro próprio)
  const { data: dashboardTransactions, isLoading: loadingDashboard } = useCashFlowTransactions({
    startDate: dashboardFilter.startDate,
    endDate: dashboardFilter.endDate,
    source: 'financeiro',
  });

  const { data: rawSummary, isLoading: loadingSummary } = useCashFlowSummary(filters.startDate, filters.endDate, filters.financialAccountId, 'financeiro');
  const { data: clients } = useClients();

  // Filtrar transações localmente para filtros que não estão na query
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    
    return transactions.filter(tx => {
      if (filters.groupNumber && tx.account?.group_number !== filters.groupNumber) return false;
      if (filters.financialAccountId && tx.financial_account_id !== filters.financialAccountId) return false;
      if (filters.status) {
        const hasFuture = (tx.type === 'income' ? tx.future_income : tx.future_expense) > 0;
        const hasExecuted = (tx.type === 'income' ? tx.income : tx.expense) > 0;
        if (filters.status === 'projected' && (!hasFuture || hasExecuted)) return false;
        if (filters.status === 'executed' && (!hasExecuted || hasFuture)) return false;
        if (filters.status === 'mixed' && !(hasFuture && hasExecuted)) return false;
      }
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        const matchDescription = tx.description.toLowerCase().includes(term);
        const matchValue = tx.value.toString().includes(term);
        const matchOrigin = tx.origin_destination?.toLowerCase().includes(term);
        if (!matchDescription && !matchValue && !matchOrigin) return false;
      }
      return true;
    });
  }, [transactions, filters.groupNumber, filters.financialAccountId, filters.status, filters.searchTerm]);

  // Recalcular summary quando há filtros locais
  const hasLocalFilters = filters.groupNumber || filters.status || filters.searchTerm;
  const summary = useMemo(() => {
    if (!hasLocalFilters) return rawSummary;
    if (!filteredTransactions.length) return rawSummary;
    const result = {
      totalIncome: 0, totalExpense: 0, balance: 0,
      projectedIncome: 0, projectedExpense: 0,
      executedIncome: 0, executedExpense: 0, executedBalance: 0,
      transactionCount: filteredTransactions.length,
    };
    filteredTransactions.forEach(tx => {
      const income = Number(tx.income || 0);
      const expense = Number(tx.expense || 0);
      const futureIncome = Number(tx.future_income || 0);
      const futureExpense = Number(tx.future_expense || 0);
      result.executedIncome += income;
      result.executedExpense += expense;
      result.projectedIncome += futureIncome;
      result.projectedExpense += futureExpense;
      result.totalIncome += income + futureIncome;
      result.totalExpense += expense + futureExpense;
    });
    result.balance = result.totalIncome - result.totalExpense;
    result.executedBalance = result.executedIncome - result.executedExpense;
    return result;
  }, [hasLocalFilters, rawSummary, filteredTransactions]);

  // Total de despesas projetadas incluindo grupos excluídos (100, 200)
  const grandTotalProjectedExpense = useMemo(() => {
    if (!transactions) return undefined;
    return transactions.reduce((sum, tx) => sum + Number(tx.future_expense || 0), 0);
  }, [transactions]);

  const resetFilters = () => {
    setFilters({
      startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    });
  };
  
  // Mutations
  const createTransaction = useCreateCashFlowTransaction('financeiro');
  const updateTransaction = useUpdateCashFlowTransaction();
  const settleTransaction = useSettleTransaction();
  const deleteTransaction = useDeleteCashFlowTransaction();
  const createCategory = useCreateAccountCategory();
  const updateCategory = useUpdateAccountCategory();
  const deleteCategory = useDeleteAccountCategory();
  
  const openNewTransaction = (type: TransactionType) => {
    setEditingTransaction(null);
    setTransactionType(type);
    setTransactionDialogOpen(true);
  };

  const openEditTransaction = (transaction: CashFlowTransaction) => {
    setEditingTransaction(transaction);
    setTransactionType(transaction.type);
    setTransactionDialogOpen(true);
  };
  
  const handleAddCategory = (parentId?: string, groupNumber?: AccountGroupNumber) => {
    setEditingCategory(null);
    setNewCategoryParentId(parentId);
    setNewCategoryGroup(groupNumber);
    setCategoryDialogOpen(true);
  };
  
  const handleEditCategory = (category: AccountCategory) => {
    setEditingCategory(category);
    setNewCategoryParentId(category.parent_id || undefined);
    setNewCategoryGroup(category.group_number);
    setCategoryDialogOpen(true);
  };
  
  const handleDeleteCategory = (id: string) => {
    setCategoryToDelete(id);
    setDeleteDialogOpen(true);
  };
  
  const handleCategorySubmit = (data: AccountCategoryFormData) => {
    if (editingCategory) {
      updateCategory.mutate(
        { id: editingCategory.id, data: { name: data.name, parent_id: data.parent_id } },
        { onSuccess: () => setCategoryDialogOpen(false) }
      );
    } else {
      createCategory.mutate(data, {
        onSuccess: () => setCategoryDialogOpen(false),
      });
    }
  };
  
  const confirmDeleteCategory = () => {
    if (categoryToDelete) {
      deleteCategory.mutate(categoryToDelete, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setCategoryToDelete(null);
        },
      });
    }
  };

  // PDF Export handlers
  const handleExportDashboardPdf = () => {
    if (!dashboardTransactions) return;
    const fmtC = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const groupMap: Record<string, { name: string; projected: number; executed: number; total: number }> = {};
    dashboardTransactions.forEach(tx => {
      const name = tx.account?.name || tx.account_id;
      if (!groupMap[name]) groupMap[name] = { name, projected: 0, executed: 0, total: 0 };
      groupMap[name].projected += Number(tx.future_expense || 0) + Number(tx.future_income || 0);
      groupMap[name].executed += Number(tx.expense || 0) + Number(tx.income || 0);
      groupMap[name].total += Number(tx.value || 0);
    });
    exportDashboardPdf(
      'Dashboard Financeiro',
      [
        { label: 'Receitas', value: fmtC(dashboardTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.value), 0)) },
        { label: 'Despesas', value: fmtC(dashboardTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.value), 0)) },
      ],
      Object.values(groupMap).map(g => ({ ...g, projected: fmtC(g.projected), executed: fmtC(g.executed), total: fmtC(g.total) })),
      `${dashboardFilter.startDate} a ${dashboardFilter.endDate}`,
    );
  };

  const handleExportCashFlowPdf = () => {
    exportTransactionsPdf(filteredTransactions, 'Fluxo de Caixa Financeiro', `${filters.startDate} a ${filters.endDate}`, summary);
  };

  const handleExportProjectionPdf = () => {
    if (!projectionTransactions) return;
    const fmtC = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const months: Date[] = [];
    const [year, month] = projectionStartDate.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    for (let i = 0; i < projectionMonths; i++) months.push(addMonths(start, i));

    const accountMap: Record<string, { name: string; groupNumber: number; months: Record<string, { projected: number; executed: number; total: number }> }> = {};
    const monthTotals: Record<string, { projected: number; executed: number; total: number }> = {};
    months.forEach(m => { monthTotals[format(m, 'yyyy-MM')] = { projected: 0, executed: 0, total: 0 }; });

    projectionTransactions.forEach(tx => {
      const txDate = parseISO(tx.date);
      const monthKey = format(txDate, 'yyyy-MM');
      if (!months.some(m => isSameMonth(m, txDate))) return;
      const accountId = tx.account_id;
      const accountName = tx.account?.name || accountId;
      const groupNumber = tx.account?.group_number || 0;
      if (!accountMap[accountId]) {
        accountMap[accountId] = { name: accountName, groupNumber, months: {} };
        months.forEach(m => { accountMap[accountId].months[format(m, 'yyyy-MM')] = { projected: 0, executed: 0, total: 0 }; });
      }
      const futureVal = tx.type === 'income' ? Number(tx.future_income || 0) : Number(tx.future_expense || 0);
      const execVal = tx.type === 'income' ? Number(tx.income || 0) : Number(tx.expense || 0);
      const sign = tx.type === 'income' ? 1 : -1;
      const total = (futureVal + execVal) * sign;
      if (accountMap[accountId].months[monthKey]) {
        accountMap[accountId].months[monthKey].total += total;
      }
      if (monthTotals[monthKey]) monthTotals[monthKey].total += total;
    });

    const rows = Object.values(accountMap).sort((a, b) => a.groupNumber - b.groupNumber).map(a => ({
      name: a.name, isGroup: false, months: a.months,
    }));
    exportProjectionPdf(rows, months, 'Projeção Financeiro', monthTotals);
  };

  const handleExportInstallmentsPdf = () => {
    if (!allTransactions) return;
    const installmentPattern = /^(.+?)\s*\((\d+)\/(\d+)\)$/;
    const groups: Record<string, any> = {};
    allTransactions.filter(tx => tx.type === 'expense').forEach(tx => {
      const match = tx.description.match(installmentPattern);
      if (!match) return;
      const baseName = match[1].trim();
      const total = parseInt(match[3]);
      const key = `${baseName}__${total}`;
      if (!groups[key]) groups[key] = { baseDescription: baseName, accountName: tx.account?.name || '', value: Number(tx.value), totalInstallments: total, paidInstallments: 0, remainingInstallments: 0, totalPaid: 0, totalRemaining: 0, lastDate: new Date(tx.date) };
      const isPaid = Number(tx.expense || 0) > 0;
      if (isPaid) { groups[key].paidInstallments++; groups[key].totalPaid += Number(tx.value); }
      else { groups[key].remainingInstallments++; groups[key].totalRemaining += Number(tx.value); }
      const txDate = new Date(tx.date);
      if (txDate > groups[key].lastDate) groups[key].lastDate = txDate;
    });
    exportInstallmentsPdf('Parceladas Financeiro', Object.values(groups));
  };

  const handleExportAccountsPdf = () => {
    if (!categories) return;
    const flatList: { id: string; name: string; level: number }[] = [];
    const roots = categories.filter(c => !c.parent_id).sort((a, b) => a.group_number - b.group_number);
    const addChildren = (parentId: string, level: number) => {
      categories.filter(c => c.parent_id === parentId).forEach(c => {
        flatList.push({ id: c.id, name: c.name, level });
        addChildren(c.id, level + 1);
      });
    };
    roots.forEach(r => { flatList.push({ id: r.id, name: r.name, level: 0 }); addChildren(r.id, 1); });
    exportAccountsPdf('Plano de Contas Financeiro', flatList);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Plano de Contas e Fluxo de Caixa</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => openNewTransaction('expense')}>
            <TrendingDown className="mr-1 h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Nova </span>Despesa
          </Button>
          <Button size="sm" className="flex-1 sm:flex-none" onClick={() => openNewTransaction('income')}>
            <TrendingUp className="mr-1 h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Nova </span>Receita
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="cash-flow" className="gap-2">
            <Wallet className="h-4 w-4" />
            Fluxo de Caixa
          </TabsTrigger>
          <TabsTrigger value="accounts" className="gap-2">
            <FolderTree className="h-4 w-4" />
            Plano de Contas
          </TabsTrigger>
          <TabsTrigger value="projection" className="gap-2">
            <CalendarRange className="h-4 w-4" />
            Projeção
          </TabsTrigger>
          <TabsTrigger value="installments" className="gap-2">
            <CalendarClock className="h-4 w-4" />
            Parceladas
          </TabsTrigger>
          <TabsTrigger value="financial-accounts" className="gap-2">
            <Landmark className="h-4 w-4" />
            Contas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 mt-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleExportDashboardPdf}>
              <FileDown className="mr-2 h-4 w-4" />PDF
            </Button>
          </div>
          <DashboardFilters onChange={setDashboardFilter} />
          <FinancialDashboardView
            transactions={dashboardTransactions || []}
            isLoading={loadingDashboard}
          />
        </TabsContent>

        <TabsContent value="cash-flow" className="space-y-6 mt-4">
          <div className="flex justify-between items-center">
            <CashFlowFilters
              filters={filters}
              onFiltersChange={setFilters}
              accounts={categoriesFlat || []}
              financialAccounts={financialAccounts || []}
              onReset={resetFilters}
            />
            <Button variant="outline" size="sm" onClick={handleExportCashFlowPdf}>
              <FileDown className="mr-2 h-4 w-4" />PDF
            </Button>
          </div>
          {summary && (
            <CashFlowSummaryCards summary={summary} isLoading={loadingSummary} totalProjectedExpense={grandTotalProjectedExpense} />
          )}
          <TransactionsTable
            transactions={filteredTransactions}
            isLoading={loadingTransactions}
            onSettle={(id) => settleTransaction.mutate(id)}
            onDelete={(id) => deleteTransaction.mutate(id)}
            onEdit={openEditTransaction}
            showExport
          />
        </TabsContent>

        <TabsContent value="accounts" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Plano de Contas</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportAccountsPdf}>
                  <FileDown className="mr-2 h-4 w-4" />PDF
                </Button>
                <Button onClick={() => handleAddCategory(undefined, 1)} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Conta
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingCategories ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : categories && categories.length > 0 ? (
                <AccountCategoryTree
                  categories={categories}
                  onAdd={handleAddCategory}
                  onEdit={handleEditCategory}
                  onDelete={handleDeleteCategory}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Nenhuma conta cadastrada</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => handleAddCategory(undefined, 1)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Criar primeira conta
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projection" className="space-y-6 mt-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
                <div className="space-y-2">
                  <Label>Data Inicial</Label>
                  <Input
                    type="date"
                    value={projectionStartDate}
                    onChange={(e) => setProjectionStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Meses</Label>
                  <select
                    value={projectionMonths}
                    onChange={(e) => setProjectionMonths(Number(e.target.value))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  >
                    <option value={3}>3 meses</option>
                    <option value={6}>6 meses</option>
                    <option value={12}>12 meses</option>
                    <option value={24}>24 meses</option>
                  </select>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setProjectionStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                    setProjectionMonths(6);
                  }}
                >
                  Redefinir
                </Button>
                <Button variant="outline" onClick={handleExportProjectionPdf}>
                  <FileDown className="mr-2 h-4 w-4" />PDF
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <CashFlowProjectionView
            transactions={projectionTransactions || []}
            isLoading={loadingProjection}
            startDate={projectionStartDate}
            monthsToShow={projectionMonths}
          />
        </TabsContent>

        <TabsContent value="installments" className="space-y-6 mt-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleExportInstallmentsPdf}>
              <FileDown className="mr-2 h-4 w-4" />PDF
            </Button>
          </div>
          <InstallmentExpensesView
            transactions={allTransactions || []}
            isLoading={loadingAll}
          />
        </TabsContent>

        <TabsContent value="financial-accounts" className="space-y-6 mt-4">
          <FinancialAccountsManager />
        </TabsContent>

      {/* Dialog de novo/editar lançamento */}
      <TransactionFormDialog
        open={transactionDialogOpen}
        onOpenChange={(open) => {
          setTransactionDialogOpen(open);
          if (!open) setEditingTransaction(null);
        }}
        onSubmit={(data) => {
          if (editingTransaction) {
            updateTransaction.mutate(
              { id: editingTransaction.id, data },
              { onSuccess: () => setTransactionDialogOpen(false) }
            );
          } else {
            createTransaction.mutate(data, {
              onSuccess: () => setTransactionDialogOpen(false),
            });
          }
        }}
        isPending={createTransaction.isPending || updateTransaction.isPending}
        type={transactionType}
        accounts={categoriesFlat || []}
        financialAccounts={financialAccounts || []}
        clients={clients}
        editingTransaction={editingTransaction}
      />
      
      {/* Dialog de conta */}
      <AccountCategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        onSubmit={handleCategorySubmit}
        isPending={createCategory.isPending || updateCategory.isPending}
        category={editingCategory}
        parentId={newCategoryParentId}
        parentGroupNumber={newCategoryGroup}
        existingCategories={categoriesFlat || []}
      />
      </Tabs>
      {/* Dialog de confirmação de exclusão */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDeleteCategory}
        title="Excluir conta"
        description={`Tem certeza que deseja excluir a conta "${categoryToDelete}"? Esta ação não pode ser desfeita.`}
        isPending={deleteCategory.isPending}
      />
    </div>
  );
}
