import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { empresaSchema, EmpresaFormData, formatCNPJ } from '@/lib/validators';
import { Empresa, FormaEnvio } from '@/types/empresa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface EmpresaFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa?: Empresa | null;
  onSubmit: (data: EmpresaFormData) => void;
  isLoading?: boolean;
}

export function EmpresaForm({
  open,
  onOpenChange,
  empresa,
  onSubmit,
  isLoading,
}: EmpresaFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<EmpresaFormData>({
    resolver: zodResolver(empresaSchema),
    defaultValues: {
      nome: empresa?.nome || '',
      apelido: empresa?.apelido || '',
      cnpj: empresa?.cnpj ? formatCNPJ(empresa.cnpj) : '',
      dia_vencimento: empresa?.dia_vencimento || undefined,
      forma_envio: empresa?.forma_envio || 'EMAIL',
      telefone: empresa?.telefone || '',
    },
  });

  const formaEnvio = watch('forma_envio');

  const handleFormSubmit = (data: EmpresaFormData) => {
    onSubmit(data);
    reset();
    onOpenChange(false);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {empresa ? 'Editar Empresa' : 'Nova Empresa'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                {...register('nome')}
                placeholder="Nome da empresa"
              />
              {errors.nome && (
                <p className="text-sm text-destructive">{errors.nome.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="apelido">Apelido</Label>
              <Input
                id="apelido"
                {...register('apelido')}
                placeholder="Apelido (opcional)"
              />
              {errors.apelido && (
                <p className="text-sm text-destructive">{errors.apelido.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ *</Label>
              <Input
                id="cnpj"
                {...register('cnpj')}
                placeholder="00.000.000/0000-00"
              />
              {errors.cnpj && (
                <p className="text-sm text-destructive">{errors.cnpj.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dia_vencimento">Dia de Vencimento</Label>
                <Input
                  id="dia_vencimento"
                  type="number"
                  min={1}
                  max={31}
                  {...register('dia_vencimento', { valueAsNumber: true })}
                  placeholder="1-31"
                />
                {errors.dia_vencimento && (
                  <p className="text-sm text-destructive">{errors.dia_vencimento.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="forma_envio">Forma de Envio</Label>
                <Select
                  value={formaEnvio}
                  onValueChange={(value: FormaEnvio) => setValue('forma_envio', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMAIL">E-mail</SelectItem>
                    <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                    <SelectItem value="CORA">Cora</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                {...register('telefone')}
                placeholder="(00) 00000-0000"
              />
              {errors.telefone && (
                <p className="text-sm text-destructive">{errors.telefone.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}