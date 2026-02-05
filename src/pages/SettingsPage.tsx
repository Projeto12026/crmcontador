import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';

export function SettingsPage() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadWebhookUrl();
  }, []);

  const loadWebhookUrl = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'zapier_webhook_url')
        .single();

      if (data?.value && typeof data.value === 'object' && 'webhookUrl' in data.value) {
        setWebhookUrl((data.value as any).webhookUrl || '');
      }
    } catch (error) {
      console.error('Error loading webhook URL:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveWebhook = async () => {
    if (!webhookUrl.trim()) {
      toast({
        title: 'Erro',
        description: 'URL do webhook é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert(
          {
            key: 'zapier_webhook_url',
            value: { webhookUrl },
          },
          { onConflict: 'key' }
        );

      if (error) throw error;

      toast({
        title: 'Sucesso!',
        description: 'URL do webhook Zapier salva com sucesso',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao salvar',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div>Carregando configurações...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">Personalize o sistema</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Integração Zapier</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="webhook">URL do Webhook Zapier</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Cole aqui a URL do seu webhook do Zapier para sincronizar tarefas com Google Tasks
            </p>
            <Input
              id="webhook"
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              disabled={isSaving}
            />
          </div>
          <Button onClick={handleSaveWebhook} disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar Configuração'}
          </Button>
          {webhookUrl && (
            <div className="p-3 bg-primary/10 text-primary rounded text-sm">
              ✓ Webhook configurado. Tarefas serão sincronizadas com o Zapier.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
