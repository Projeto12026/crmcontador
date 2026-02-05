import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, FolderKanban, ArrowRightLeft, Building2, FileCheck, Shield, MapPin, AlertTriangle } from 'lucide-react';

const subprocesses = [
  { id: 'migracao-mei-me', label: 'Migração MEI - ME', icon: ArrowRightLeft },
  { id: 'ei-slu', label: 'EI para SLU', icon: Building2 },
  { id: 'ei-ltda', label: 'EI para LTDA', icon: Building2 },
  { id: 'opcao-simples', label: 'Opção Simples', icon: FileCheck },
  { id: 'regularizacao', label: 'Regularização', icon: Shield },
  { id: 'licenciamento-cli', label: 'Licenciamento CLI', icon: MapPin },
  { id: 'empresas-regularizar', label: 'Empresas a Regularizar', icon: AlertTriangle },
];

export function ProcessesPage() {
  const [activeTab, setActiveTab] = useState('migracao-mei-me');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Processos</h1>
          <p className="text-muted-foreground">Acompanhe os processos de legalização</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Processo
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {subprocesses.map((sub) => {
            const Icon = sub.icon;
            return (
              <TabsTrigger
                key={sub.id}
                value={sub.id}
                className="flex items-center gap-2 data-[state=active]:bg-background"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{sub.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {subprocesses.map((sub) => {
          const Icon = sub.icon;
          return (
            <TabsContent key={sub.id} value={sub.id} className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    {sub.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhum processo encontrado</h3>
                  <p className="text-muted-foreground text-center max-w-md mb-4">
                    Ainda não há processos de {sub.label.toLowerCase()} cadastrados.
                  </p>
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Iniciar Processo
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
