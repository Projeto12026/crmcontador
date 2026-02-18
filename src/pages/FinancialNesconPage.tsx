import { NesconCashFlowView } from '@/components/financial/NesconCashFlowView';

export function FinancialNesconPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Financeiro Nescon</h1>
        <p className="text-sm text-muted-foreground">Fluxo de Caixa Empresarial com ajuste de receitas</p>
      </div>
      <NesconCashFlowView />
    </div>
  );
}
