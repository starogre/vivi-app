'use client';

import { Task } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { differenceInHours, isPast, format } from 'date-fns';
import { Link as LinkIcon, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskItemProps {
  task: Task;
  onClick: () => void;
  onToggleComplete: (checked: boolean) => void;
  onMoveToFocus: () => void;
  onRemoveFromFocus: () => void;
  hideCheckbox?: boolean;
  showStrikethrough?: boolean;
}

export function TaskItem({ 
  task, 
  onClick, 
  onToggleComplete, 
  onMoveToFocus, 
  onRemoveFromFocus,
  hideCheckbox = false,
  showStrikethrough = true
}: TaskItemProps) {
  // Urgency Logic
  const isOverdue = task.dueDate && isPast(task.dueDate) && task.status !== 'completed';
  const isDueSoon = task.dueDate && differenceInHours(task.dueDate, new Date()) < 24 && !isPast(task.dueDate) && task.status !== 'completed';

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500 hover:bg-red-600 text-white';
      case 'medium': return 'bg-yellow-500 hover:bg-yellow-600 text-white';
      case 'low': return 'bg-blue-500 hover:bg-blue-600 text-white';
      case 'info': return 'bg-gray-400 hover:bg-gray-500 text-white';
      default: return 'bg-secondary text-secondary-foreground hover:bg-secondary/80';
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleButtonClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  return (
    <div 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-2.5 rounded-lg border bg-card text-card-foreground shadow-sm cursor-pointer hover:bg-accent/50 transition-colors",
        isOverdue ? "border-red-500 border-2" : "",
        task.isStale ? "opacity-60" : "",
        task.status === 'completed' && !hideCheckbox && "opacity-50"
      )}
    >
      {!hideCheckbox && (
        <div onClick={handleCheckboxClick}>
          <Checkbox 
            checked={task.status === 'completed'} 
            onCheckedChange={onToggleComplete}
            disabled={task.status === 'completed'}
          />
        </div>
      )}

      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className={cn(
          "text-sm font-medium truncate",
          task.status === 'completed' && showStrikethrough && "line-through text-muted-foreground"
        )}>
          {task.title}
        </span>
        
        {task.isStale && <span className="text-base" title="Stale task">🕸️</span>}
        
        {task.externalLink && (
          <Badge variant="outline" className="gap-1 text-xs py-0 h-5">
            <LinkIcon className="h-2.5 w-2.5" />
            {task.externalLink.includes('clickup') ? 'ClickUp' : 
             task.externalLink.includes('figma') ? 'Figma' : 'Link'}
          </Badge>
        )}

        {task.dueDate && (
          <span className={cn(
            "text-xs text-muted-foreground whitespace-nowrap",
            isOverdue && "text-red-500 font-medium"
          )}>
            {format(task.dueDate, 'MMM d')}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isDueSoon && <Badge variant="outline" className="border-orange-500 text-orange-500 text-xs py-0 h-5">Due Soon</Badge>}
        {task.isFocus && <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs py-0 h-5">Focus</Badge>}
        <Badge className={cn("text-xs py-0 h-5", getPriorityBadgeColor(task.priority))}>
          {task.priority}
        </Badge>

        {!task.isFocus && task.status !== 'completed' && (
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={(e) => handleButtonClick(e, onMoveToFocus)}
            className="h-7 w-7 p-0"
            title="Move to Focus"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
        {task.isFocus && task.status !== 'completed' && (
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={(e) => handleButtonClick(e, onRemoveFromFocus)}
            className="h-7 w-7 p-0"
            title="Remove from Focus"
          >
            <ArrowRight className="h-3.5 w-3.5 rotate-180" />
          </Button>
        )}
      </div>
    </div>
  );
}
