'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { parseTaskInput } from '@/lib/parser';
import { db, extractAndSaveLinks } from '@/lib/db';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

export function CommandLine() {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Hotkey: Press 'E' to focus the input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if 'E' is pressed and we're not already typing in an input/textarea
      if (e.key === 'e' || e.key === 'E') {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        
        // Don't trigger if user is typing in an input/textarea
        if (!isInput) {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const addTaskMutation = useMutation({
    mutationFn: async (text: string) => {
      const parsed = parseTaskInput(text);
      
      // Add task to database
      const taskId = await db.tasks.add({
        ...parsed,
        status: parsed.status || 'todo',
        completedAt: parsed.completedAt,
        createdAt: new Date(),
        isFocus: false,
      });
      
      // Extract and save any URLs found in the text
      await extractAndSaveLinks(text, taskId as number);
      
      return taskId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['links'] });
      queryClient.invalidateQueries({ queryKey: ['archive-tasks'] });
      setInput('');
      // Refocus input after submission for quick entry
      setTimeout(() => inputRef.current?.focus(), 100);
    },
  });

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    addTaskMutation.mutate(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle Enter key - works on both desktop and mobile keyboards
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
      <div className="relative flex items-center">
        <Input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Try '/did Finished the report' or 'Meeting by Friday #h'"
          className="h-12 sm:h-14 text-base sm:text-lg pr-12 sm:pr-14 shadow-lg border-2 focus-visible:ring-2 focus-visible:ring-primary"
          enterKeyHint="done"
        />
        <Button 
          type="submit"
          size="icon" 
          className="absolute right-1 sm:right-2 top-1 sm:top-2 h-9 w-9 sm:h-10 sm:w-10 rounded-full"
          disabled={!input.trim()}
        >
          <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
      </div>
    </form>
  );
}
