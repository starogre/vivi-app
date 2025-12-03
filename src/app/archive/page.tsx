'use client';

import { TaskItem } from '@/components/task-item';
import { TaskDetailSheet } from '@/components/task-detail-sheet';
import { db, Task } from '@/lib/db';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, ArrowLeft, RotateCcw, Calendar, Filter } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { startOfWeek, endOfWeek, format, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subWeeks, subMonths } from 'date-fns';
import { useState } from 'react';
import { cn } from '@/lib/utils';

type FilterType = 'all' | 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'this-year' | 'custom';

export default function ArchivePage() {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  const [completedFilter, setCompletedFilter] = useState<FilterType>('all');
  const [dueDateFilter, setDueDateFilter] = useState<FilterType>('all');
  const queryClient = useQueryClient();

  const { data: allCompletedTasks, isLoading } = useQuery({
    queryKey: ['archive-tasks'],
    queryFn: async () => {
      return await db.tasks
        .where('status')
        .equals('completed')
        .reverse()
        .sortBy('completedAt');
    },
  });

  // Filter tasks by completed date
  const filterByCompletedDate = (tasks: Task[], filter: FilterType): Task[] => {
    if (filter === 'all') return tasks;
    
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (filter) {
      case 'this-week':
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'last-week':
        startDate = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        endDate = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        break;
      case 'this-month':
        startDate = startOfMonth(now);
        break;
      case 'last-month':
        startDate = startOfMonth(subMonths(now, 1));
        endDate = endOfMonth(subMonths(now, 1));
        break;
      case 'this-year':
        startDate = startOfYear(now);
        break;
      default:
        return tasks;
    }

    return tasks.filter(task => {
      const completedDate = task.completedAt || task.createdAt;
      return completedDate >= startDate && completedDate <= endDate;
    });
  };

  // Filter tasks by due date
  const filterByDueDate = (tasks: Task[], filter: FilterType): Task[] => {
    if (filter === 'all' || !filter) return tasks;
    
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (filter) {
      case 'this-week':
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'last-week':
        startDate = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        endDate = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        break;
      case 'this-month':
        startDate = startOfMonth(now);
        break;
      case 'last-month':
        startDate = startOfMonth(subMonths(now, 1));
        endDate = endOfMonth(subMonths(now, 1));
        break;
      case 'this-year':
        startDate = startOfYear(now);
        break;
      default:
        return tasks;
    }

    return tasks.filter(task => {
      if (!task.dueDate) return false;
      return task.dueDate >= startDate && task.dueDate <= endDate;
    });
  };

  const completedTasks = allCompletedTasks || [];
  const filteredByCompleted = filterByCompletedDate(completedTasks, completedFilter);
  const filteredTasks = dueDateFilter === 'all' 
    ? filteredByCompleted 
    : filterByDueDate(filteredByCompleted, dueDateFilter);

  const bulkRestoreMutation = useMutation({
    mutationFn: async (taskIds: number[]) => {
      await Promise.all(taskIds.map(id => 
        db.tasks.update(id, { status: 'todo', completedAt: undefined })
      ));
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['archive-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedTaskIds(new Set());
      setBulkSelectMode(false);
    },
  });

  const restoreTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      await db.tasks.update(taskId, { status: 'todo', completedAt: undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archive-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const handleTaskClick = (task: Task) => {
    if (bulkSelectMode) {
      toggleTaskSelection(task.id!);
    } else {
      setSelectedTask(task);
      setSheetOpen(true);
    }
  };

  const toggleTaskSelection = (taskId: number) => {
    setSelectedTaskIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const allTaskIds = filteredTasks.map(t => t.id!).filter(id => id !== undefined);
    setSelectedTaskIds(new Set(allTaskIds));
  };

  const handleDeselectAll = () => {
    setSelectedTaskIds(new Set());
  };

  const handleRestore = (task: Task) => {
    if (task.id) {
      restoreTaskMutation.mutate(task.id);
    }
  };

  // Group tasks by week
  const groupedTasks = filteredTasks.reduce((groups, task) => {
    const dateToUse = task.completedAt || task.createdAt; 
    const weekStart = startOfWeek(dateToUse, { weekStartsOn: 1 });
    const key = weekStart.toISOString();
    
    if (!groups[key]) {
      groups[key] = {
        weekStart,
        tasks: []
      };
    }
    groups[key].tasks.push(task);
    return groups;
  }, {} as Record<string, { weekStart: Date, tasks: Task[] }>);

  const sortedGroups = Object.values(groupedTasks).sort((a, b) => 
    b.weekStart.getTime() - a.weekStart.getTime()
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background text-foreground p-6">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Archive</h1>
                <p className="text-sm text-muted-foreground">
                  {filteredTasks.length} of {completedTasks.length} completed tasks
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {bulkSelectMode ? (
                <>
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                    Deselect All
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={() => bulkRestoreMutation.mutate(Array.from(selectedTaskIds))}
                    disabled={selectedTaskIds.size === 0 || bulkRestoreMutation.isPending}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restore ({selectedTaskIds.size})
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setBulkSelectMode(false);
                    setSelectedTaskIds(new Set());
                  }}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setBulkSelectMode(true)}>
                  Bulk Restore
                </Button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 p-4 border rounded-lg bg-card">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Completed:</label>
              <Select value={completedFilter} onValueChange={(v) => setCompletedFilter(v as FilterType)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="last-week">Last Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Due Date:</label>
              <Select value={dueDateFilter} onValueChange={(v) => setDueDateFilter(v as FilterType)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="last-week">Last Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-8">
            {sortedGroups.length === 0 ? (
              <p className="text-muted-foreground italic text-center">
                No tasks found matching your filters.
              </p>
            ) : (
              sortedGroups.map((group) => {
                const start = group.weekStart;
                const end = endOfWeek(start, { weekStartsOn: 1 });
                const dateRange = `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;

                return (
                  <section key={group.weekStart.toISOString()} className="space-y-4">
                     <h3 className="text-lg font-semibold text-muted-foreground sticky top-0 bg-background py-2 z-10 border-b">
                       Week of {dateRange}
                     </h3>
                     <div className="space-y-1.5">
                       {group.tasks.map((task) => (
                         <div key={task.id} className="flex items-center gap-2">
                           {bulkSelectMode && (
                             <Checkbox 
                               checked={selectedTaskIds.has(task.id!)}
                               onCheckedChange={() => toggleTaskSelection(task.id!)}
                             />
                           )}
                           <div className={cn("flex-1", bulkSelectMode && "cursor-pointer")} onClick={() => handleTaskClick(task)}>
                             <TaskItem 
                               task={task} 
                               onClick={() => !bulkSelectMode && handleTaskClick(task)}
                               onToggleComplete={() => {}} // Disabled - checkbox is for selection only
                               onMoveToFocus={() => {}}
                               onRemoveFromFocus={() => {}}
                               hideCheckbox={true}
                               showStrikethrough={false}
                             />
                           </div>
                           {!bulkSelectMode && (
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => handleRestore(task)}
                               disabled={restoreTaskMutation.isPending}
                               className="gap-2"
                             >
                               <RotateCcw className="h-3.5 w-3.5" />
                               Restore
                             </Button>
                           )}
                         </div>
                       ))}
                     </div>
                  </section>
                );
              })
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
