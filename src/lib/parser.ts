import { Priority, TaskStatus } from './db';
import * as chrono from 'chrono-node';

interface ParsedTask {
  title: string;
  priority: Priority;
  dueDate?: Date;
  externalLink?: string;
  status?: TaskStatus;
  completedAt?: Date;
}

export function parseTaskInput(input: string): ParsedTask {
  let text = input;
  let priority: Priority = 'medium';
  let dueDate: Date | undefined;
  let externalLink: string | undefined;
  let status: TaskStatus = 'todo';
  let completedAt: Date | undefined;

  // 0. Check for /did command
  if (text.trim().startsWith('/did ')) {
    text = text.replace('/did ', '').trim();
    status = 'completed';
    completedAt = new Date();
  }

  // 1. Extract External Links (ClickUp, Figma, etc.)
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = text.match(urlRegex);
  
  if (urls && urls.length > 0) {
    // Take the first URL found
    externalLink = urls[0];
    // Remove URL from text
    text = text.replace(externalLink, '').trim();
  }

  // 2. Extract Priority with Shortcuts
  const lowerText = text.toLowerCase();

  if (/#(high|urgent|h)\b/i.test(lowerText)) {
    priority = 'high';
    text = text.replace(/#(high|urgent|h)\b/gi, '');
  } else if (/#(low|l)\b/i.test(lowerText)) {
    priority = 'low';
    text = text.replace(/#(low|l)\b/gi, '');
  } else if (/#(medium|m)\b/i.test(lowerText)) {
    priority = 'medium';
    text = text.replace(/#(medium|m)\b/gi, '');
  } else if (/#(info|i)\b/i.test(lowerText)) {
    priority = 'info';
    text = text.replace(/#(info|i)\b/gi, '');
  }

  // 3. Extract Date using Chrono (Natural Language Processing)
  const parsedDate = chrono.parse(text, new Date(), { forwardDate: true });
  
  if (parsedDate.length > 0) {
    const dateResult = parsedDate[0];
    dueDate = dateResult.start.date();
    
    // Remove the parsed date text from the original text
    const textToReplace = text.substring(dateResult.index, dateResult.index + dateResult.text.length);
    text = text.replace(textToReplace, '');
    
    // Cleanup specific prepositions that might be left behind
    text = text.replace(/\b(by|on|at|due)\s*$/i, ''); // End of string check
    text = text.replace(/\s+(by|on|at|due)\s+/i, ' '); // Middle of string check
  }

  // Clean up extra spaces
  const title = text.trim().replace(/\s+/g, ' ');

  return {
    title,
    priority,
    dueDate,
    externalLink,
    status,
    completedAt
  };
}
