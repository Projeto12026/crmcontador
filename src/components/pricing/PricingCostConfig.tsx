import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Settings2, Save, Calculator, Users, Clock, Percent, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';

export interface DepartmentCost {
  label: string;
  costPerHour: number;
  collaborators: number;
}

export interface MarkupBreakdown {
  taxes: number;         // Impostos sobre faturamento
  civilLiability: number; // Responsabilidade civil
  pdd: number;           // Provisão devedores duvidosos
  interest: number;      // Juros prazo médio recebimento
  profit: number;        // Lucro líquido desejado
}

export interface CostConfig {
  sellableHoursMonth: number;
  departments: Record<string, DepartmentCost>;
  markup: MarkupBreakdown;
}

const DEFAULT_DEPARTMENTS: Record<string, DepartmentCost> = {
  contabil: { label: 'Contábil', costPerHour: 75, collaborators: 3 },
  fiscal: { label: 'Fiscal', costPerHour: 80, collaborators: 2 },
  pessoal: { label: 'Pessoal', costPerHour: 70, collaborators: 2 },
  societario: { label: 'Societário', costPerHour: 90, collaborators: 1 },
  consultoria: { label: 'Consultoria', costPerHour: 120, collaborators: 1 },
};

const DEFAULT_MARKUP: MarkupBreakdown = {
  taxes: 6,
  civilLiability: 3,
  pdd: 2,
  interest: 1,
  profit: 20,
};

interface Props {
  config: CostConfig;
  onChange: (config: CostConfig) => void;
}

export function PricingCostConfig({ config, onChange }: Props) {
  const totalMarkup = config.markup.taxes + config.markup.civilLiability + config.markup.pdd + config.markup.interest + config.markup.profit;

  const updateDept = (key: string, field: keyof DepartmentCost, value: number) => {
    onChange({
      ...config,
      departments: {
        ...config.departments,
        [key]: { ...config.departments[key], [field]: value },
      },
    });
  };

  const updateMarkup = (field: keyof MarkupBreakdown, value: number) => {
    onChange({
      ...config,
      markup: { ...config.markup, [field]: value },
    });
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Horas Vendáveis */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Horas Vendáveis por Colaborador
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    Das 220h pagas/mês, descontam-se domingos, feriados, treinamentos, pausas e estudo da legislação.
                    O padrão do SESCAP é ~150h/mês vendáveis.
                  </p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="space-y-2 flex-1">
                <Label>Horas vendáveis/mês por colaborador</Label>
                <Input
                  type="number"
                  min={50}
                  max={220}
                  value={config.sellableHoursMonth}
                  onChange={e => onChange({ ...config, sellableHoursMonth: Number(e.target.value) })}
                />
              </div>
              <div className="rounded-lg bg-muted p-3 text-center min-w-[120px]">
                <p className="text-xs text-muted-foreground">Horas pagas</p>
                <p className="text-lg font-bold">220h</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3 text-center min-w-[120px]">
                <p className="text-xs text-muted-foreground">Vendáveis</p>
                <p className="text-lg font-bold text-primary">{config.sellableHoursMonth}h</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center min-w-[120px]">
                <p className="text-xs text-muted-foreground">Aproveitamento</p>
                <p className="text-lg font-bold">{((config.sellableHoursMonth / 220) * 100).toFixed(0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Custo por Departamento */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Custo/Hora por Departamento
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    O custo/hora de cada departamento é calculado dividindo os custos fixos alocados
                    pelo número de horas vendáveis dos colaboradores daquele setor.
                  </p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-3 text-xs font-medium text-muted-foreground px-1">
                <span>Departamento</span>
                <span>Custo/Hora (R$)</span>
                <span>Colaboradores</span>
                <span>Capacidade/Mês</span>
              </div>
              {Object.entries(config.departments).map(([key, dept]) => (
                <div key={key} className="grid grid-cols-4 gap-3 items-center">
                  <Badge variant="outline" className="justify-center">{dept.label}</Badge>
                  <Input
                    type="number"
                    min={1}
                    value={dept.costPerHour}
                    onChange={e => updateDept(key, 'costPerHour', Number(e.target.value))}
                    className="h-8"
                  />
                  <Input
                    type="number"
                    min={0}
                    value={dept.collaborators}
                    onChange={e => updateDept(key, 'collaborators', Number(e.target.value))}
                    className="h-8"
                  />
                  <div className="text-sm text-center font-medium">
                    {(dept.collaborators * config.sellableHoursMonth).toFixed(0)}h
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Markup Detalhado */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Composição do Mark-Up
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    O mark-up é o percentual aplicado ao custo/hora para chegar ao preço de venda.
                    Deve considerar impostos, responsabilidade civil, inadimplência, juros e lucro desejado.
                  </p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1">
                <Label className="text-xs">Impostos s/ Faturamento (%)</Label>
                <Input type="number" min={0} step={0.5} value={config.markup.taxes} onChange={e => updateMarkup('taxes', Number(e.target.value))} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Resp. Civil (%)</Label>
                <Input type="number" min={0} step={0.5} value={config.markup.civilLiability} onChange={e => updateMarkup('civilLiability', Number(e.target.value))} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">PDD - Inadimplência (%)</Label>
                <Input type="number" min={0} step={0.5} value={config.markup.pdd} onChange={e => updateMarkup('pdd', Number(e.target.value))} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Juros Recebimento (%)</Label>
                <Input type="number" min={0} step={0.5} value={config.markup.interest} onChange={e => updateMarkup('interest', Number(e.target.value))} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Lucro Desejado (%)</Label>
                <Input type="number" min={0} step={0.5} value={config.markup.profit} onChange={e => updateMarkup('profit', Number(e.target.value))} className="h-8" />
              </div>
            </div>
            <Separator className="my-4" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Mark-Up Total</span>
              <span className="text-2xl font-bold text-primary">{totalMarkup.toFixed(1)}%</span>
            </div>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {Object.entries(config.departments).map(([key, dept]) => {
                const sellingPrice = dept.costPerHour * (1 + totalMarkup / 100);
                return (
                  <div key={key} className="rounded-lg bg-muted p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">{dept.label}</p>
                    <p className="text-sm font-bold">R$ {sellingPrice.toFixed(0)}/h</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

export function getDefaultCostConfig(): CostConfig {
  return {
    sellableHoursMonth: 150,
    departments: { ...DEFAULT_DEPARTMENTS },
    markup: { ...DEFAULT_MARKUP },
  };
}
