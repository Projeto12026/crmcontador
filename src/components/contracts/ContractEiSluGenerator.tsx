import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import { FileText, Copy, RotateCcw, CheckCircle2 } from 'lucide-react';
import {
  CONTRACT_SECTIONS,
  ContractFormValues,
  CLAUSULA_1_NOVO_SOCIO,
  replacePlaceholders,
  validateRequired,
} from '@/lib/contract-ei-slu';

export function ContractEiSluGenerator() {
  const [values, setValues] = useState<ContractFormValues>({});
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleChange = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setValues({});
    toast.info('Formulário limpo');
  };

  const handleGeneratePreview = () => {
    const missing = validateRequired(values);
    if (missing.length > 0) {
      toast.error(`Campos obrigatórios faltando: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` e mais ${missing.length - 5}` : ''}`);
      return;
    }
    setPreviewOpen(true);
  };

  const generatedClausula1 = replacePlaceholders(CLAUSULA_1_NOVO_SOCIO, values);

  const handleCopyClausula = () => {
    navigator.clipboard.writeText(generatedClausula1);
    toast.success('Cláusula 1 copiada!');
  };

  const handleCopyAllValues = () => {
    const lines = CONTRACT_SECTIONS.flatMap(section =>
      section.fields.map(f => `${f.label}: ${values[f.key] || '(vazio)'}`)
    );
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Todos os valores copiados!');
  };

  const filledCount = Object.values(values).filter(v => v?.trim()).length;
  const totalRequired = CONTRACT_SECTIONS.flatMap(s => s.fields).filter(f => f.required).length;
  const filledRequired = CONTRACT_SECTIONS.flatMap(s => s.fields).filter(f => f.required && values[f.key]?.trim()).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gerador de Contrato: EI → SLU</h2>
          <p className="text-sm text-muted-foreground">
            Preencha os campos abaixo para gerar os dados do contrato de transformação.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {filledRequired}/{totalRequired} obrigatórios
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {filledCount} preenchidos
          </Badge>
        </div>
      </div>

      <Accordion type="multiple" defaultValue={CONTRACT_SECTIONS.map(s => s.id)} className="space-y-3">
        {CONTRACT_SECTIONS.map(section => {
          const sectionFilled = section.fields.filter(f => values[f.key]?.trim()).length;
          return (
            <AccordionItem key={section.id} value={section.id} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{section.name}</span>
                  {sectionFilled === section.fields.length && sectionFilled > 0 && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                  <Badge variant="outline" className="text-xs">
                    {sectionFilled}/{section.fields.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 pb-4">
                  {section.fields.map(field => (
                    <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                      <Label htmlFor={field.key} className="text-sm">
                        {field.label}
                        {field.required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      {field.type === 'textarea' ? (
                        <Textarea
                          id={field.key}
                          value={values[field.key] || ''}
                          onChange={e => handleChange(field.key, e.target.value)}
                          placeholder={field.hint}
                          rows={3}
                          className="mt-1"
                        />
                      ) : (
                        <Input
                          id={field.key}
                          type={field.type === 'date' ? 'text' : 'text'}
                          value={values[field.key] || ''}
                          onChange={e => handleChange(field.key, e.target.value)}
                          placeholder={field.hint}
                          className="mt-1"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleGeneratePreview}>
          <FileText className="mr-2 h-4 w-4" />
          Visualizar Dados
        </Button>
        <Button variant="outline" onClick={handleCopyAllValues}>
          <Copy className="mr-2 h-4 w-4" />
          Copiar Todos os Valores
        </Button>
        <Button variant="ghost" onClick={handleReset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Limpar Formulário
        </Button>
      </div>

      {/* Cláusula 1 Preview */}
      {values.NOME_SOCIO_NOVO && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Cláusula 1 – Entrada do Novo Sócio</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCopyClausula}>
                <Copy className="mr-1 h-3 w-3" />
                Copiar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed bg-muted p-4 rounded-md">{generatedClausula1}</p>
          </CardContent>
        </Card>
      )}

      {/* Preview Modal-like card */}
      {previewOpen && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Resumo dos Dados para o Contrato</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(false)}>
                Fechar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {CONTRACT_SECTIONS.map(section => (
                <div key={section.id}>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-2">{section.name}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                    {section.fields.map(field => (
                      <div key={field.key} className="flex gap-2 text-sm py-1">
                        <span className="font-medium min-w-0 shrink-0">{field.label}:</span>
                        <span className="text-muted-foreground truncate">
                          {values[field.key] || '(vazio)'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
