import { useState } from 'react';
import { AccountCategory, ACCOUNT_GROUPS, AccountGroupNumber } from '@/types/crm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Edit2, 
  Trash2,
  Wallet,
  Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccountCategoryTreeProps {
  categories: AccountCategory[];
  onAdd?: (parentId?: string, groupNumber?: AccountGroupNumber) => void;
  onEdit?: (category: AccountCategory) => void;
  onDelete?: (id: string) => void;
}

const groupColors: Record<number, string> = {
  1: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  2: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  3: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
  4: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
  5: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
  6: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  7: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-100',
  8: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100',
};

function AccountCategoryNode({ 
  category, 
  level = 0,
  onAdd,
  onEdit,
  onDelete
}: { 
  category: AccountCategory; 
  level?: number;
  onAdd?: (parentId?: string, groupNumber?: AccountGroupNumber) => void;
  onEdit?: (category: AccountCategory) => void;
  onDelete?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = category.subcategories && category.subcategories.length > 0;
  const isRoot = !category.parent_id;

  return (
    <div className="select-none">
      <div 
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group",
          level === 0 && "font-semibold"
        )}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        <button 
          onClick={() => setExpanded(!expanded)}
          className={cn("w-4 h-4", !hasChildren && "invisible")}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        
        <span className="text-muted-foreground text-xs font-mono">{category.id}</span>
        
        <span className="flex-1">{category.name}</span>
        
        {isRoot && (
          <Badge variant="outline" className={cn("text-xs", groupColors[category.group_number])}>
            {ACCOUNT_GROUPS[category.group_number]}
          </Badge>
        )}
        
        {category.financial_account && (
          <Badge variant="secondary" className="text-xs gap-1">
            {category.financial_account.type === 'bank' ? (
              <Building2 className="h-3 w-3" />
            ) : (
              <Wallet className="h-3 w-3" />
            )}
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
              category.financial_account.current_balance
            )}
          </Badge>
        )}
        
        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onAdd?.(category.id, category.group_number)}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onEdit?.(category)}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          {!hasChildren && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive"
              onClick={() => onDelete?.(category.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      
      {expanded && hasChildren && (
        <div>
          {category.subcategories?.map(sub => (
            <AccountCategoryNode
              key={sub.id}
              category={sub}
              level={level + 1}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AccountCategoryTree({ categories, onAdd, onEdit, onDelete }: AccountCategoryTreeProps) {
  return (
    <div className="space-y-1">
      {categories.map(category => (
        <AccountCategoryNode
          key={category.id}
          category={category}
          onAdd={onAdd}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
