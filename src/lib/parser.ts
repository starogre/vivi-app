import { Priority, TaskStatus } from './db';
import { normalizeUrl } from './linkUtils';
import * as chrono from 'chrono-node';

interface ParsedTask {
  title: string;
  priority: Priority;
  dueDate?: Date;
  externalLink?: string; // Deprecated - for backward compatibility
  externalLinks?: string[]; // Array of URLs
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
  // Match URLs with or without protocol - be more specific to avoid false positives
  const urlPatterns = [
    /https?:\/\/[^\s]+/g,  // URLs with protocol
    /www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*/g,  // www.domain.com
    /[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\/[^\s]*/g,  // domain.com/path
  ];
  
  let allMatches: string[] = [];
  urlPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      allMatches.push(...matches);
    }
  });
  
  let externalLinks: string[] | undefined;
  
  if (allMatches.length > 0) {
    // Normalize and filter valid URLs
    externalLinks = allMatches
      .map(url => {
        try {
          const normalized = normalizeUrl(url);
          // Validate it's a real URL
          new URL(normalized);
          return normalized;
        } catch {
          return null;
        }
      })
      .filter((url): url is string => url !== null);
    
    if (externalLinks.length > 0) {
      // For backward compatibility, keep first URL in externalLink
      externalLink = externalLinks[0];
      // Remove all matched URLs from text
      allMatches.forEach(url => {
        text = text.replace(url, '').trim();
      });
    }
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
    externalLink, // Keep for backward compatibility
    externalLinks, // Array of all URLs found
    status,
    completedAt
  };
}
