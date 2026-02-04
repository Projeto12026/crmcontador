import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">Personalize o sistema</p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Settings className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Configurações do Sistema</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Em breve você poderá configurar templates de processos, 
            categorias financeiras e outras opções do sistema.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
