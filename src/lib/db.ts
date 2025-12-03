import Dexie, { Table } from 'dexie';

export type Priority = 'low' | 'medium' | 'high' | 'info';
export type TaskStatus = 'todo' | 'completed' | 'someday';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id?: number;
  title: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: Date;
  externalLink?: string;
  createdAt: Date;
  completedAt?: Date;
  isFocus: boolean;
  notes?: string;
  isStale?: boolean;
  description?: string;
  images?: string[]; // base64 encoded images
  subTasks?: SubTask[];
}

export interface Link {
  id?: number;
  url: string;
  title: string;
  domain: string;
  sourceTaskId?: number;
  createdAt: Date;
}

export interface DailyChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface DailyState {
  id?: number;
  date: string; // YYYY-MM-DD format
  bigRock: string;
  checklist: DailyChecklistItem[];
}

export class MySubClassedDexie extends Dexie {
  tasks!: Table<Task>;
  links!: Table<Link>;
  dailyStates!: Table<DailyState>;

  constructor() {
    super('ViviDatabase');
    
    this.version(2).stores({
      tasks: '++id, title, status, priority, dueDate, externalLink, createdAt, completedAt, isFocus, isStale'
    }).upgrade(tx => {
      // Migration: add new fields with defaults
      return tx.table('tasks').toCollection().modify(task => {
        task.isStale = task.isStale ?? false;
        task.description = task.description ?? '';
        task.images = task.images ?? [];
        task.subTasks = task.subTasks ?? [];
      });
    });

    // Version 3: Add links and dailyStates tables
    this.version(3).stores({
      tasks: '++id, title, status, priority, dueDate, externalLink, createdAt, completedAt, isFocus, isStale',
      links: '++id, url, domain, sourceTaskId, createdAt',
      dailyStates: '++id, date'
    });
  }
}

export const db = new MySubClassedDexie();

// Helper to get or create today's daily state
export async function getTodayState(): Promise<DailyState> {
  const today = new Date().toISOString().split('T')[0];
  
  let state = await db.dailyStates.where('date').equals(today).first();
  
  if (!state) {
    const defaultChecklist: DailyChecklistItem[] = [
      { id: 'triage', label: 'Triage Inboxes (Slack/Email)', completed: false },
      { id: 'calendar', label: 'Review Calendar', completed: false }
    ];
    
    const newState: DailyState = {
      date: today,
      bigRock: '',
      checklist: defaultChecklist
    };
    
    const id = await db.dailyStates.add(newState);
    state = { ...newState, id };
  }
  
  return state;
}

// Helper to extract and save links from text
export async function extractAndSaveLinks(text: string, taskId?: number): Promise<void> {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = text.match(urlRegex);
  
  if (!urls || urls.length === 0) return;
  
  for (const url of urls) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      
      // Generate a title based on domain
      let title = domain;
      if (domain.includes('figma.com')) title = 'Figma File';
      else if (domain.includes('clickup.com')) title = 'ClickUp Task';
      else if (domain.includes('google.com')) title = 'Google Doc';
      else if (domain.includes('notion.so')) title = 'Notion Page';
      else if (domain.includes('github.com')) title = 'GitHub';
      else title = domain.charAt(0).toUpperCase() + domain.slice(1);
      
      // Check if link already exists
      const existing = await db.links.where('url').equals(url).first();
      
      if (!existing) {
        await db.links.add({
          url,
          title,
          domain,
          sourceTaskId: taskId,
          createdAt: new Date()
        });
      }
    } catch (e) {
      // Invalid URL, skip
      console.warn('Invalid URL:', url);
    }
  }
}
