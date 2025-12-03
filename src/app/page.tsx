'use client';

import { CommandLine } from '@/components/command-line';
import { SidebarAgent } from '@/components/sidebar-agent';
import { TaskItem } from '@/components/task-item';
import { TaskDetailSheet } from '@/components/task-detail-sheet';
import { DigitalJanitor } from '@/components/digital-janitor';
import { DailyStartupWidget } from '@/components/daily-startup-widget';
import { db, Task } from '@/lib/db';
import { checkTaskHealth } from '@/lib/taskHealth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Archive, CalendarDays, Sparkles, FileText } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function Home() {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [janitorOpen, setJanitorOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      await checkTaskHealth(); // Auto-check task health on load
      return db.tasks.toArray();
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: number; updates: Partial<Task> }) => {
      await db.tasks.update(taskId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const sortTasks = (tasks: Task[]) => {
    const priorityValue = { high: 3, medium: 2, low: 1, info: 0 };
    return [...tasks].sort((a, b) => {
      // 1. Priority
      if (priorityValue[a.priority] !== priorityValue[b.priority]) {
        return priorityValue[b.priority] - priorityValue[a.priority];
      }
      // 2. Due Date (Earliest first, null last)
      if (a.dueDate && b.dueDate) {
        return a.dueDate.getTime() - b.dueDate.getTime();
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
  };

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

  const allTasks = tasks || [];
  
  // Focus: Active tasks marked as focus
  const focusTasks = sortTasks(allTasks.filter(t => t.status === 'todo' && t.isFocus));
  
  // Inbox: Active tasks NOT marked as focus
  const inboxTasks = sortTasks(allTasks.filter(t => t.status === 'todo' && !t.isFocus));

  return (
    <>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar / Command Line */}
          <div className="border-b p-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
             <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold hidden md:flex items-center gap-2">
                  <img src="/BlackMage.gif" alt="Vivi" className="h-8 pixelated" />
                  Vivi
                </h1>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setSidebarOpen(!sidebarOpen)}>
                    <FileText className="h-4 w-4" />
                    Generate
                  </Button>
                  <Link href="/links">
                    <Button variant="outline" size="sm" className="gap-2">
                      <FileText className="h-4 w-4" />
                      Links
                    </Button>
                  </Link>
                  <Link href="/weekly-review">
                    <Button variant="outline" size="sm" className="gap-2">
                      <CalendarDays className="h-4 w-4" />
                      Weekly Review
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setJanitorOpen(true)}>
                    <Sparkles className="h-4 w-4" />
                    Janitor
                  </Button>
                  <Link href="/archive">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Archive className="h-4 w-4" />
                      Archive
                    </Button>
                  </Link>
                </div>
             </div>
             <CommandLine />
          </div>

          {/* Scrollable Task Area */}
          <div className="flex-1 overflow-y-auto p-6">
             <div className="max-w-3xl mx-auto space-y-8">
                
                {/* Daily Startup Widget */}
                <DailyStartupWidget />
                
                {/* Focus Section */}
                <section>
                   <h3 className="text-lg font-semibold mb-4">Focus ({focusTasks.length})</h3>
                   {focusTasks.length === 0 ? (
                     <p className="text-muted-foreground text-sm italic">Nothing in focus. Move items from Inbox!</p>
                   ) : (
                     <div className="space-y-1.5">
                       {focusTasks.map((task) => (
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
                </section>

                {/* Inbox Section */}
                <section>
                   <h3 className="text-lg font-semibold mb-4">Inbox ({inboxTasks.length})</h3>
                   {inboxTasks.length === 0 ? (
                     <p className="text-muted-foreground text-sm italic">Inbox is empty. Great job!</p>
                   ) : (
                     <div className="space-y-1.5">
                       {inboxTasks.map((task) => (
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
                </section>

             </div>
          </div>
        </div>

        {/* Right Sidebar (Glass Box Agent) - Conditionally Rendered */}
        {sidebarOpen && <SidebarAgent onClose={() => setSidebarOpen(false)} />}
      </div>

      {/* Task Detail Sheet */}
      <TaskDetailSheet 
        task={selectedTask} 
        open={sheetOpen} 
        onOpenChange={setSheetOpen}
      />

      {/* Digital Janitor Dialog */}
      <DigitalJanitor 
        open={janitorOpen} 
        onOpenChange={setJanitorOpen}
      />
    </>
  );
}
