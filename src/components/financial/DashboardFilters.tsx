import { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

export type DashboardFilterMode = 'month' | 'year' | 'custom';

export interface DashboardFilterValues {
  startDate: string;
  endDate: string;
}

interface DashboardFiltersProps {
  onChange: (values: DashboardFilterValues) => void;
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
const monthNames = Array.from({ length: 12 }, (_, i) =>
  format(new Date(2000, i), 'MMMM', { locale: ptBR })
);

export function DashboardFilters({ onChange }: DashboardFiltersProps) {
  const [mode, setMode] = useState<DashboardFilterMode>('year');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();

  const applyFilter = (newMode?: DashboardFilterMode, year?: number, month?: number) => {
    const m = newMode ?? mode;
    const y = year ?? selectedYear;
    const mo = month ?? selectedMonth;

    if (m === 'month') {
      const d = new Date(y, mo);
      onChange({ startDate: format(startOfMonth(d), 'yyyy-MM-dd'), endDate: format(endOfMonth(d), 'yyyy-MM-dd') });
    } else if (m === 'year') {
      const d = new Date(y, 0);
      onChange({ startDate: format(startOfYear(d), 'yyyy-MM-dd'), endDate: format(endOfYear(d), 'yyyy-MM-dd') });
    }
  };

  const handleModeChange = (newMode: DashboardFilterMode) => {
    setMode(newMode);
    if (newMode !== 'custom') {
      applyFilter(newMode);
    }
  };

  const handleYearChange = (y: string) => {
    const year = parseInt(y);
    setSelectedYear(year);
    applyFilter(mode, year);
  };

  const handleMonthChange = (m: string) => {
    const month = parseInt(m);
    setSelectedMonth(month);
    applyFilter('month', selectedYear, month);
  };

  const handleCustomStartSelect = (date: Date | undefined) => {
    setCustomStart(date);
    if (date && customEnd) {
      onChange({ startDate: format(date, 'yyyy-MM-dd'), endDate: format(customEnd, 'yyyy-MM-dd') });
    }
  };

  const handleCustomEndSelect = (date: Date | undefined) => {
    setCustomEnd(date);
    if (customStart && date) {
      onChange({ startDate: format(customStart, 'yyyy-MM-dd'), endDate: format(date, 'yyyy-MM-dd') });
    }
  };

  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          {/* Mode selector */}
          <div className="flex gap-1 rounded-lg border p-0.5">
            {[
              { value: 'month' as const, label: 'Mês' },
              { value: 'year' as const, label: 'Ano' },
              { value: 'custom' as const, label: 'Personalizado' },
            ].map(opt => (
              <Button
                key={opt.value}
                variant={mode === opt.value ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-3"
                onClick={() => handleModeChange(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          {/* Year selector (always visible for month/year modes) */}
          {mode !== 'custom' && (
            <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
              <SelectTrigger className="w-[100px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Month selector (only for month mode) */}
          {mode === 'month' && (
            <Select value={selectedMonth.toString()} onValueChange={handleMonthChange}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthNames.map((name, idx) => (
                  <SelectItem key={idx} value={idx.toString()} className="capitalize">{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Custom date pickers */}
          {mode === 'custom' && (
            <div className="flex gap-2 items-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1", !customStart && "text-muted-foreground")}>
                    <CalendarIcon className="h-3 w-3" />
                    {customStart ? format(customStart, 'dd/MM/yyyy') : 'Início'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customStart} onSelect={handleCustomStartSelect} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground text-xs">até</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1", !customEnd && "text-muted-foreground")}>
                    <CalendarIcon className="h-3 w-3" />
                    {customEnd ? format(customEnd, 'dd/MM/yyyy') : 'Fim'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customEnd} onSelect={handleCustomEndSelect} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
