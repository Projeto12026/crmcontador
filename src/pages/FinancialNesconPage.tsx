import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, addMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, TrendingUp, TrendingDown, FolderTree, Wallet, Plus, CalendarRange, BarChart3, CalendarClock, Landmark } from 'lucide-react';

import { useAccountCategories, useAccountCategoriesFlat, useCreateAccountCategory, useUpdateAccountCategory, useDeleteAccountCategory } from '@/hooks/useAccountCategories';
import { useFinancialAccounts } from '@/hooks/useFinancialAccounts';
import { useCashFlowTransactions, useCashFlowSummary, useCreateCashFlowTransaction, useUpdateCashFlowTransaction, useSettleTransaction, useDeleteCashFlowTransaction } from '@/hooks/useCashFlow';
import { useClients } from '@/hooks/useClients';

import { AccountCategoryTree } from '@/components/financial/AccountCategoryTree';
import { AccountCategoryDialog } from '@/components/financial/AccountCategoryDialog';
import { DeleteConfirmDialog } from '@/components/financial/DeleteConfirmDialog';
import { TransactionsTable } from '@/components/financial/TransactionsTable';
import { TransactionFormDialog } from '@/components/financial/TransactionFormDialog';
import { CashFlowFilters, CashFlowFiltersValues } from '@/components/financial/CashFlowFilters';
import { DashboardFilters, DashboardFilterValues } from '@/components/financial/DashboardFilters';
import { InstallmentExpensesView } from '@/components/financial/InstallmentExpensesView';
import { FinancialAccountsManager } from '@/components/financial/FinancialAccountsManager';
import { TransactionType, AccountCategory, AccountGroupNumber, AccountCategoryFormData, CashFlowTransaction, CashFlowSummary } from '@/types/crm';

import { NesconSummaryCards, NesconDashboardView, NesconProjectionView } from '@/components/financial/NesconCashFlowView';

export function FinancialNesconPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<TransactionType>('income');
  const [editingTransaction, setEditingTransaction] = useState<CashFlowTransaction | null>(null);

  // Category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AccountCategory | null>(null);
  const [newCategoryParentId, setNewCategoryParentId] = useState<string | undefined>();
  const [newCategoryGroup, setNewCategoryGroup] = useState<AccountGroupNumber | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  // Cash flow filters
  const [filters, setFilters] = useState<CashFlowFiltersValues>({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });

  // Projection
  const [projectionStartDate, setProjectionStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [projectionMonths, setProjectionMonths] = useState(6);

  // Dashboard filters
  const [dashboardFilter, setDashboardFilter] = useState<DashboardFilterValues>({
    startDate: format(startOfYear(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfYear(new Date()), 'yyyy-MM-dd'),
  });

  // Queries — filtrar categorias para mostrar apenas Nescon (grupos 1-11, sem prefixo F)
  const { data: allCategories, isLoading: loadingCategories } = useAccountCategories();
  const { data: allCategoriesFlat } = useAccountCategoriesFlat();
  const { data: financialAccounts } = useFinancialAccounts();

  const categories = useMemo(() => {
    if (!allCategories) return allCategories;
    return allCategories.filter(c => c.group_number <= 11 && !c.id.startsWith('F'));
  }, [allCategories]);

  const categoriesFlat = useMemo(() => {
    if (!allCategoriesFlat) return allCategoriesFlat;
    return allCategoriesFlat.filter(c => c.group_number <= 11 && !c.id.startsWith('F'));
  }, [allCategoriesFlat]);
  const { data: transactions, isLoading: loadingTransactions } = useCashFlowTransactions({
    startDate: filters.startDate,
    endDate: filters.endDate,
    accountId: filters.accountId,
    type: filters.type,
    financialAccountId: filters.financialAccountId,
    source: 'nescon',
  });

  const projectionEndDate = format(endOfMonth(addMonths(startOfMonth(new Date(projectionStartDate)), projectionMonths - 1)), 'yyyy-MM-dd');
  const { data: projectionTransactions, isLoading: loadingProjection } = useCashFlowTransactions({
    startDate: projectionStartDate,
    endDate: projectionEndDate,
    source: 'nescon',
  });

  const { data: allTransactions, isLoading: loadingAll } = useCashFlowTransactions({ source: 'nescon' });

  const { data: dashboardTransactions, isLoading: loadingDashboard } = useCashFlowTransactions({
    startDate: dashboardFilter.startDate,
    endDate: dashboardFilter.endDate,
    source: 'nescon',
  });

  const { data: rawSummary, isLoading: loadingSummary } = useCashFlowSummary(filters.startDate, filters.endDate, filters.financialAccountId, 'nescon');
  const { data: clients } = useClients();

  // Local filters
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
        if (!tx.description.toLowerCase().includes(term) && !tx.value.toString().includes(term) && !tx.origin_destination?.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [transactions, filters.groupNumber, filters.financialAccountId, filters.status, filters.searchTerm]);

  const hasLocalFilters = filters.groupNumber || filters.status || filters.searchTerm;
  const summary = useMemo(() => {
    if (!hasLocalFilters) return rawSummary;
    if (!filteredTransactions.length) return rawSummary;
    const result: CashFlowSummary = {
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
  const createTransaction = useCreateCashFlowTransaction('nescon');
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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Financeiro Nescon</h1>
          <p className="text-sm text-muted-foreground">Fluxo de Caixa Empresarial</p>
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
          <DashboardFilters onChange={setDashboardFilter} />
          <NesconDashboardView
            transactions={dashboardTransactions || []}
            isLoading={loadingDashboard}
            startDate={dashboardFilter.startDate}
            endDate={dashboardFilter.endDate}
          />
        </TabsContent>

        <TabsContent value="cash-flow" className="space-y-6 mt-4">
          <CashFlowFilters
            filters={filters}
            onFiltersChange={setFilters}
            accounts={categoriesFlat || []}
            financialAccounts={financialAccounts || []}
            onReset={resetFilters}
          />
          {summary && (
            <NesconSummaryCards summary={summary} isLoading={loadingSummary} totalProjectedExpense={grandTotalProjectedExpense} />
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
              <Button onClick={() => handleAddCategory(undefined, 1)} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Nova Conta
              </Button>
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
                  <Input type="date" value={projectionStartDate} onChange={(e) => setProjectionStartDate(e.target.value)} />
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
                <Button variant="outline" onClick={() => { setProjectionStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd')); setProjectionMonths(6); }}>
                  Redefinir
                </Button>
              </div>
            </CardContent>
          </Card>
          <NesconProjectionView
            transactions={projectionTransactions || []}
            isLoading={loadingProjection}
            startDate={projectionStartDate}
            monthsToShow={projectionMonths}
          />
        </TabsContent>

        <TabsContent value="installments" className="space-y-6 mt-4">
          <InstallmentExpensesView
            transactions={allTransactions || []}
            isLoading={loadingAll}
          />
        </TabsContent>

        <TabsContent value="financial-accounts" className="space-y-6 mt-4">
          <FinancialAccountsManager />
        </TabsContent>

        {/* Transaction dialog */}
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

        {/* Category dialog */}
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

      {/* Delete confirmation */}
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
