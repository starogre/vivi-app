'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Task } from '@/lib/db';
import { getStaleTasks, moveTaskToSomeday, checkTaskHealth } from '@/lib/taskHealth';
import { db } from '@/lib/db';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2, Archive } from 'lucide-react';
import { format } from 'date-fns';

interface DigitalJanitorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DigitalJanitor({ open, onOpenChange }: DigitalJanitorProps) {
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(false);

  const { data: staleTasks, isLoading, refetch } = useQuery({
    queryKey: ['stale-tasks'],
    queryFn: async () => {
      await checkTaskHealth();
      return await getStaleTasks();
    },
    enabled: open,
  });

  const moveMutation = useMutation({
    mutationFn: async (taskId: number) => {
      await moveTaskToSomeday(taskId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['stale-tasks'] });
      refetch();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (taskId: number) => {
      await db.tasks.update(taskId, { status: 'completed', completedAt: new Date() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['stale-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['archive-tasks'] });
      refetch();
    },
  });

  const handleBulkDelete = async () => {
    if (!staleTasks || staleTasks.length === 0) return;
    setProcessing(true);
    const now = new Date();
    for (const task of staleTasks) {
      if (task.id) {
        await db.tasks.update(task.id, { status: 'completed', completedAt: now });
      }
    }
    setProcessing(false);
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['archive-tasks'] });
    refetch();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🧹 Digital Janitor</DialogTitle>
          <DialogDescription>
            Tasks that haven't been touched in over 14 days. Time to clean up?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : staleTasks && staleTasks.length > 0 ? (
            <>
              <div className="flex justify-end gap-2 mb-4">
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={processing}
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  Delete All
                </Button>
              </div>

              {staleTasks.map((task) => (
                <div key={task.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium">{task.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        Created: {format(task.createdAt, 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => task.id && moveMutation.mutate(task.id)}
                      disabled={moveMutation.isPending}
                      className="gap-2"
                    >
                      <Archive className="h-4 w-4" />
                      Move to Someday
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => task.id && deleteMutation.mutate(task.id)}
                      disabled={deleteMutation.isPending}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>✨ All clean! No stale tasks found.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

