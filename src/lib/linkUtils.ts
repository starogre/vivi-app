// Utility to fetch page title from URL
export async function fetchPageTitle(url: string): Promise<string | null> {
  try {
    // Normalize URL
    const normalizedUrl = normalizeUrl(url);
    
    // Try to fetch using a CORS proxy
    // Using a public CORS proxy service
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(normalizedUrl)}`;
      const proxyResponse = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!proxyResponse.ok) {
        throw new Error('Proxy request failed');
      }
      
      const data = await proxyResponse.json();
      
      if (data.contents) {
        // Parse HTML to extract title
        const titleMatch = data.contents.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          const title = titleMatch[1].trim();
          // Clean up common title suffixes
          return title
            .replace(/\s*-\s*Google\s+Docs$/i, '')
            .replace(/\s*-\s*Google\s+Sheets$/i, '')
            .replace(/\s*-\s*Figma$/i, '')
            .replace(/\s*-\s*ClickUp$/i, '')
            .trim();
        }
      }
    } catch (proxyError) {
      // If proxy fails, try to extract title from URL for known services
      console.warn('Failed to fetch via proxy:', proxyError);
    }
    
    // Fallback: Try to extract meaningful title from URL for known services
    return extractTitleFromUrl(normalizedUrl);
  } catch (error) {
    console.warn('Failed to fetch page title:', error);
    return null;
  }
}

// Extract title from URL for known services
function extractTitleFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    
    // Google Docs - try to extract document name from URL
    if (url.includes('docs.google.com/document/')) {
      const docIdMatch = path.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
      if (docIdMatch) {
        return `Google Doc (${docIdMatch[1].substring(0, 8)}...)`;
      }
    }
    
    // Google Sheets
    if (url.includes('docs.google.com/spreadsheets/') || url.includes('sheets.google.com')) {
      const sheetIdMatch = path.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (sheetIdMatch) {
        return `Google Sheet (${sheetIdMatch[1].substring(0, 8)}...)`;
      }
    }
    
    // Figma files
    if (url.includes('figma.com/file/')) {
      const fileMatch = path.match(/\/file\/([a-zA-Z0-9]+)\/([^\/]+)/);
      if (fileMatch && fileMatch[2]) {
        return decodeURIComponent(fileMatch[2].replace(/-/g, ' '));
      }
    }
    
    // ClickUp tasks
    if (url.includes('clickup.com/t/')) {
      const taskMatch = path.match(/\/t\/([a-zA-Z0-9-]+)/);
      if (taskMatch) {
        return `ClickUp Task ${taskMatch[1]}`;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

// Normalize URL - add https:// if missing
export function normalizeUrl(url: string): string {
  let normalized = url.trim();
  
  // Add protocol if missing
  if (!normalized.match(/^https?:\/\//i)) {
    normalized = 'https://' + normalized;
  }
  
  return normalized;
}

// Shorten URL for display
export function shortenUrl(url: string, maxLength: number = 50): string {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname + urlObj.search;
    const domain = urlObj.hostname.replace('www.', '');
    
    if (url.length <= maxLength) return url;
    
    if (path.length > maxLength - domain.length - 5) {
      return `${domain}${path.substring(0, maxLength - domain.length - 8)}...`;
    }
    
    return `${domain}${path}`;
  } catch {
    // If URL parsing fails, just truncate
    return url.length > maxLength ? url.substring(0, maxLength - 3) + '...' : url;
  }
}

// Get link type label (for Google Docs/Sheets)
export function getLinkTypeLabel(url: string): string {
  const urlPath = url.toLowerCase();
  if (urlPath.includes('docs.google.com/document/') || urlPath.includes('docs.google.com/document')) {
    return 'Google Doc';
  }
  if (urlPath.includes('docs.google.com/spreadsheets/') || urlPath.includes('docs.google.com/spreadsheets') || urlPath.includes('sheets.google.com')) {
    return 'Google Sheet';
  }
  if (urlPath.includes('figma.com')) return 'Figma';
  if (urlPath.includes('clickup.com')) return 'ClickUp';
  if (urlPath.includes('notion.so')) return 'Notion';
  if (urlPath.includes('github.com')) return 'GitHub';
  return 'Link';
}

