import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { Loader2, Eye, EyeOff, Save, Key, Webhook, Download, Database, FileJson } from 'lucide-react';

export function SettingsPage() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [gclickAppKey, setGclickAppKey] = useState('');
  const [gclickAppSecret, setGclickAppSecret] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingGclick, setIsSavingGclick] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['zapier_webhook_url', 'gclick_credentials', 'last_backup']);

      if (data) {
        for (const setting of data) {
          if (setting.key === 'zapier_webhook_url' && setting.value && typeof setting.value === 'object' && 'webhookUrl' in setting.value) {
            setWebhookUrl((setting.value as any).webhookUrl || '');
          }
          if (setting.key === 'gclick_credentials' && setting.value && typeof setting.value === 'object') {
            const val = setting.value as any;
            setGclickAppKey(val.app_key || '');
            setGclickAppSecret(val.app_secret || '');
          }
          if (setting.key === 'last_backup' && setting.value && typeof setting.value === 'object' && 'date' in setting.value) {
            setLastBackup((setting.value as any).date || null);
          }
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveWebhook = async () => {
    if (!webhookUrl.trim()) {
      toast({ title: 'Erro', description: 'URL do webhook é obrigatória', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'zapier_webhook_url', value: { webhookUrl } }, { onConflict: 'key' });
      if (error) throw error;
      toast({ title: 'Sucesso!', description: 'URL do webhook Zapier salva com sucesso' });
    } catch (error) {
      toast({ title: 'Erro', description: error instanceof Error ? error.message : 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGclick = async () => {
    if (!gclickAppKey.trim() || !gclickAppSecret.trim()) {
      toast({ title: 'Erro', description: 'App Key e App Secret são obrigatórios', variant: 'destructive' });
      return;
    }
    setIsSavingGclick(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert(
          { key: 'gclick_credentials', value: { app_key: gclickAppKey, app_secret: gclickAppSecret } },
          { onConflict: 'key' }
        );
      if (error) throw error;
      toast({ title: 'Sucesso!', description: 'Credenciais G-Click salvas com sucesso' });
    } catch (error) {
      toast({ title: 'Erro', description: error instanceof Error ? error.message : 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setIsSavingGclick(false);
    }
  };

  const downloadJson = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBackupData = async () => {
    setIsBackingUp(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error } = await supabase.functions.invoke('backup-data', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      const dateStr = new Date().toISOString().slice(0, 10);
      downloadJson(data, `backup-completo-${dateStr}.json`);

      // Save last backup date
      await supabase.from('settings').upsert(
        { key: 'last_backup', value: { date: new Date().toISOString() } },
        { onConflict: 'key' }
      );
      setLastBackup(new Date().toISOString());

      toast({ title: 'Sucesso!', description: 'Backup completo baixado com sucesso' });
    } catch (error) {
      toast({ title: 'Erro', description: error instanceof Error ? error.message : 'Erro ao gerar backup', variant: 'destructive' });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleBackupSchema = async () => {
    setIsBackingUp(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error } = await supabase.functions.invoke('backup-data', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      // Only tables data without metadata
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadJson(data.tables, `backup-dados-${dateStr}.json`);

      toast({ title: 'Sucesso!', description: 'Dados exportados com sucesso' });
    } catch (error) {
      toast({ title: 'Erro', description: error instanceof Error ? error.message : 'Erro ao exportar dados', variant: 'destructive' });
    } finally {
      setIsBackingUp(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Configurações</h1>
        <p className="text-sm text-muted-foreground">Personalize o sistema e integrações</p>
      </div>

      {/* G-Click Credentials */}
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Integração G-Click</CardTitle>
          </div>
          <CardDescription>
            Credenciais da API G-Click para sincronização de obrigações da folha de pagamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gclick-key">App Key</Label>
            <div className="relative">
              <Input
                id="gclick-key"
                type={showKey ? 'text' : 'password'}
                placeholder="Sua App Key do G-Click"
                value={gclickAppKey}
                onChange={(e) => setGclickAppKey(e.target.value)}
                disabled={isSavingGclick}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gclick-secret">App Secret</Label>
            <div className="relative">
              <Input
                id="gclick-secret"
                type={showSecret ? 'text' : 'password'}
                placeholder="Sua App Secret do G-Click"
                value={gclickAppSecret}
                onChange={(e) => setGclickAppSecret(e.target.value)}
                disabled={isSavingGclick}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <Button onClick={handleSaveGclick} disabled={isSavingGclick}>
            {isSavingGclick ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isSavingGclick ? 'Salvando...' : 'Salvar Credenciais'}
          </Button>
          {gclickAppKey && gclickAppSecret && (
            <div className="rounded-md bg-primary/10 p-3 text-sm text-primary">
              ✓ Credenciais configuradas. Sincronização com G-Click habilitada.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Zapier Webhook */}
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Integração Zapier</CardTitle>
          </div>
          <CardDescription>
            Webhook do Zapier para sincronizar tarefas com Google Tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook">URL do Webhook</Label>
            <Input
              id="webhook"
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              disabled={isSaving}
            />
          </div>
          <Button onClick={handleSaveWebhook} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isSaving ? 'Salvando...' : 'Salvar Webhook'}
          </Button>
          {webhookUrl && (
            <div className="rounded-md bg-primary/10 p-3 text-sm text-primary">
              ✓ Webhook configurado. Tarefas serão sincronizadas com o Zapier.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup */}
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Backup do Sistema</CardTitle>
          </div>
          <CardDescription>
            Exporte todos os dados do sistema em formato JSON para restauração futura
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button onClick={handleBackupData} disabled={isBackingUp}>
              {isBackingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {isBackingUp ? 'Gerando backup...' : 'Baixar Backup Completo'}
            </Button>
            <Button variant="outline" onClick={handleBackupSchema} disabled={isBackingUp}>
              <FileJson className="mr-2 h-4 w-4" />
              Baixar Apenas Dados
            </Button>
          </div>
          {lastBackup && (
            <div className="rounded-md bg-primary/10 p-3 text-sm text-primary">
              ✓ Último backup: {new Date(lastBackup).toLocaleString('pt-BR')}
            </div>
          )}
          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            <p className="font-medium">O backup inclui:</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li>Clientes, contatos e contratos</li>
              <li>Transações financeiras e fluxo de caixa</li>
              <li>Tarefas, processos e templates</li>
              <li>Leads e atividades comerciais</li>
              <li>Obrigações de folha de pagamento</li>
              <li>Precificação: catálogo de serviços e propostas</li>
              <li>Configurações do sistema</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
