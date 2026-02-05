import { useState } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, TrendingUp, TrendingDown, FolderTree, Wallet, Plus } from 'lucide-react';

import { useAccountCategories, useAccountCategoriesFlat, useCreateAccountCategory, useUpdateAccountCategory, useDeleteAccountCategory } from '@/hooks/useAccountCategories';
import { useFinancialAccounts } from '@/hooks/useFinancialAccounts';
import { useCashFlowTransactions, useCashFlowSummary, useCreateCashFlowTransaction, useSettleTransaction, useDeleteCashFlowTransaction } from '@/hooks/useCashFlow';
import { useClients } from '@/hooks/useClients';

import { AccountCategoryTree } from '@/components/financial/AccountCategoryTree';
import { AccountCategoryDialog } from '@/components/financial/AccountCategoryDialog';
import { DeleteConfirmDialog } from '@/components/financial/DeleteConfirmDialog';
import { CashFlowSummaryCards } from '@/components/financial/CashFlowSummaryCards';
import { TransactionsTable } from '@/components/financial/TransactionsTable';
import { TransactionFormDialog } from '@/components/financial/TransactionFormDialog';
import { TransactionType, AccountCategory, AccountGroupNumber, AccountCategoryFormData, ACCOUNT_GROUPS } from '@/types/crm';

export function FinancialPage() {
  const [activeTab, setActiveTab] = useState('cash-flow');
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<TransactionType>('income');
  
  // Estado para dialog de categoria
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AccountCategory | null>(null);
  const [newCategoryParentId, setNewCategoryParentId] = useState<string | undefined>();
  const [newCategoryGroup, setNewCategoryGroup] = useState<AccountGroupNumber | undefined>();
  
  // Estado para confirmação de exclusão
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  
  // Filtros de período
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  
  // Queries
  const { data: categories, isLoading: loadingCategories } = useAccountCategories();
  const { data: categoriesFlat } = useAccountCategoriesFlat();
  const { data: financialAccounts } = useFinancialAccounts();
  const { data: transactions, isLoading: loadingTransactions } = useCashFlowTransactions({
    startDate,
    endDate,
  });
  const { data: summary, isLoading: loadingSummary } = useCashFlowSummary(startDate, endDate);
  const { data: clients } = useClients();
  
  // Mutations
  const createTransaction = useCreateCashFlowTransaction();
  const settleTransaction = useSettleTransaction();
  const deleteTransaction = useDeleteCashFlowTransaction();
  const createCategory = useCreateAccountCategory();
  const updateCategory = useUpdateAccountCategory();
  const deleteCategory = useDeleteAccountCategory();
  
  const openNewTransaction = (type: TransactionType) => {
    setTransactionType(type);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Financeiro</h1>
          <p className="text-muted-foreground">Plano de Contas e Fluxo de Caixa</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openNewTransaction('expense')}>
            <TrendingDown className="mr-2 h-4 w-4" />
            Nova Despesa
          </Button>
          <Button onClick={() => openNewTransaction('income')}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Nova Receita
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="cash-flow" className="gap-2">
            <Wallet className="h-4 w-4" />
            Fluxo de Caixa
          </TabsTrigger>
          <TabsTrigger value="accounts" className="gap-2">
            <FolderTree className="h-4 w-4" />
            Plano de Contas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cash-flow" className="space-y-6 mt-4">
          {/* Filtros de período */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-end gap-4">
                <div className="space-y-2">
                  <Label>Data Inicial</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Final</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                    setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
                  }}
                >
                  Mês Atual
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Resumo */}
          {summary && (
            <CashFlowSummaryCards summary={summary} isLoading={loadingSummary} />
          )}
          
          {/* Tabela de lançamentos */}
          <TransactionsTable
            transactions={transactions || []}
            isLoading={loadingTransactions}
            onSettle={(id) => settleTransaction.mutate(id)}
            onDelete={(id) => deleteTransaction.mutate(id)}
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
      </Tabs>

      {/* Dialog de novo lançamento */}
      <TransactionFormDialog
        open={transactionDialogOpen}
        onOpenChange={setTransactionDialogOpen}
        onSubmit={(data) => {
          createTransaction.mutate(data, {
            onSuccess: () => setTransactionDialogOpen(false),
          });
        }}
        isPending={createTransaction.isPending}
        type={transactionType}
        accounts={categoriesFlat || []}
        financialAccounts={financialAccounts || []}
        clients={clients}
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