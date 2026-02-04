import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus } from 'lucide-react';

export function OnboardingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Onboarding</h1>
          <p className="text-muted-foreground">Gerencie a integração de novos clientes</p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Módulo de Onboarding</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Em breve você poderá criar checklists personalizados para a integração 
            de novos clientes e acompanhar o progresso.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
