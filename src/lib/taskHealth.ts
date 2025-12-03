import { db, Task } from './db';
import { differenceInDays } from 'date-fns';

export async function checkTaskHealth() {
  const allTasks = await db.tasks.where('status').equals('todo').toArray();
  const now = new Date();
  
  for (const task of allTasks) {
    const daysSinceCreation = differenceInDays(now, task.createdAt);
    const isStale = daysSinceCreation > 14;
    
    // Update task if stale status changed
    if (task.isStale !== isStale && task.id) {
      await db.tasks.update(task.id, { isStale });
    }
  }
}

export async function getStaleTasks(): Promise<Task[]> {
  return await db.tasks
    .filter(t => t.status === 'todo' && t.isStale === true)
    .toArray();
}

export async function moveTaskToSomeday(taskId: number) {
  await db.tasks.update(taskId, { status: 'someday', isFocus: false });
}

