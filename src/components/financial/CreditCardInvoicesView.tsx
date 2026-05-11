import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  Receipt,
  Loader2,
  CheckCircle2,
  RotateCcw,
  Wallet,
  AlertTriangle,
} from 'lucide-react';
import { CreditCard, CreditCardInvoice, FinancialAccount } from '@/types/crm';
import {
  useCreditCardInvoices,
  useInvoiceTransactions,
  usePayCreditCardInvoice,
  useReopenCreditCardInvoice,
} from '@/hooks/useCreditCardInvoices';
import { useFinancialAccounts } from '@/hooks/useFinancialAccounts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FINANCE_DB_USER_HINT } from '@/lib/postgrest-errors';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const monthLabel = (year: number, month: number) =>
  format(new Date(year, month - 1, 1), 'MMM/yyyy', { locale: ptBR });

interface CreditCardInvoicesViewProps {
  card: CreditCard | null;
  source?: string;
}

export function CreditCardInvoicesView({ card, source }: CreditCardInvoicesViewProps) {
  const { data: invoices, isLoading, schemaMissing } = useCreditCardInvoices(card?.id || null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const selectedInvoice = useMemo(() => {
    if (!invoices?.length) return null;
    return invoices.find((i) => i.id === selectedInvoiceId) || invoices[0];
  }, [invoices, selectedInvoiceId]);

  if (!card) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Selecione um cartao para visualizar as faturas.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Faturas — {card.financial_account?.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!schemaMissing && !invoices?.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma fatura ainda. Crie um lancamento com pagamento &quot;Cartao de Credito&quot;
              vinculado a este cartao para gerar a primeira fatura.
            </p>
          ) : schemaMissing ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Faturas indisponiveis</AlertTitle>
              <AlertDescription>{FINANCE_DB_USER_HINT}</AlertDescription>
            </Alert>
          ) : (
            <InvoiceTimeline
              invoices={invoices}
              selectedId={selectedInvoice?.id || null}
              onSelect={(id) => setSelectedInvoiceId(id)}
            />
          )}
        </CardContent>
      </Card>

      {selectedInvoice && (
        <InvoiceDetail invoice={selectedInvoice} source={source} />
      )}
    </div>
  );
}

