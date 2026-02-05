import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { useCreateOnboardingTemplate } from '@/hooks/useOnboarding';

interface TemplateItem {
  title: string;
  description: string;
}

// Templates pré-definidos para contabilidade
const ACCOUNTING_PRESETS = [
  {
    name: 'Novo Cliente - Empresa (Simples Nacional)',
    description: 'Checklist completo para integração de empresas optantes pelo Simples Nacional',
    items: [
      { title: 'Coletar Contrato Social e alterações', description: 'Solicitar contrato social atualizado e todas as alterações contratuais' },
      { title: 'Coletar Cartão CNPJ', description: 'Comprovante de inscrição e situação cadastral' },
      { title: 'Coletar Inscrição Estadual', description: 'Se aplicável, coletar comprovante de IE' },
      { title: 'Coletar Inscrição Municipal', description: 'Alvará de funcionamento e inscrição municipal' },
      { title: 'Coletar documentos dos sócios', description: 'RG, CPF e comprovante de residência dos sócios' },
      { title: 'Configurar acesso ao e-CAC', description: 'Procuração eletrônica para acesso ao portal da Receita Federal' },
      { title: 'Configurar certificado digital', description: 'Verificar e configurar o certificado A1 ou A3' },
      { title: 'Coletar extratos bancários', description: 'Últimos 12 meses de movimentação bancária' },
      { title: 'Coletar notas fiscais pendentes', description: 'Notas de entrada e saída dos últimos meses' },
      { title: 'Revisar obrigações acessórias', description: 'Verificar DAS, PGDAS-D, DEFIS pendentes' },
      { title: 'Configurar sistema contábil', description: 'Cadastrar empresa no sistema interno' },
      { title: 'Definir responsável interno', description: 'Atribuir contador responsável pela conta' },
      { title: 'Agendar reunião de alinhamento', description: 'Reunião inicial para definir fluxos e expectativas' },
    ],
  },
  {
    name: 'Novo Cliente - Empresa (Lucro Presumido)',
    description: 'Checklist para integração de empresas no Lucro Presumido',
    items: [
      { title: 'Coletar Contrato Social e alterações', description: 'Contrato social atualizado e alterações' },
      { title: 'Coletar Cartão CNPJ', description: 'Comprovante de inscrição e situação cadastral' },
      { title: 'Coletar Inscrição Estadual e Municipal', description: 'Documentos de inscrições estadual e municipal' },
      { title: 'Coletar documentos dos sócios', description: 'RG, CPF e comprovante de residência' },
      { title: 'Configurar acesso ao e-CAC', description: 'Procuração eletrônica para RFB' },
      { title: 'Configurar certificado digital', description: 'Verificar certificado A1 ou A3' },
      { title: 'Coletar balanço do exercício anterior', description: 'Balanço e DRE do último exercício' },
      { title: 'Coletar extratos bancários', description: 'Últimos 12 meses de movimentação' },
      { title: 'Revisar SPED Fiscal e Contribuições', description: 'Verificar obrigações SPED pendentes' },
      { title: 'Revisar DCTF e ECF', description: 'Verificar declarações federais' },
      { title: 'Configurar sistema contábil', description: 'Cadastrar empresa no sistema' },
      { title: 'Definir cronograma de entregas', description: 'Alinhar prazos de fechamento mensal' },
      { title: 'Agendar reunião de alinhamento', description: 'Reunião para definir processos' },
    ],
  },
  {
    name: 'Novo Cliente - MEI',
    description: 'Checklist simplificado para Microempreendedor Individual',
    items: [
      { title: 'Coletar CCMEI', description: 'Certificado da Condição de Microempreendedor Individual' },
      { title: 'Coletar documentos pessoais', description: 'RG, CPF e comprovante de residência' },
      { title: 'Verificar situação do DAS', description: 'Conferir pagamentos em dia e pendências' },
      { title: 'Verificar DASN-SIMEI', description: 'Declaração anual do MEI' },
      { title: 'Orientar sobre limites de faturamento', description: 'Explicar limite anual e consequências' },
      { title: 'Configurar acesso ao portal MEI', description: 'Acesso ao Portal do Empreendedor' },
      { title: 'Cadastrar no sistema interno', description: 'Cadastrar MEI no sistema contábil' },
      { title: 'Agendar orientação inicial', description: 'Reunião para orientações básicas' },
    ],
  },
  {
    name: 'Abertura de Empresa',
    description: 'Checklist para processo de abertura de nova empresa',
    items: [
      { title: 'Coletar documentos dos sócios', description: 'RG, CPF, comprovante de residência e certidão de casamento' },
      { title: 'Definir tipo societário', description: 'LTDA, SLU, S.A., etc.' },
      { title: 'Definir atividades (CNAEs)', description: 'Listar atividades principais e secundárias' },
      { title: 'Definir endereço comercial', description: 'Verificar viabilidade do endereço' },
      { title: 'Elaborar Contrato Social', description: 'Redigir contrato social ou requerimento' },
      { title: 'Protocolar na Junta Comercial', description: 'Registro do contrato social' },
      { title: 'Obter CNPJ', description: 'Solicitar inscrição na Receita Federal' },
      { title: 'Obter Inscrição Estadual', description: 'Se aplicável, solicitar IE' },
      { title: 'Obter Alvará de Funcionamento', description: 'Licença municipal para funcionamento' },
      { title: 'Configurar certificado digital', description: 'Adquirir e configurar certificado A1/A3' },
      { title: 'Configurar sistema de NF-e', description: 'Habilitar emissão de notas fiscais' },
      { title: 'Entregar kit de boas-vindas', description: 'Documentos e orientações iniciais' },
    ],
  },
];

