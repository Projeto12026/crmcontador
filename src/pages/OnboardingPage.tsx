import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  UserPlus, 
  Plus, 
  FileText, 
  Clock, 
  CheckCircle2, 
  Loader2,
  Trash2,
  Users,
} from 'lucide-react';
import { 
  useClientOnboardings, 
  useOnboardingTemplates,
  useDeleteOnboardingTemplate,
} from '@/hooks/useOnboarding';
import { OnboardingTemplateDialog } from '@/components/onboarding/OnboardingTemplateDialog';
import { StartOnboardingDialog } from '@/components/onboarding/StartOnboardingDialog';
import { OnboardingCard } from '@/components/onboarding/OnboardingCard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function OnboardingPage() {
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  const { data: onboardings, isLoading: loadingOnboardings } = useClientOnboardings();
  const { data: templates, isLoading: loadingTemplates } = useOnboardingTemplates();
  const deleteTemplate = useDeleteOnboardingTemplate();

  const inProgressOnboardings = onboardings?.filter(o => o.status === 'in_progress') || [];
  const completedOnboardings = onboardings?.filter(o => o.status === 'completed') || [];
  const pendingOnboardings = onboardings?.filter(o => o.status === 'pending') || [];

  const handleDeleteTemplate = async () => {
    if (templateToDelete) {
      await deleteTemplate.mutateAsync(templateToDelete);
      setTemplateToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Onboarding</h1>
          <p className="text-muted-foreground">Gerencie a integração de novos clientes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTemplateDialog(true)}>
            <FileText className="mr-2 h-4 w-4" />
            Novo Template
          </Button>
          <Button onClick={() => setShowStartDialog(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Iniciar Onboarding
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressOnboardings.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedOnboardings.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Templates</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOnboardings.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="onboardings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="onboardings">
            Onboardings ({onboardings?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="templates">
            Templates ({templates?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="onboardings" className="space-y-4">
          {loadingOnboardings ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : onboardings?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum onboarding em andamento</h3>
                <p className="text-muted-foreground text-center max-w-md mb-4">
                  Comece selecionando um cliente e um template para iniciar o processo de integração.
                </p>
                <Button onClick={() => setShowStartDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Iniciar Onboarding
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* In Progress */}
              {inProgressOnboardings.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-500" />
                    Em Andamento ({inProgressOnboardings.length})
                  </h3>
                  <div className="grid gap-4">
                    {inProgressOnboardings.map((onboarding) => (
                      <OnboardingCard key={onboarding.id} onboarding={onboarding} />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed */}
              {completedOnboardings.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Concluídos ({completedOnboardings.length})
                  </h3>
                  <div className="grid gap-4">
                    {completedOnboardings.map((onboarding) => (
                      <OnboardingCard key={onboarding.id} onboarding={onboarding} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          {loadingTemplates ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : templates?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum template criado</h3>
                <p className="text-muted-foreground text-center max-w-md mb-4">
                  Crie templates com checklists personalizados para diferentes tipos de clientes.
                </p>
                <Button onClick={() => setShowTemplateDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates?.map((template) => (
                <Card key={template.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        {template.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {template.description}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setTemplateToDelete(template.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">
                        {template.items?.length || 0} itens
                      </Badge>
                    </div>
                    {template.items && template.items.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {template.items.slice(0, 3).map((item) => (
                          <p key={item.id} className="text-sm text-muted-foreground truncate">
                            • {item.title}
                          </p>
                        ))}
                        {template.items.length > 3 && (
                          <p className="text-sm text-muted-foreground">
                            +{template.items.length - 3} mais...
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <OnboardingTemplateDialog 
        open={showTemplateDialog} 
        onOpenChange={setShowTemplateDialog} 
      />
      <StartOnboardingDialog 
        open={showStartDialog} 
        onOpenChange={setShowStartDialog} 
      />

      <AlertDialog open={!!templateToDelete} onOpenChange={() => setTemplateToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá desativar o template. Onboardings existentes que usam este template não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
