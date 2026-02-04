import { useState, useEffect } from 'react';
import { Task, PriorityLevel, TaskViewType, taskViewLabels } from '@/types/crm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Client } from '@/types/crm';

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  clients: Client[];
  onSubmit: (data: TaskFormData) => Promise<void>;
  isLoading: boolean;
}

interface TaskFormData {
  title: string;
  description?: string;
  client_id?: string;
  priority: PriorityLevel;
  due_date?: string;
  is_important?: boolean;
  is_urgent?: boolean;
  is_frog?: boolean;
  ivy_lee_order?: number;
  is_focus_list?: boolean;
  enabled_views?: TaskViewType[];
}

const allViews: TaskViewType[] = ['list', 'eisenhower', 'kanban', 'two_lists', 'eat_frog', 'ivy_lee'];

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  clients,
  onSubmit,
  isLoading,
}: TaskFormDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const [dueDate, setDueDate] = useState('');
  const [isImportant, setIsImportant] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isFrog, setIsFrog] = useState(false);
  const [ivyLeeOrder, setIvyLeeOrder] = useState<number | undefined>();
  const [isFocusList, setIsFocusList] = useState(false);
  const [enabledViews, setEnabledViews] = useState<TaskViewType[]>(allViews);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setClientId(task.client_id || '');
      setPriority(task.priority);
      setDueDate(task.due_date || '');
      setIsImportant(task.is_important || false);
      setIsUrgent(task.is_urgent || false);
      setIsFrog(task.is_frog || false);
      setIvyLeeOrder(task.ivy_lee_order || undefined);
      setIsFocusList(task.is_focus_list || false);
      setEnabledViews(task.enabled_views || allViews);
    } else {
      resetForm();
    }
  }, [task, open]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setClientId('');
    setPriority('medium');
    setDueDate('');
    setIsImportant(false);
    setIsUrgent(false);
    setIsFrog(false);
    setIvyLeeOrder(undefined);
    setIsFocusList(false);
    setEnabledViews(allViews);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      title,
      description: description || undefined,
      client_id: clientId || undefined,
      priority,
      due_date: dueDate || undefined,
      is_important: isImportant,
      is_urgent: isUrgent,
      is_frog: isFrog,
      ivy_lee_order: ivyLeeOrder,
      is_focus_list: isFocusList,
      enabled_views: enabledViews,
    });
    onOpenChange(false);
    resetForm();
  };

  const toggleView = (view: TaskViewType) => {
    setEnabledViews(prev =>
      prev.includes(view) ? prev.filter(v => v !== view) : [...prev, view]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Descrição da tarefa"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes adicionais"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as PriorityLevel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Data de Vencimento</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* Eisenhower Matrix Options */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="eisenhower">
              <AccordionTrigger className="text-sm">
                🎯 Matriz de Eisenhower
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="important"
                      checked={isImportant}
                      onCheckedChange={(checked) => setIsImportant(checked as boolean)}
                    />
                    <Label htmlFor="important" className="cursor-pointer">
                      ⭐ Importante — contribui para objetivos de longo prazo
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="urgent"
                      checked={isUrgent}
                      onCheckedChange={(checked) => setIsUrgent(checked as boolean)}
                    />
                    <Label htmlFor="urgent" className="cursor-pointer">
                      ⚡ Urgente — precisa de atenção imediata
                    </Label>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="other-strategies">
              <AccordionTrigger className="text-sm">
                🐸 Outras Estratégias
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="frog"
                      checked={isFrog}
                      onCheckedChange={(checked) => setIsFrog(checked as boolean)}
                    />
                    <Label htmlFor="frog" className="cursor-pointer">
                      🐸 Sapo — tarefa mais difícil do dia
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="focusList"
                      checked={isFocusList}
                      onCheckedChange={(checked) => setIsFocusList(checked as boolean)}
                    />
                    <Label htmlFor="focusList" className="cursor-pointer">
                      📋 Lista de Foco — prioridade absoluta
                    </Label>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ivyLee">6️⃣ Ivy Lee (ordem 1-6)</Label>
                    <Select
                      value={ivyLeeOrder?.toString() || ''}
                      onValueChange={(v) => setIvyLeeOrder(v ? parseInt(v) : undefined)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Não definido" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Não definido</SelectItem>
                        {[1, 2, 3, 4, 5, 6].map(n => (
                          <SelectItem key={n} value={n.toString()}>
                            Prioridade {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="views">
              <AccordionTrigger className="text-sm">
                👁️ Visualizações
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Escolha em quais visualizações esta tarefa deve aparecer
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {allViews.map(view => (
                    <div key={view} className="flex items-center space-x-2">
                      <Checkbox
                        id={`view-${view}`}
                        checked={enabledViews.includes(view)}
                        onCheckedChange={() => toggleView(view)}
                      />
                      <Label htmlFor={`view-${view}`} className="cursor-pointer text-sm">
                        {taskViewLabels[view].icon} {taskViewLabels[view].label}
                      </Label>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : task ? 'Atualizar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
