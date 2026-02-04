import { useState } from 'react';
import { EmpresaList } from '@/components/empresas/EmpresaList';
import { ConfigPage } from '@/components/config/ConfigPage';
import { SendBoletoModal } from '@/components/boleto/SendBoletoModal';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Settings, Send } from 'lucide-react';

const Index = () => {
  const [sendBoletoOpen, setSendBoletoOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Sistema de Boletos</h1>
          <Button onClick={() => setSendBoletoOpen(true)} className="gap-2">
            <Send className="h-4 w-4" />
            Enviar Boleto
          </Button>
        </div>
      </header>

      <main className="container mx-auto py-6 px-4">
        <Tabs defaultValue="empresas" className="space-y-6">
          <TabsList>
            <TabsTrigger value="empresas" className="gap-2">
              <Building2 className="h-4 w-4" />
              Empresas
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2">
              <Settings className="h-4 w-4" />
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="empresas">
            <EmpresaList />
          </TabsContent>

          <TabsContent value="config">
            <ConfigPage />
          </TabsContent>
        </Tabs>
      </main>

      <SendBoletoModal open={sendBoletoOpen} onOpenChange={setSendBoletoOpen} />
    </div>
  );
};

export default Index;
