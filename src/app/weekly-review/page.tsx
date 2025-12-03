'use client';

import { Task, db } from '@/lib/db';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TaskItem } from '@/components/task-item';
import { TaskDetailSheet } from '@/components/task-detail-sheet';
import { startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { useState } from 'react';

export default function WeeklyReviewPage() {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['weekly-review-tasks'],
    queryFn: async () => {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      const allTasks = await db.tasks.where('status').equals('todo').toArray();
      
      return allTasks.filter(task => {
        // Include if high priority
        if (task.priority === 'high') return true;
        
        // Include if due this week
        if (task.dueDate && isWithinInterval(task.dueDate, { start: weekStart, end: weekEnd })) {
          return true;
        }
        
        return false;
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: number; updates: Partial<Task> }) => {
      await db.tasks.update(taskId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-review-tasks'] });
    },
  });

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setSheetOpen(true);
  };

  const handleToggleComplete = (task: Task, checked: boolean) => {
    if (task.id) {
      updateTaskMutation.mutate({
        taskId: task.id,
        updates: { 
          status: checked ? 'completed' : 'todo',
          completedAt: checked ? new Date() : undefined
        }
      });
    }
  };

  const handleMoveToFocus = (task: Task) => {
    if (task.id) {
      updateTaskMutation.mutate({
        taskId: task.id,
        updates: { isFocus: true }
      });
    }
  };

  const handleRemoveFromFocus = (task: Task) => {
    if (task.id) {
      updateTaskMutation.mutate({
        taskId: task.id,
        updates: { isFocus: false }
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const weeklyTasks = tasks || [];
  const sortedTasks = [...weeklyTasks].sort((a, b) => {
    // Sort by due date (earliest first), then by priority
    if (a.dueDate && b.dueDate) {
      return a.dueDate.getTime() - b.dueDate.getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    
    const priorityValue = { high: 3, medium: 2, low: 1, info: 0 };
    return priorityValue[b.priority] - priorityValue[a.priority];
  });

  return (
    <>
      <div className="min-h-screen bg-background text-foreground p-6">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="flex items-center gap-4 mb-8">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Weekly Review</h1>
              <p className="text-sm text-muted-foreground">Strategy view: High priority + Due this week</p>
            </div>
          </div>

          <div className="space-y-4">
            {sortedTasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>✨ Nothing urgent this week!</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {sortedTasks.map((task) => (
                  <TaskItem 
                    key={task.id} 
                    task={task} 
                    onClick={() => handleTaskClick(task)}
                    onToggleComplete={(checked) => handleToggleComplete(task, checked)}
                    onMoveToFocus={() => handleMoveToFocus(task)}
                    onRemoveFromFocus={() => handleRemoveFromFocus(task)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <TaskDetailSheet 
        task={selectedTask} 
        open={sheetOpen} 
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
