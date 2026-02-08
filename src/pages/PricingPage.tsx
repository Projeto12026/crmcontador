import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, BookOpen, FileText, BarChart3 } from 'lucide-react';
import { ServiceCatalogManager } from '@/components/pricing/ServiceCatalogManager';
import { PricingSimulator } from '@/components/pricing/PricingSimulator';
import { ProposalsList } from '@/components/pricing/ProposalsList';
import { PricingIndicators } from '@/components/pricing/PricingIndicators';

export function PricingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Precificação de Honorários</h1>
        <p className="text-sm text-muted-foreground">
          Metodologia baseada em custo-hora por departamento, markup detalhado, diagnóstico de complexidade e catálogo de serviços
        </p>
      </div>

      <Tabs defaultValue="simulator">
        <TabsList>
          <TabsTrigger value="simulator" className="gap-2">
            <Calculator className="h-4 w-4" />
            Simulador
          </TabsTrigger>
          <TabsTrigger value="catalog" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Catálogo de Serviços
          </TabsTrigger>
          <TabsTrigger value="proposals" className="gap-2">
            <FileText className="h-4 w-4" />
            Propostas
          </TabsTrigger>
          <TabsTrigger value="indicators" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Indicadores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="simulator" className="mt-4">
          <PricingSimulator />
        </TabsContent>

        <TabsContent value="catalog" className="mt-4">
          <ServiceCatalogManager />
        </TabsContent>

        <TabsContent value="proposals" className="mt-4">
          <ProposalsList />
        </TabsContent>

        <TabsContent value="indicators" className="mt-4">
          <PricingIndicators />
        </TabsContent>
      </Tabs>
    </div>
  );
}
