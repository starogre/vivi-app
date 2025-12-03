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
    },
  });

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    addTaskMutation.mutate(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4">
      <div className="relative flex items-center">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Try '/did Finished the report' or 'Meeting by Friday #h' (Press 'E' to focus)"
          className="h-14 text-lg pr-12 shadow-lg border-2 focus-visible:ring-2 focus-visible:ring-primary"
        />
        <Button 
          onClick={() => handleSubmit()} 
          size="icon" 
          className="absolute right-2 top-2 h-10 w-10 rounded-full"
          disabled={!input.trim()}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
