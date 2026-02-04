import { useState } from 'react';
import { useEmpresas } from '@/hooks/useEmpresas';
import { useProcessBoleto } from '@/hooks/useWhatsApp';
import { Empresa } from '@/types/empresa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Send, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SendBoletoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendBoletoModal({ open, onOpenChange }: SendBoletoModalProps) {
  const { data: empresas, isLoading: loadingEmpresas } = useEmpresas();
  const processMutation = useProcessBoleto();

  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('');
  const [competencia, setCompetencia] = useState('');
  const [competenciaError, setCompetenciaError] = useState('');

  const selectedEmpresa = empresas?.find(e => e.id === selectedEmpresaId);

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
    // Auto-format: add slash after 2 digits
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

  const handleSend = async () => {
    if (!selectedEmpresa || !competencia) return;
    
    if (!validateCompetencia(competencia)) return;

    if (!selectedEmpresa.telefone) {
      setCompetenciaError('Empresa sem telefone cadastrado');
      return;
    }

    await processMutation.mutateAsync({
      empresa: {
        nome: selectedEmpresa.nome,
        cnpj: selectedEmpresa.cnpj,
        telefone: selectedEmpresa.telefone,
        apelido: selectedEmpresa.apelido || undefined,
      },
      competencia,
    });

    onOpenChange(false);
    setSelectedEmpresaId('');
    setCompetencia('');
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedEmpresaId('');
    setCompetencia('');
    setCompetenciaError('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Enviar Boleto
          </DialogTitle>
        </DialogHeader>

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
            <Label htmlFor="competencia">Competência</Label>
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

          {processMutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {processMutation.error?.message || 'Erro ao enviar boleto'}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={!selectedEmpresaId || !competencia || competenciaError !== '' || processMutation.isPending}
          >
            {processMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Enviar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
