'use client';

import { db, Link, extractAndSaveLinks } from '@/lib/db';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ArrowLeft, ExternalLink, Search } from 'lucide-react';
import LinkComponent from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';

export default function LinkLibraryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  // All hooks must be called unconditionally
  const { data: links, isLoading, refetch } = useQuery({
    queryKey: ['links'],
    queryFn: async () => {
      return await db.links.orderBy('createdAt').reverse().toArray();
    },
  });

  const { data: activeTasks } = useQuery({
    queryKey: ['active-task-ids'],
    queryFn: async () => {
      return await db.tasks.where('status').anyOf(['todo', 'someday']).toArray();
    },
  });

  const { data: archivedTasks } = useQuery({
    queryKey: ['archived-task-ids'],
    queryFn: async () => {
      return await db.tasks.where('status').equals('completed').toArray();
    },
  });

  // Scan existing tasks for links on mount - only once
  useEffect(() => {
    if (!hasScanned) {
      scanExistingTasks();
    }
  }, [hasScanned]);

  const scanExistingTasks = async () => {
    setIsScanning(true);
    try {
      const tasks = await db.tasks.toArray();
      
      for (const task of tasks) {
        const textToScan = [
          task.title,
          task.notes,
          task.description,
          task.externalLink
        ].filter(Boolean).join(' ');
        
        if (textToScan) {
          await extractAndSaveLinks(textToScan, task.id);
        }
      }
      
      setHasScanned(true);
      refetch();
    } finally {
      setIsScanning(false);
    }
  };

  if (isLoading || isScanning) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allLinks = links || [];
  const activeTaskIds = new Set(activeTasks?.map(t => t.id).filter(Boolean) || []);
  const archivedTaskIds = new Set(archivedTasks?.map(t => t.id).filter(Boolean) || []);

  // Split links into active and archived
  const activeLinks = allLinks.filter(link => 
    !link.sourceTaskId || activeTaskIds.has(link.sourceTaskId)
  );
  
  const archivedLinks = allLinks.filter(link => 
    link.sourceTaskId && archivedTaskIds.has(link.sourceTaskId)
  );
  
  // Filter by search query
  const filterLinks = (linksList: Link[]) => {
    return searchQuery
      ? linksList.filter(link =>
          link.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
          link.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          link.domain.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : linksList;
  };

  const filteredActiveLinks = filterLinks(activeLinks);
  const filteredArchivedLinks = filterLinks(archivedLinks);

  // Group links by domain
  const groupLinksByDomain = (linksList: Link[]) => {
    return linksList.reduce((groups, link) => {
      const domain = link.domain;
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(link);
      return groups;
    }, {} as Record<string, Link[]>);
  };

  const activeGrouped = groupLinksByDomain(filteredActiveLinks);
  const archivedGrouped = groupLinksByDomain(filteredArchivedLinks);

  const activeDomains = Object.keys(activeGrouped).sort();
  const archivedDomains = Object.keys(archivedGrouped).sort();

  const renderLinkSection = (groupedLinks: Record<string, Link[]>, domains: string[], emptyMessage: string) => {
    if (domains.length === 0) {
      return (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground text-sm">
            {emptyMessage}
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {domains.map((domain) => (
          <Card key={domain}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base capitalize">{domain}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {groupedLinks[domain].map((link) => (
                  <div
                    key={link.id}
                    className="flex items-start justify-between p-2.5 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium hover:underline flex items-center gap-2 text-blue-600"
                      >
                        {link.title}
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                      <p className="text-xs text-muted-foreground truncate mt-1">{link.url}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(link.createdAt, 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <LinkComponent href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </LinkComponent>
            <div>
              <h1 className="text-2xl font-bold">Link Library</h1>
              <p className="text-sm text-muted-foreground">All links extracted from your tasks</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search links by URL, title, or domain..."
            className="pl-9"
          />
        </div>

        {/* Active Tasks Links */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Active Tasks</h2>
          {renderLinkSection(activeGrouped, activeDomains, 'No links in active tasks.')}
        </div>

        {/* Archived Tasks Links */}
        {archivedDomains.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3 text-muted-foreground">Archived Tasks</h2>
            {renderLinkSection(archivedGrouped, archivedDomains, 'No links in archived tasks.')}
          </div>
        )}
      </div>
    </div>
  );
}