interface InvoiceTimelineProps {
  invoices: CreditCardInvoice[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function InvoiceTimeline({ invoices, selectedId, onSelect }: InvoiceTimelineProps) {
  const [offset, setOffset] = useState(0);
  const visible = invoices.slice(offset, offset + 6);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        disabled={offset >= invoices.length - 6}
        onClick={() => setOffset((o) => Math.min(invoices.length - 6, o + 1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex gap-2 flex-1 overflow-x-auto">
        {visible.map((inv) => {
          const isSelected = inv.id === selectedId;
          const statusColor =
            inv.status === 'paga'
              ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
              : inv.status === 'atrasada'
                ? 'border-red-500 bg-red-50 dark:bg-red-950/30'
                : isSelected
                  ? 'border-primary ring-1 ring-primary'
                  : 'border-border';
          return (
            <button
              key={inv.id}
              onClick={() => onSelect(inv.id)}
              className={`flex-shrink-0 rounded-lg border p-3 text-left transition-colors ${statusColor} hover:bg-muted/50`}
            >
              <div className="text-xs text-muted-foreground">
                {monthLabel(inv.period_year, inv.period_month)}
              </div>
              <div className="font-mono font-bold mt-1">
                {formatCurrency(Number(inv.total_value || 0))}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Venc: {format(parseISO(inv.due_date), 'dd/MM')}
              </div>
              <Badge
                variant={
                  inv.status === 'paga'
                    ? 'default'
                    : inv.status === 'atrasada'
                      ? 'destructive'
                      : 'outline'
                }
                className="mt-2 text-xs"
              >
                {inv.status}
              </Badge>
            </button>
          );
        })}
      </div>
      <Button
        variant="ghost"
        size="icon"
        disabled={offset === 0}
        onClick={() => setOffset((o) => Math.max(0, o - 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface InvoiceDetailProps {
  invoice: CreditCardInvoice;
  source?: string;
}

function InvoiceDetail({ invoice, source }: InvoiceDetailProps) {
  const { data: transactions, isLoading } = useInvoiceTransactions(invoice.id);
  const { data: accounts } = useFinancialAccounts();
  const payInvoice = usePayCreditCardInvoice();
  const reopenInvoice = useReopenCreditCardInvoice();

  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [paymentAccountId, setPaymentAccountId] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const bankAccounts: FinancialAccount[] = useMemo(
    () => (accounts || []).filter((a) => a.type === 'bank' || a.type === 'cash'),
    [accounts],
  );

  const isPaid = invoice.status === 'paga';

  const handlePay = () => {
    if (!paymentAccountId) return;
    payInvoice.mutate(
      {
        invoice,
        paymentAccountId,
        paymentDate,
        source,
      },
      { onSuccess: () => setPayDialogOpen(false) },
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>
            Fatura {monthLabel(invoice.period_year, invoice.period_month)}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Fechamento: {format(parseISO(invoice.closing_date), 'dd/MM/yyyy')} · Vencimento:{' '}
            {format(parseISO(invoice.due_date), 'dd/MM/yyyy')}
            {invoice.paid_date && (
              <> · Pago em: {format(parseISO(invoice.paid_date), 'dd/MM/yyyy')}</>
            )}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-2xl font-bold font-mono">
            {formatCurrency(Number(invoice.total_value || 0))}
          </div>
          <div className="mt-2 flex gap-2 justify-end">
            {!isPaid ? (
              <Button size="sm" onClick={() => setPayDialogOpen(true)}>
                <Wallet className="mr-2 h-4 w-4" />
                Pagar fatura
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => reopenInvoice.mutate(invoice)}
                disabled={reopenInvoice.isPending}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reabrir
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !transactions?.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhum lancamento nesta fatura.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-2 px-4">Data</th>
                <th className="text-left py-2 px-4">Descricao</th>
                <th className="text-left py-2 px-4">Conta</th>
                <th className="text-center py-2 px-4">Parcela</th>
                <th className="text-right py-2 px-4">Valor</th>
                <th className="text-center py-2 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b">
                  <td className="py-2 px-4">{format(parseISO(tx.date), 'dd/MM')}</td>
                  <td className="py-2 px-4">{tx.description}</td>
                  <td className="py-2 px-4 text-xs">
                    {tx.account?.id} · {tx.account?.name}
                  </td>
                  <td className="text-center py-2 px-4 text-xs">
                    {tx.installment_total
                      ? `${tx.installment_number}/${tx.installment_total}`
                      : '-'}
                  </td>
                  <td className="text-right py-2 px-4 font-mono text-red-600">
                    {formatCurrency(Number(tx.value || 0))}
                  </td>
                  <td className="text-center py-2 px-4">
                    {tx.status === 'baixado' ? (
                      <Badge variant="default" className="text-xs">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        baixado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {tx.status}
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagar fatura</DialogTitle>
            <DialogDescription>
              Sera criado um lancamento de saida na conta escolhida. Todas as compras desta fatura
              serao marcadas como baixadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Conta de pagamento</Label>
              <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta (banco/caixa)" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} · {acc.type === 'bank' ? 'Banco' : 'Caixa'} ·{' '}
                      {formatCurrency(Number(acc.current_balance || 0))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data do pagamento</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium">Total da fatura: {formatCurrency(Number(invoice.total_value || 0))}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Vencimento: {format(parseISO(invoice.due_date), 'dd/MM/yyyy')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handlePay}
              disabled={!paymentAccountId || payInvoice.isPending}
            >
              {payInvoice.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
