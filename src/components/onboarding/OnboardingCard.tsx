import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Clock, 
  Trash2,
  MessageSquare,
  Building2,
} from 'lucide-react';
import { ClientOnboarding, useUpdateOnboardingItem, useCompleteOnboarding, useDeleteOnboarding } from '@/hooks/useOnboarding';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OnboardingCardProps {
  onboarding: ClientOnboarding;
}

const statusConfig = {
  pending: { label: 'Pendente', variant: 'secondary' as const, icon: Clock },
  in_progress: { label: 'Em Andamento', variant: 'default' as const, icon: Clock },
  completed: { label: 'Concluído', variant: 'outline' as const, icon: CheckCircle2 },
};

export function OnboardingCard({ onboarding }: OnboardingCardProps) {
  const [isOpen, setIsOpen] = useState(onboarding.status === 'in_progress');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const updateItem = useUpdateOnboardingItem();
  const completeOnboarding = useCompleteOnboarding();
  const deleteOnboarding = useDeleteOnboarding();

  const completedItems = onboarding.items?.filter(i => i.is_completed).length || 0;
  const totalItems = onboarding.items?.length || 0;
  const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  const handleToggleItem = async (itemId: string, isCompleted: boolean) => {
    await updateItem.mutateAsync({
      id: itemId,
      data: {
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
      },
    });
  };

  const handleSaveNotes = async (itemId: string) => {
    if (notes[itemId] !== undefined) {
      await updateItem.mutateAsync({
        id: itemId,
        data: { notes: notes[itemId] },
      });
    }
  };

  const handleComplete = async () => {
    await completeOnboarding.mutateAsync(onboarding.id);
  };

  const handleDelete = async () => {
    await deleteOnboarding.mutateAsync(onboarding.id);
    setShowDeleteDialog(false);
  };

  const StatusIcon = statusConfig[onboarding.status].icon;

  return (
    <>
      <Card className={onboarding.status === 'completed' ? 'opacity-75' : ''}>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-lg">{onboarding.client?.name}</CardTitle>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{onboarding.template?.name}</span>
                  {onboarding.created_at && (
                    <>
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(onboarding.created_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusConfig[onboarding.status].variant}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig[onboarding.status].label}
                </Badge>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-medium">{completedItems}/{totalItems} itens</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {onboarding.items?.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border ${
                      item.is_completed ? 'bg-green-50 border-green-200' : 'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={item.is_completed}
                        onCheckedChange={(checked) => handleToggleItem(item.id, !!checked)}
                        disabled={onboarding.status === 'completed'}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p className={`font-medium ${item.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                          {item.title}
                        </p>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                        )}
                        {onboarding.status !== 'completed' && (
                          <div className="flex items-center gap-2 mt-2">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Adicionar observação..."
                              value={notes[item.id] ?? item.notes ?? ''}
                              onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                              onBlur={() => handleSaveNotes(item.id)}
                              className="h-8 text-sm"
                            />
                          </div>
                        )}
                        {item.notes && onboarding.status === 'completed' && (
                          <p className="text-sm text-muted-foreground mt-1 italic">
                            Obs: {item.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between mt-4 pt-4 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir
                </Button>
                {onboarding.status === 'in_progress' && progress === 100 && (
                  <Button 
                    onClick={handleComplete}
                    disabled={completeOnboarding.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Concluir Onboarding
                  </Button>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Onboarding?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O onboarding de "{onboarding.client?.name}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
