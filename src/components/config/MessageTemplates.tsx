import { useState, useEffect } from 'react';
import { useMessageTemplates, useSaveMessageTemplate, MessageTemplate } from '@/hooks/useWhatsApp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Plus, Loader2 } from 'lucide-react';

const PLACEHOLDER_VARIABLES = [
  { key: '{apelido}', desc: 'Apelido da empresa' },
  { key: '{nome_empresa}', desc: 'Nome da empresa' },
  { key: '{data_vencimento}', desc: 'Data de vencimento' },
  { key: '{dias_vencimento}', desc: 'Dias de vencimento/atraso' },
  { key: '{valor_boleto}', desc: 'Valor do boleto' },
];

function TemplatePreview({ template, title }: { template: string; title: string }) {
  const preview = template
    .replace(/{apelido}/g, 'Empresa ABC')
    .replace(/{nome_empresa}/g, 'Empresa ABC Ltda')
    .replace(/{data_vencimento}/g, '15/02/2026')
    .replace(/{dias_vencimento}/g, '5')
    .replace(/{valor_boleto}/g, '1.250,00');

  return (
    <div className="bg-muted rounded-lg p-4">
      <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p>
      <div className="bg-background rounded-lg p-3 whitespace-pre-wrap text-sm">
        {preview || 'Preencha o template para ver a prévia'}
      </div>
    </div>
  );
}

export function MessageTemplates() {
  const { data: templates, isLoading } = useMessageTemplates();
  const saveMutation = useSaveMessageTemplate();

  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [nome, setNome] = useState('');
  const [templateAntes, setTemplateAntes] = useState('');
  const [templatePos, setTemplatePos] = useState('');
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (templates && templates.length > 0 && !selectedTemplate) {
      selectTemplate(templates[0]);
    }
  }, [templates, selectedTemplate]);

  const selectTemplate = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setNome(template.nome);
    setTemplateAntes(template.template_antes_vencimento || '');
    setTemplatePos(template.template_pos_vencimento || '');
    setAtivo(template.ativo);
  };

  const handleSave = () => {
    saveMutation.mutate({
      id: selectedTemplate?.id,
      nome,
      template_antes_vencimento: templateAntes,
      template_pos_vencimento: templatePos,
      ativo,
    });
  };

  const handleNew = () => {
    setSelectedTemplate(null);
    setNome('Novo Template');
    setTemplateAntes(`Olá! Segue o boleto da empresa {nome_empresa}.

Vencimento: {data_vencimento}
Valor: R$ {valor_boleto}

Em caso de dúvidas, estamos à disposição.`);
    setTemplatePos(`Olá! O boleto da empresa {nome_empresa} está vencido há {dias_vencimento} dias.

Valor: R$ {valor_boleto}

Por favor, regularize o pagamento o mais breve possível.`);
    setAtivo(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle>Templates de Mensagem</CardTitle>
          </div>
          <Button onClick={handleNew} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Novo
          </Button>
        </div>
        <CardDescription>
          Configure os templates de mensagem para antes e após o vencimento
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {templates && templates.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {templates.map((t) => (
              <Button
                key={t.id}
                variant={selectedTemplate?.id === t.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => selectTemplate(t)}
              >
                {t.nome}
                {!t.ativo && ' (inativo)'}
              </Button>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="nome">Nome do Template</Label>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do template"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch id="template_ativo" checked={ativo} onCheckedChange={setAtivo} />
          <Label htmlFor="template_ativo">Template ativo</Label>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-sm font-medium mb-2">Variáveis disponíveis:</p>
          <div className="flex flex-wrap gap-2">
            {PLACEHOLDER_VARIABLES.map((v) => (
              <code
                key={v.key}
                className="text-xs bg-background px-2 py-1 rounded cursor-help"
                title={v.desc}
              >
                {v.key}
              </code>
            ))}
          </div>
        </div>

        <Tabs defaultValue="antes" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="antes">Antes do Vencimento</TabsTrigger>
            <TabsTrigger value="pos">Após Vencimento</TabsTrigger>
          </TabsList>
          
          <TabsContent value="antes" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template_antes">Template</Label>
              <Textarea
                id="template_antes"
                value={templateAntes}
                onChange={(e) => setTemplateAntes(e.target.value)}
                placeholder="Mensagem para boletos antes do vencimento"
                rows={6}
              />
            </div>
            <TemplatePreview template={templateAntes} title="Prévia da mensagem" />
          </TabsContent>
          
          <TabsContent value="pos" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template_pos">Template</Label>
              <Textarea
                id="template_pos"
                value={templatePos}
                onChange={(e) => setTemplatePos(e.target.value)}
                placeholder="Mensagem para boletos vencidos"
                rows={6}
              />
            </div>
            <TemplatePreview template={templatePos} title="Prévia da mensagem" />
          </TabsContent>
        </Tabs>

        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            'Salvar Template'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