interface OnboardingTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OnboardingTemplateDialog({ open, onOpenChange }: OnboardingTemplateDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<TemplateItem[]>([{ title: '', description: '' }]);
  const [showPresets, setShowPresets] = useState(true);

  const createTemplate = useCreateOnboardingTemplate();

  const handleAddItem = () => {
    setItems([...items, { title: '', description: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: 'title' | 'description', value: string) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleUsePreset = (preset: typeof ACCOUNTING_PRESETS[0]) => {
    setName(preset.name);
    setDescription(preset.description);
    setItems(preset.items.map(i => ({ title: i.title, description: i.description || '' })));
    setShowPresets(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter(i => i.title.trim());
    await createTemplate.mutateAsync({ name, description, items: validItems });
    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setItems([{ title: '', description: '' }]);
    setShowPresets(true);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) resetForm(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Template de Onboarding</DialogTitle>
        </DialogHeader>

        {showPresets ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Escolha um template pré-definido ou crie um do zero:
            </p>
            <div className="grid gap-3">
              {ACCOUNTING_PRESETS.map((preset, index) => (
                <div
                  key={index}
                  className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => handleUsePreset(preset)}
                >
                  <h4 className="font-medium">{preset.name}</h4>
                  <p className="text-sm text-muted-foreground">{preset.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">{preset.items.length} itens</p>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full" onClick={() => setShowPresets(false)}>
              Criar template do zero
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Template *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Novo Cliente - Simples Nacional"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o propósito deste template"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Itens do Checklist</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Item
                </Button>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {items.map((item, index) => (
                  <div key={index} className="flex gap-2 items-start p-3 bg-muted/50 rounded-lg">
                    <GripVertical className="h-5 w-5 text-muted-foreground mt-2 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Input
                        value={item.title}
                        onChange={(e) => handleItemChange(index, 'title', e.target.value)}
                        placeholder={`Item ${index + 1}`}
                      />
                      <Input
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        placeholder="Descrição (opcional)"
                        className="text-sm"
                      />
                    </div>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPresets(true)}>
                Voltar
              </Button>
              <Button type="submit" disabled={createTemplate.isPending}>
                {createTemplate.isPending ? 'Criando...' : 'Criar Template'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
