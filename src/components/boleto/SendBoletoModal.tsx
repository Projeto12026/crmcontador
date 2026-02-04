import { useState, useEffect, forwardRef } from 'react';
import { useEmpresas } from '@/hooks/useEmpresas';
import { supabase } from '@/integrations/supabase/client';
import { Empresa, BoletoStep, ProcessBoletoResult } from '@/types/empresa';
import { BoletoResult } from './BoletoResult';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SendBoletoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INITIAL_STEPS: BoletoStep[] = [
  { id: 'validation', label: 'Validando dados', status: 'pending' },
  { id: 'search_invoice', label: 'Buscando boleto na Cora', status: 'pending' },
  { id: 'get_details', label: 'Obtendo detalhes', status: 'pending' },
  { id: 'download_pdf', label: 'Baixando PDF', status: 'pending' },
  { id: 'get_config', label: 'Carregando configurações', status: 'pending' },
  { id: 'prepare_message', label: 'Preparando mensagem', status: 'pending' },
  { id: 'send_text', label: 'Enviando texto via WhatsApp', status: 'pending' },
  { id: 'wait', label: 'Aguardando 5 segundos', status: 'pending' },
  { id: 'send_pdf', label: 'Enviando PDF via WhatsApp', status: 'pending' },
];

export const SendBoletoModal = forwardRef<HTMLDivElement, SendBoletoModalProps>(function SendBoletoModal({ open, onOpenChange }, ref) {
  const { data: empresas, isLoading: loadingEmpresas } = useEmpresas();
  const { toast } = useToast();

  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('');
  const [competencia, setCompetencia] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [competenciaError, setCompetenciaError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [steps, setSteps] = useState<BoletoStep[]>(INITIAL_STEPS);
  const [result, setResult] = useState<ProcessBoletoResult | undefined>();
  const [showProgress, setShowProgress] = useState(false);

  const selectedEmpresa = empresas?.find(e => e.id === selectedEmpresaId);

  useEffect(() => {
    if (!open) {
      // Reset state when modal closes
      setTimeout(() => {
        setSteps(INITIAL_STEPS);
        setResult(undefined);
        setShowProgress(false);
        setSelectedEmpresaId('');
        setCompetencia('');
        setInvoiceId('');
        setCompetenciaError('');
      }, 300);
    }
  }, [open]);

  const validateCompetencia = (value: string): boolean => {
    if (!/^\d{2}\/\d{4}$/.test(value)) {
      setCompetenciaError('Formato inválido. Use MM/AAAA');
      return false;
    }

    const [month, year] = value.split('/').map(Number);
    if (month < 1 || month > 12) {
      setCompetenciaError('Mês inválido (01-12)');
      return false;
    }

    if (year < 2020 || year > 2030) {
      setCompetenciaError('Ano inválido');
      return false;
    }

    setCompetenciaError('');
    return true;
  };

  const handleCompetenciaChange = (value: string) => {
    let formatted = value.replace(/\D/g, '');
    if (formatted.length > 2) {
      formatted = formatted.slice(0, 2) + '/' + formatted.slice(2, 6);
    }
    setCompetencia(formatted);
    
    if (formatted.length === 7) {
      validateCompetencia(formatted);
    } else {
      setCompetenciaError('');
    }
  };

  const updateStepStatus = (stepId: string, status: BoletoStep['status'], error?: string) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, error } : step
    ));
  };

  const handleSend = async () => {
    if (!selectedEmpresa || !competencia) return;
    if (!validateCompetencia(competencia)) return;

    if (!selectedEmpresa.telefone) {
      toast({
        title: 'Erro',
        description: 'Empresa sem telefone cadastrado',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setShowProgress(true);
    setSteps(INITIAL_STEPS.map(s => ({ ...s, status: 'pending' })));
    setResult(undefined);

    // Start with validation step loading
    updateStepStatus('validation', 'loading');

    try {
      const { data, error } = await supabase.functions.invoke('process-boleto', {
        body: {
          empresa: {
            nome: selectedEmpresa.nome,
            cnpj: selectedEmpresa.cnpj,
            telefone: selectedEmpresa.telefone,
            apelido: selectedEmpresa.apelido || undefined,
          },
          competencia,
          invoiceId: invoiceId || undefined,
        },
      });

      if (error) throw error;

      // Update steps based on response
      if (data.steps) {
        data.steps.forEach((s: { step: string; success: boolean; error?: string }) => {
          updateStepStatus(s.step, s.success ? 'success' : 'error', s.error);
        });
      }

      if (data.success) {
        setResult({
          success: true,
          details: data.details,
        });
        toast({
          title: 'Boleto enviado!',
          description: `Enviado para ${data.details.empresa}: R$ ${data.details.valor}`,
        });
      } else {
        setResult({
          success: false,
          error: data.error,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setResult({
        success: false,
        error: errorMessage,
      });
      toast({
        title: 'Erro ao enviar boleto',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Enviar Boleto
          </DialogTitle>
        </DialogHeader>

        {!showProgress ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="empresa">Empresa</Label>
              <Select
                value={selectedEmpresaId}
                onValueChange={setSelectedEmpresaId}
                disabled={loadingEmpresas}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas?.map((empresa) => (
                    <SelectItem key={empresa.id} value={empresa.id}>
                      {empresa.apelido || empresa.nome}
                      {!empresa.telefone && ' (sem telefone)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEmpresa && (
              <div className="text-sm text-muted-foreground space-y-1 bg-muted p-3 rounded-lg">
                <p><strong>Nome:</strong> {selectedEmpresa.nome}</p>
                <p><strong>CNPJ:</strong> {selectedEmpresa.cnpj}</p>
                <p><strong>Telefone:</strong> {selectedEmpresa.telefone || 'Não cadastrado'}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="competencia">Competência *</Label>
              <Input
                id="competencia"
                value={competencia}
                onChange={(e) => handleCompetenciaChange(e.target.value)}
                placeholder="MM/AAAA"
                maxLength={7}
              />
              {competenciaError && (
                <p className="text-sm text-destructive">{competenciaError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoiceId">ID do Boleto (opcional)</Label>
              <Input
                id="invoiceId"
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
                placeholder="Deixe em branco para buscar automaticamente"
              />
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleSend}
                disabled={!selectedEmpresaId || !competencia || competenciaError !== '' || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            <BoletoResult steps={steps} result={result} />
            
            {!isProcessing && (
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={handleClose}>
                  Fechar
                </Button>
                {result?.success === false && (
                  <Button onClick={() => setShowProgress(false)}>
                    Tentar Novamente
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});
