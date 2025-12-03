import Dexie, { Table } from 'dexie';

export type Priority = 'low' | 'medium' | 'high' | 'info';
export type TaskStatus = 'todo' | 'completed' | 'someday';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskImage {
  id: string;
  data: string; // base64 encoded
  mimeType: string;
  createdAt: number;
}

export interface Task {
  id?: number;
  title: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: Date;
  externalLink?: string; // Deprecated - use externalLinks instead
  externalLinks?: string[]; // Array of URLs
  createdAt: Date;
  completedAt?: Date;
  isFocus: boolean;
  notes?: string;
  isStale?: boolean;
  description?: string;
  images?: TaskImage[];
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

    // Version 4: Update images to be TaskImage[] array
    this.version(4).stores({
      tasks: '++id, title, status, priority, dueDate, externalLink, createdAt, completedAt, isFocus, isStale',
      links: '++id, url, domain, sourceTaskId, createdAt',
      dailyStates: '++id, date'
    }).upgrade(tx => {
      // Migrate old string[] images to TaskImage[] format
      return tx.table('tasks').toCollection().modify(task => {
        if (task.images && Array.isArray(task.images)) {
          // Check if images are old format (string[]) or new format (TaskImage[])
          if (task.images.length > 0 && typeof task.images[0] === 'string') {
            // Convert old format to new format
            task.images = (task.images as string[]).map((data, index) => ({
              id: `img-${task.id}-${index}-${Date.now()}`,
              data,
              mimeType: 'image/png', // Default, will be detected if possible
              createdAt: Date.now()
            }));
          }
        } else {
          task.images = [];
        }
      });
    });

    // Version 5: Migrate externalLink to externalLinks array
    this.version(5).stores({
      tasks: '++id, title, status, priority, dueDate, externalLink, createdAt, completedAt, isFocus, isStale',
      links: '++id, url, domain, sourceTaskId, createdAt',
      dailyStates: '++id, date'
    }).upgrade(tx => {
      return tx.table('tasks').toCollection().modify(task => {
        // Migrate single externalLink to externalLinks array
        if (task.externalLink && typeof task.externalLink === 'string' && !task.externalLinks) {
          task.externalLinks = [task.externalLink];
        } else if (!task.externalLinks) {
          task.externalLinks = [];
        }
      });
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
  
  // Import fetchPageTitle dynamically to avoid circular dependencies
  const { fetchPageTitle, normalizeUrl } = await import('./linkUtils');
  
  for (const url of urls) {
    try {
      const normalizedUrl = normalizeUrl(url);
      const urlObj = new URL(normalizedUrl);
      const domain = urlObj.hostname.replace('www.', '');
      
      // Try to fetch actual page title
      let title = await fetchPageTitle(normalizedUrl);
      
      // Fallback to domain-based title if fetch fails
      if (!title) {
        const urlPath = urlObj.pathname.toLowerCase();
        if (domain.includes('figma.com')) title = 'Figma File';
        else if (domain.includes('clickup.com')) title = 'ClickUp Task';
        else if (domain.includes('docs.google.com') && urlPath.includes('/document/')) title = 'Google Doc';
        else if (domain.includes('docs.google.com') && urlPath.includes('/spreadsheets/')) title = 'Google Sheet';
        else if (domain.includes('sheets.google.com')) title = 'Google Sheet';
        else if (domain.includes('notion.so')) title = 'Notion Page';
        else if (domain.includes('github.com')) title = 'GitHub';
        else title = domain.charAt(0).toUpperCase() + domain.slice(1);
      }
      
      // Check if link already exists for this task
      const existing = await db.links
        .where('url').equals(normalizedUrl)
        .and(link => link.sourceTaskId === taskId)
        .first();
      
      if (!existing) {
        // Check if link exists with different task (update title if needed)
        const existingLink = await db.links.where('url').equals(normalizedUrl).first();
        if (existingLink) {
          // Update title if we got a better one
          if (title && title !== existingLink.title) {
            await db.links.update(existingLink.id!, { title });
          }
          // Add new link entry for this task
          await db.links.add({
            url: normalizedUrl,
            title: existingLink.title, // Use existing title
            domain,
            sourceTaskId: taskId,
            createdAt: new Date()
          });
        } else {
          await db.links.add({
            url: normalizedUrl,
            title: title || domain,
            domain,
            sourceTaskId: taskId,
            createdAt: new Date()
          });
        }
      } else if (title && title !== existing.title) {
        // Update existing link with better title
        await db.links.update(existing.id!, { title });
      }
    } catch (e) {
      // Invalid URL, skip
      console.warn('Invalid URL:', url, e);
    }
  }
}
