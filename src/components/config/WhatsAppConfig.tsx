import { useState, useEffect } from 'react';
import { useWhatsAppConfig, useSaveWhatsAppConfig, useTestWhatsAppConnection } from '@/hooks/useWhatsApp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Loader2, CheckCircle2, XCircle } from 'lucide-react';

export function WhatsAppConfig() {
  const { data: config, isLoading } = useWhatsAppConfig();
  const saveMutation = useSaveWhatsAppConfig();
  const testMutation = useTestWhatsAppConnection();

  const [token, setToken] = useState('');
  const [apiUrl, setApiUrl] = useState('https://api-whatsapp.wascript.com.br');
  const [ativo, setAtivo] = useState(false);

  useEffect(() => {
    if (config) {
      setToken(config.token || '');
      setApiUrl(config.api_url || 'https://api-whatsapp.wascript.com.br');
      setAtivo(config.ativo);
    }
  }, [config]);

  const handleSave = () => {
    saveMutation.mutate({
      id: config?.id,
      token,
      api_url: apiUrl,
      ativo,
    });
  };

  const handleTest = () => {
    if (!token || !apiUrl) return;
    testMutation.mutate({ token, apiUrl });
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
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <CardTitle>Configurações do WhatsApp</CardTitle>
        </div>
        <CardDescription>
          Configure a conexão com a API Wascript para envio de mensagens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="api_url">URL da API</Label>
          <Input
            id="api_url"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://api-whatsapp.wascript.com.br"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="token">Token</Label>
          <Input
            id="token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Seu token da API Wascript"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="ativo"
            checked={ativo}
            onCheckedChange={setAtivo}
          />
          <Label htmlFor="ativo">Ativo</Label>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
          
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testMutation.isPending || !token || !apiUrl}
          >
            {testMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testando...
              </>
            ) : testMutation.isSuccess ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4 text-primary" />
                Conectado
              </>
            ) : testMutation.isError ? (
              <>
                <XCircle className="mr-2 h-4 w-4 text-destructive" />
                Erro
              </>
            ) : (
              'Testar Conexão'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
