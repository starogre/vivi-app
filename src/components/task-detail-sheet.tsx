'use client';

import { useState } from 'react';
import { Task, db } from '@/lib/db';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Trash2, ArrowRight, CheckCircle2, Circle, CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface TaskDetailSheetProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailSheet({ task, open, onOpenChange }: TaskDetailSheetProps) {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState(task?.description || '');

  const updateTaskMutation = useMutation({
    mutationFn: async (updates: Partial<Task>) => {
      if (task?.id) {
        await db.tasks.update(task.id, updates);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['archive-tasks'] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      if (task?.id) {
        await db.tasks.update(task.id, { status: 'completed', completedAt: new Date() });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['archive-tasks'] });
      onOpenChange(false);
    },
  });

  const toggleComplete = (checked: boolean) => {
    updateTaskMutation.mutate({ 
      status: checked ? 'completed' : 'todo',
      completedAt: checked ? new Date() : undefined
    });
    if (checked) {
      onOpenChange(false);
    }
  };

  const moveToFocus = () => {
    updateTaskMutation.mutate({ isFocus: true });
  };

  const removeFromFocus = () => {
    updateTaskMutation.mutate({ isFocus: false });
  };

  const saveDescription = () => {
    updateTaskMutation.mutate({ description });
  };

  const toggleSubTask = (subTaskId: string) => {
    if (!task?.subTasks) return;
    const updated = task.subTasks.map(st => 
      st.id === subTaskId ? { ...st, completed: !st.completed } : st
    );
    updateTaskMutation.mutate({ subTasks: updated });
  };

  if (!task) return null;

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-blue-500 text-white';
      case 'info': return 'bg-gray-400 text-white';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-6">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Checkbox 
              checked={task.status === 'completed'} 
              onCheckedChange={toggleComplete}
            />
            <span className={cn(task.status === 'completed' && "line-through")}>{task.title}</span>
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2 flex-wrap mt-2">
            <Badge className={cn("text-xs", getPriorityBadgeColor(task.priority))}>
              {task.priority}
            </Badge>
            {task.isFocus && <Badge className="bg-green-600 text-xs">Focus</Badge>}
            {task.dueDate && (
              <Badge variant="outline" className="text-xs">
                Due: {format(task.dueDate, 'MMM d, yyyy')}
              </Badge>
            )}
            {task.isStale && <Badge variant="outline" className="text-xs">🕸️ Stale</Badge>}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Focus Controls */}
          <div className="flex gap-2">
            {!task.isFocus && task.status !== 'completed' && (
              <Button size="sm" variant="outline" onClick={moveToFocus} className="gap-2">
                <ArrowRight className="h-4 w-4" />
                Move to Focus
              </Button>
            )}
            {task.isFocus && task.status !== 'completed' && (
              <Button size="sm" variant="outline" onClick={removeFromFocus} className="gap-2">
                <ArrowRight className="h-4 w-4 rotate-180" />
                Remove from Focus
              </Button>
            )}
          </div>

          <Separator />

          {/* Due Date */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Due Date</h3>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !task.dueDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {task.dueDate ? format(task.dueDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={task.dueDate || undefined}
                    onSelect={(date) => {
                      if (date) {
                        updateTaskMutation.mutate({ dueDate: date });
                        // Close the popover by triggering a click outside
                        document.body.click();
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {task.dueDate && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => updateTaskMutation.mutate({ dueDate: undefined })}
                  title="Clear due date"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* External Link */}
          {task.externalLink && (
            <div>
              <h3 className="font-semibold text-sm mb-2">External Link</h3>
              <a 
                href={task.externalLink} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-2 text-blue-600 hover:underline text-sm"
              >
                <ExternalLink className="h-4 w-4" />
                {task.externalLink.includes('clickup') ? 'Open in ClickUp' :
                 task.externalLink.includes('figma') ? 'Open in Figma' :
                 'Open Link'}
              </a>
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Description</h3>
            <Textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={saveDescription}
              placeholder="Add a description..."
              className="min-h-[100px]"
            />
          </div>

          {/* Sub-tasks */}
          {task.subTasks && task.subTasks.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-2">Sub-tasks</h3>
              <div className="space-y-2">
                {task.subTasks.map((subTask) => (
                  <div key={subTask.id} className="flex items-center gap-2">
                    <button onClick={() => toggleSubTask(subTask.id)}>
                      {subTask.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <span className={cn("text-sm", subTask.completed && "line-through text-muted-foreground")}>
                      {subTask.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {task.notes && (
            <div>
              <h3 className="font-semibold text-sm mb-2">Notes</h3>
              <p className="text-sm text-muted-foreground">{task.notes}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Created: {format(task.createdAt, 'MMM d, yyyy h:mm a')}</p>
            {task.completedAt && (
              <p>Completed: {format(task.completedAt, 'MMM d, yyyy h:mm a')}</p>
            )}
          </div>

          <Separator />

          {/* Delete Button */}
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={() => deleteTaskMutation.mutate()}
            className="w-full gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete Task
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

