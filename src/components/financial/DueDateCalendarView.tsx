import { useMemo, useState } from 'react';
import {
  parseISO,
  format,
  isSameDay,
  differenceInCalendarDays,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { CalendarClock, CheckCircle2, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { CashFlowTransaction } from '@/types/crm';
import { useSettleByDueDate } from '@/hooks/useCashFlow';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type Semaforo = 'baixado' | 'ok' | 'amarelo' | 'vermelho';

function getSemaforo(tx: CashFlowTransaction, today: Date): Semaforo {
  if (tx.status === 'baixado') return 'baixado';
  const due = tx.due_date ? parseISO(tx.due_date) : parseISO(tx.date);
  const diff = differenceInCalendarDays(due, today);
  if (diff < 0) return 'vermelho';
  if (diff <= 5) return 'amarelo';
  return 'ok';
}

const SEMAFORO_LABEL: Record<Semaforo, string> = {
  baixado: 'Baixado',
  ok: 'Em dia',
  amarelo: 'Vence em breve',
  vermelho: 'Atrasado',
};

const SEMAFORO_BADGE: Record<Semaforo, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  baixado: 'default',
  ok: 'outline',
  amarelo: 'secondary',
  vermelho: 'destructive',
};

interface DueDateCalendarViewProps {
  transactions: CashFlowTransaction[];
  isLoading?: boolean;
}

export function DueDateCalendarView({ transactions, isLoading }: DueDateCalendarViewProps) {
  const [month, setMonth] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const settle = useSettleByDueDate();

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  // Indexar transacoes pelo due_date (string yyyy-MM-dd)
  const txByDay = useMemo(() => {
    const map = new Map<string, CashFlowTransaction[]>();
    for (const tx of transactions || []) {
      const dueRaw = tx.due_date || tx.date;
      if (!dueRaw) continue;
      const key = dueRaw.slice(0, 10);
      const list = map.get(key) || [];
      list.push(tx);
      map.set(key, list);
    }
    return map;
  }, [transactions]);

  const monthBounds = useMemo(() => ({
    start: startOfMonth(month),
    end: endOfMonth(month),
  }), [month]);

  // Modificadores para o calendario (dias com pendencias / atrasados)
  const modifiers = useMemo(() => {
    const overdue: Date[] = [];
    const upcoming: Date[] = [];
    const ok: Date[] = [];
    const paid: Date[] = [];
    for (const [key, txs] of txByDay.entries()) {
      const day = parseISO(key);
      if (day < monthBounds.start || day > monthBounds.end) continue;
      const semas = txs.map((t) => getSemaforo(t, today));
      if (semas.includes('vermelho')) overdue.push(day);
      else if (semas.includes('amarelo')) upcoming.push(day);
      else if (semas.includes('ok')) ok.push(day);
      else paid.push(day);
    }
    return { overdue, upcoming, ok, paid };
  }, [txByDay, monthBounds, today]);

  const modifiersClassNames = {
    overdue: 'bg-red-100 text-red-900 font-semibold dark:bg-red-950/50 dark:text-red-200',
    upcoming: 'bg-yellow-100 text-yellow-900 font-semibold dark:bg-yellow-950/50 dark:text-yellow-200',
    ok: 'bg-green-100 text-green-900 dark:bg-green-950/50 dark:text-green-200',
    paid: 'opacity-60',
  };

  // Lista de transacoes do dia selecionado
  const dayTransactions = useMemo(() => {
    if (!selectedDay) return [];
    const key = format(selectedDay, 'yyyy-MM-dd');
    return (txByDay.get(key) || []).slice().sort((a, b) =>
      a.type === b.type ? Number(b.value) - Number(a.value) : a.type === 'income' ? -1 : 1,
    );
  }, [selectedDay, txByDay]);

  // Resumo do mes corrente
  const monthSummary = useMemo(() => {
    let overdueTotal = 0;
    let upcomingTotal = 0;
    let okTotal = 0;
    let paidTotal = 0;
    for (const [key, txs] of txByDay.entries()) {
      const day = parseISO(key);
      if (day < monthBounds.start || day > monthBounds.end) continue;
      for (const tx of txs) {
        const value = Number(tx.value || 0);
        const sema = getSemaforo(tx, today);
        if (sema === 'vermelho') overdueTotal += value;
        else if (sema === 'amarelo') upcomingTotal += value;
        else if (sema === 'ok') okTotal += value;
        else paidTotal += value;
      }
    }
    return { overdueTotal, upcomingTotal, okTotal, paidTotal };
  }, [txByDay, monthBounds, today]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Atrasados
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">
              {formatCurrency(monthSummary.overdueTotal)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 text-yellow-600" />
              Vence em ate 5 dias
            </div>
            <p className="text-2xl font-bold mt-1 text-yellow-600">
              {formatCurrency(monthSummary.upcomingTotal)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarClock className="h-4 w-4 text-green-600" />
              Em dia
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">
              {formatCurrency(monthSummary.okTotal)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              Baixados (mes)
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(monthSummary.paidTotal)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Calendario de vencimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDay || undefined}
              onSelect={(d) => setSelectedDay(d ?? null)}
              month={month}
              onMonthChange={setMonth}
              locale={ptBR}
              modifiers={modifiers}
              modifiersClassNames={modifiersClassNames}
            />
            <div className="mt-4 space-y-2 text-xs">
              <Legend color="bg-red-200" label="Atrasados" />
              <Legend color="bg-yellow-200" label="Vence em ate 5 dias" />
              <Legend color="bg-green-200" label="Em dia (>5 dias)" />
              <Legend color="bg-muted" label="Apenas baixados" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedDay
                ? format(selectedDay, "EEEE, dd 'de' MMMM", { locale: ptBR })
                : 'Selecione um dia'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dayTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum lancamento neste dia.
              </p>
            ) : (
              <div className="space-y-2">
                {dayTransactions.map((tx) => {
                  const sema = getSemaforo(tx, today);
                  const isExpense = tx.type === 'expense';
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{tx.description}</p>
                          <Badge variant={SEMAFORO_BADGE[sema]} className="text-xs">
                            {SEMAFORO_LABEL[sema]}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {tx.account?.id} · {tx.account?.name}
                          {tx.financial_account?.name && (
                            <> · {tx.financial_account.name}</>
                          )}
                        </p>
                      </div>
                      <div className="text-right ml-3">
                        <div
                          className={`font-mono font-medium ${
                            isExpense ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {isExpense ? '-' : '+'}{formatCurrency(Number(tx.value || 0))}
                        </div>
                        {tx.status !== 'baixado' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-1 h-7 text-xs"
                            onClick={() => settle.mutate({ id: tx.id })}
                            disabled={settle.isPending}
                          >
                            Baixar
                          </Button>
                        )}
                        {tx.status === 'baixado' && tx.paid_date && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Pago {isSameDay(parseISO(tx.paid_date), today) ? 'hoje' : format(parseISO(tx.paid_date), 'dd/MM')}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block h-3 w-3 rounded-sm ${color}`} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
