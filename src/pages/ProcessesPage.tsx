import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderKanban } from 'lucide-react';

export function ProcessesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Processos</h1>
          <p className="text-muted-foreground">Acompanhe os processos de legalização</p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Módulo de Processos</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Em breve você poderá gerenciar processos de abertura, alteração e 
            encerramento de empresas com etapas configuráveis.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
