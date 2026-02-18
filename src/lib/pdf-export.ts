import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CashFlowTransaction, CashFlowSummary } from '@/types/crm';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

function createPdf(title: string, subtitle?: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(16);
  doc.text(title, 14, 15);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(subtitle, 14, 22);
    doc.setTextColor(0);
  }
  doc.setFontSize(8);
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, doc.internal.pageSize.width - 14, 15, { align: 'right' });
  return doc;
}

// ============================================================
// Fluxo de Caixa (Transactions Table)
// ============================================================
export function exportTransactionsPdf(
  transactions: CashFlowTransaction[],
  title: string,
  period?: string,
  summary?: CashFlowSummary | null,
) {
  const doc = createPdf(title, period);
  let startY = period ? 28 : 22;

  // Summary row
  if (summary) {
    autoTable(doc, {
      startY,
      head: [['Receita Total', 'Despesa Total', 'Saldo', 'Receita Exec.', 'Despesa Exec.', 'Saldo Exec.']],
      body: [[
        formatCurrency(summary.totalIncome),
        formatCurrency(summary.totalExpense),
        formatCurrency(summary.balance),
        formatCurrency(summary.executedIncome),
        formatCurrency(summary.executedExpense),
        formatCurrency(summary.executedBalance),
      ]],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246] },
    });
    startY = (doc as any).lastAutoTable.finalY + 5;
  }

  const rows = transactions.map(tx => {
    const txDate = tx.date ? format(parseISO(tx.date), 'dd/MM/yyyy') : '';
    const account = tx.account?.name || tx.account_id;
    const futureVal = tx.type === 'income' ? Number(tx.future_income || 0) : Number(tx.future_expense || 0);
    const execVal = tx.type === 'income' ? Number(tx.income || 0) : Number(tx.expense || 0);
    const status = execVal > 0 && futureVal === 0 ? 'Executado' : futureVal > 0 && execVal === 0 ? 'Projetado' : 'Parcial';
    return [
      txDate,
      tx.type === 'income' ? 'Receita' : 'Despesa',
      account,
      tx.description,
      tx.origin_destination || '',
      formatCurrency(Number(tx.value)),
      status,
    ];
  });

  autoTable(doc, {
    startY,
    head: [['Data', 'Tipo', 'Conta', 'Descrição', 'Origem/Destino', 'Valor', 'Status']],
    body: rows,
    theme: 'striped',
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [59, 130, 246] },
    columnStyles: {
      5: { halign: 'right' },
    },
  });

  doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}.pdf`);
}

// ============================================================
// Projeção / DRE
// ============================================================
interface ProjectionRow {
  name: string;
  isGroup?: boolean;
  months: Record<string, { projected: number; executed: number; total: number }>;
}

export function exportProjectionPdf(
  rows: ProjectionRow[],
  months: Date[],
  title: string,
  monthTotals: Record<string, { projected: number; executed: number; total: number }>,
) {
  const doc = createPdf(title, `${format(months[0], 'MMM/yyyy', { locale: ptBR })} a ${format(months[months.length - 1], 'MMM/yyyy', { locale: ptBR })}`);

  const monthHeaders = months.map(m => format(m, 'MMM/yy', { locale: ptBR }));
  const head = [['Conta', ...monthHeaders]];

  const body = rows.map(row => {
    const cells = months.map(m => {
      const key = format(m, 'yyyy-MM');
      const data = row.months[key];
      return data ? formatCurrency(data.total) : '-';
    });
    return [row.name, ...cells];
  });

  // Totals row
  const totalsRow = ['TOTAL', ...months.map(m => {
    const key = format(m, 'yyyy-MM');
    const data = monthTotals[key];
    return data ? formatCurrency(data.total) : '-';
  })];
  body.push(totalsRow);

  autoTable(doc, {
    startY: 28,
    head,
    body,
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 1.5 },
    headStyles: { fillColor: [59, 130, 246], fontSize: 7 },
    columnStyles: Object.fromEntries(
      months.map((_, i) => [i + 1, { halign: 'right' as const }])
    ),
    didParseCell(data) {
      const rowIndex = data.row.index;
      // Bold group rows
      if (rowIndex < rows.length && rows[rowIndex]?.isGroup) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 240, 240];
      }
      // Bold totals row
      if (rowIndex === body.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [220, 220, 220];
      }
    },
  });

  doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}.pdf`);
}

// ============================================================
// Dashboard (KPIs + table summary)
// ============================================================
export function exportDashboardPdf(
  title: string,
  kpis: { label: string; value: string }[],
  groupData: { name: string; projected: string; executed: string; total: string }[],
  period?: string,
) {
  const doc = createPdf(title, period);

  // KPIs table
  autoTable(doc, {
    startY: period ? 28 : 22,
    head: [kpis.map(k => k.label)],
    body: [kpis.map(k => k.value)],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
    headStyles: { fillColor: [59, 130, 246] },
  });

  const afterKpis = (doc as any).lastAutoTable.finalY + 8;

  // Group breakdown
  if (groupData.length > 0) {
    autoTable(doc, {
      startY: afterKpis,
      head: [['Grupo', 'Projetado', 'Executado', 'Total']],
      body: groupData.map(g => [g.name, g.projected, g.executed, g.total]),
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    });
  }

  doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}.pdf`);
}

// ============================================================
// Parceladas (Installments)
// ============================================================
export function exportInstallmentsPdf(
  title: string,
  groups: {
    baseDescription: string;
    accountName: string;
    value: number;
    totalInstallments: number;
    paidInstallments: number;
    remainingInstallments: number;
    totalPaid: number;
    totalRemaining: number;
    lastDate: Date;
  }[],
) {
  const doc = createPdf(title);

  const body = groups.map(g => [
    g.baseDescription,
    g.accountName,
    formatCurrency(g.value),
    `${g.paidInstallments}/${g.totalInstallments}`,
    formatCurrency(g.totalPaid),
    formatCurrency(g.totalRemaining),
    format(g.lastDate, 'MM/yyyy'),
  ]);

  autoTable(doc, {
    startY: 22,
    head: [['Descrição', 'Conta', 'Parcela', 'Pagas/Total', 'Pago', 'Restante', 'Término']],
    body,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246] },
    columnStyles: { 2: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
  });

  doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}.pdf`);
}

// ============================================================
// Plano de Contas
// ============================================================
export function exportAccountsPdf(
  title: string,
  accounts: { id: string; name: string; level: number }[],
) {
  const doc = createPdf(title);

  const body = accounts.map(a => [
    '  '.repeat(a.level) + a.id,
    '  '.repeat(a.level) + a.name,
  ]);

  autoTable(doc, {
    startY: 22,
    head: [['Código', 'Nome']],
    body,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
  });

  doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}.pdf`);
}
