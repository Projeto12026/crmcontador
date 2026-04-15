import { useCallback, useRef, useState } from 'react';
import { useBulkImportClients } from '@/hooks/useClients';
import { downloadClientsImportTemplate, parseClientsImportFile, type ParsedImportRow } from '@/lib/client-import';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function BulkImportClientsPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [importFailures, setImportFailures] = useState<string[]>([]);
  const bulkImport = useBulkImportClients();
  const { toast } = useToast();

  const resetPreview = () => {
    setFileLabel(null);
    setParseErrors([]);
    setParsedRows([]);
    setImportFailures([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const processFile = useCallback(
    (file: File) => {
      setImportFailures([]);
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
        toast({
          title: 'Formato não suportado',
          description: 'Use arquivo .xlsx, .xls ou .csv gerado a partir do modelo.',
          variant: 'destructive',
        });
        return;
      }
      setFileLabel(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        const buf = reader.result;
        if (!(buf instanceof ArrayBuffer)) {
          toast({ title: 'Não foi possível ler o arquivo', variant: 'destructive' });
          return;
        }
        const { rows, errors } = parseClientsImportFile(buf);
        setParseErrors(errors);
        setParsedRows(rows);
        if (rows.length === 0 && errors.length === 0) {
          toast({ title: 'Nenhuma linha válida', variant: 'destructive' });
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [toast],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) processFile(f);
    },
    [processFile],
  );

  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    setImportFailures([]);
    try {
      const result = await bulkImport.mutateAsync(parsedRows);
      setImportFailures(result.failures);
      const ok = result.inserted + result.updated;
      if (ok > 0) {
        toast({
          title: 'Importação concluída',
          description: `${result.inserted} novo(s), ${result.updated} atualizado(s).`,
        });
      }
      if (result.failures.length > 0) {
        const preview = result.failures.slice(0, 5).join('\n');
        toast({
          title: ok === 0 ? 'Nenhuma linha importada' : 'Algumas linhas falharam',
          description:
            result.failures.length > 5
              ? `${preview}\n… e mais ${result.failures.length - 5} erro(s).`
              : preview,
          variant: ok === 0 ? 'destructive' : 'default',
        });
      }
      if (ok > 0) {
        setParsedRows([]);
        setParseErrors([]);
        setFileLabel(null);
        if (inputRef.current) inputRef.current.value = '';
      }
    } catch (e) {
      toast({
        title: 'Erro na importação',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileSpreadsheet className="h-5 w-5" />
          Cadastro em massa (administrador)
        </CardTitle>
        <CardDescription>
          Baixe o modelo, preencha os dados (CNPJ obrigatório em cada linha para criar ou atualizar o cadastro
          correto), depois arraste ou selecione o arquivo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => downloadClientsImportTemplate()}>
            <Download className="mr-2 h-4 w-4" />
            Baixar modelo (.xlsx)
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) processFile(f);
            }}
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Selecionar arquivo
          </Button>
          {(fileLabel || parsedRows.length > 0 || parseErrors.length > 0) && (
            <Button type="button" variant="ghost" size="sm" onClick={resetPreview}>
              Limpar
            </Button>
          )}
        </div>

        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center text-sm transition-colors',
            dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
          )}
        >
          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Arraste o arquivo aqui ou clique para escolher</p>
          <p className="mt-1 text-muted-foreground">.xlsx, .xls ou .csv — use o modelo para garantir as colunas corretas</p>
          {fileLabel && <p className="mt-2 text-xs text-muted-foreground">Arquivo: {fileLabel}</p>}
        </div>

        {parseErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>Problemas ao ler a planilha</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 list-inside list-disc text-sm">
                {parseErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {parsedRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Pronto para importar: <strong>{parsedRows.length}</strong> linha(s). Clientes com o mesmo CNPJ já
              cadastrado serão atualizados; demais serão criados.
            </p>
            <Button type="button" disabled={bulkImport.isPending} onClick={handleImport}>
              {bulkImport.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando…
                </>
              ) : (
                'Importar agora'
              )}
            </Button>
          </div>
        )}

        {importFailures.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>Erros na gravação (última execução)</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 max-h-40 list-inside list-disc overflow-y-auto text-sm">
                {importFailures.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
