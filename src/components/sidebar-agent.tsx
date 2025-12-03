'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { subDays } from 'date-fns';
import { Copy, Loader2, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface SidebarAgentProps {
  onClose: () => void;
}

export function SidebarAgent({ onClose }: SidebarAgentProps) {
  const [report, setReport] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const generateReport = async () => {
    setLoading(true);
    try {
      const sevenDaysAgo = subDays(new Date(), 7);
      
      // Fetch completed tasks in last 7 days
      const completedTasks = await db.tasks
        .filter(t => t.status === 'completed' && !!t.completedAt && t.completedAt >= sevenDaysAgo)
        .toArray();

      // Fetch current focus tasks
      const focusTasks = await db.tasks
        .filter(t => t.isFocus && t.status === 'todo')
        .toArray();

      let markdown = `# Weekly Update\n\n`;
      
      markdown += `## ✅ Completed (Last 7 Days)\n`;
      if (completedTasks.length === 0) markdown += `_No tasks completed._\n`;
      completedTasks.forEach(t => {
        markdown += `- ${t.title}\n`;
      });

      markdown += `\n## 🎯 Current Focus\n`;
      if (focusTasks.length === 0) markdown += `_No focus tasks._\n`;
      focusTasks.forEach(t => {
        markdown += `- ${t.title}\n`;
      });

      setReport(markdown);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(report);
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-80 border-l bg-muted/10 p-4 flex-col h-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Glass Box Agent</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <p className="text-sm text-muted-foreground mb-4">
          Your automated standup assistant.
        </p>
        
        <Button onClick={generateReport} disabled={loading} className="w-full mb-4">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Generate Weekly Update
        </Button>

        {report && (
          <div className="flex-1 flex flex-col min-h-0">
             <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Preview</span>
                <Button size="sm" variant="ghost" onClick={copyToClipboard}>
                  <Copy className="h-4 w-4" />
                </Button>
             </div>
             <ScrollArea className="flex-1 border rounded-md bg-background p-2 text-sm font-mono whitespace-pre-wrap">
               {report}
             </ScrollArea>
          </div>
        )}
      </div>

      {/* Mobile Sheet - Only render on mobile */}
      {isMobile && (
        <Sheet open={true} onOpenChange={(open) => !open && onClose()}>
          <SheetContent side="right" className="w-full sm:max-w-lg p-4">
            <SheetHeader>
              <SheetTitle>Glass Box Agent</SheetTitle>
            </SheetHeader>
            
            <div className="mt-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Your automated standup assistant.
              </p>
              
              <Button onClick={generateReport} disabled={loading} className="w-full">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Generate Weekly Update
              </Button>

              {report && (
                <div className="space-y-2">
                   <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Preview</span>
                      <Button size="sm" variant="ghost" onClick={copyToClipboard}>
                        <Copy className="h-4 w-4" />
                      </Button>
                   </div>
                   <ScrollArea className="h-[60vh] border rounded-md bg-background p-3 text-sm font-mono whitespace-pre-wrap">
                     {report}
                   </ScrollArea>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
