'use client';

import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { db, getTodayState, DailyState, extractAndSaveLinks } from '@/lib/db';
import { Sparkles } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as chrono from 'chrono-node';
import { addDays } from 'date-fns';

export function DailyStartupWidget() {
  const [dailyState, setDailyState] = useState<DailyState | null>(null);
  const [bigRockInput, setBigRockInput] = useState('');
  const [isEditingBigRock, setIsEditingBigRock] = useState(false);
  const [meetingsInput, setMeetingsInput] = useState('');
  const [isEditingMeetings, setIsEditingMeetings] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    loadDailyState();
  }, []);

  const loadDailyState = async () => {
    const state = await getTodayState();
    setDailyState(state);
    setBigRockInput(state.bigRock);
  };

  const createPrepTasksMutation = useMutation({
    mutationFn: async (meetingsText: string) => {
      const lines = meetingsText.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        // Use chrono to parse the date/time from the line
        const parsedDate = chrono.parse(line, new Date(), { forwardDate: true });
        let dueDate: Date | undefined;
        let meetingName = line;
        
        if (parsedDate.length > 0) {
          const dateResult = parsedDate[0];
          dueDate = dateResult.start.date();
          
          // Remove the date/time text from the meeting name
          const textToReplace = line.substring(dateResult.index, dateResult.index + dateResult.text.length);
          meetingName = line.replace(textToReplace, '').trim();
        }
        
        if (meetingName) {
          const taskTitle = `Prep for ${meetingName}`;
          
          // Add task with due date
          const taskId = await db.tasks.add({
            title: taskTitle,
            status: 'todo',
            priority: 'medium',
            createdAt: new Date(),
            dueDate: dueDate,
            isFocus: false,
          });
          
          // Extract any URLs from the line
          await extractAndSaveLinks(line, taskId as number);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setMeetingsInput('');
      setIsEditingMeetings(false);
    },
  });

  const toggleChecklistItem = async (itemId: string) => {
    if (!dailyState || !dailyState.id) return;

    const updatedChecklist = dailyState.checklist.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );

    await db.dailyStates.update(dailyState.id, { checklist: updatedChecklist });
    setDailyState({ ...dailyState, checklist: updatedChecklist });
  };

  const saveBigRock = async () => {
    if (!dailyState || !dailyState.id) return;

    await db.dailyStates.update(dailyState.id, { bigRock: bigRockInput });
    setDailyState({ ...dailyState, bigRock: bigRockInput });
    setIsEditingBigRock(false);
  };

  const handleCreatePrepTasks = () => {
    if (meetingsInput.trim()) {
      createPrepTasksMutation.mutate(meetingsInput);
    }
  };

  if (!dailyState) return null;

  const allChecked = dailyState.checklist.every(item => item.completed);

  return (
    <div className="space-y-2">
      {/* Big Rock Display - Only show when set */}
      {dailyState.bigRock && !isEditingBigRock && (
        <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-primary/30 bg-primary/5">
          <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-primary/80 uppercase tracking-wide mb-0.5">Big Rock</div>
            <div className="text-base font-bold truncate">{dailyState.bigRock}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsEditingBigRock(true)} className="text-xs h-7 px-2">
            Edit
          </Button>
        </div>
      )}

      {/* Big Rock Input - Only show when editing or empty */}
      {(!dailyState.bigRock || isEditingBigRock) && (
        <div className="flex gap-2">
          <Input
            value={bigRockInput}
            onChange={(e) => setBigRockInput(e.target.value)}
            placeholder="Big Rock: What matters today?"
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveBigRock();
              if (e.key === 'Escape') setIsEditingBigRock(false);
            }}
            className="text-sm h-9"
            autoFocus
          />
          <Button onClick={saveBigRock} size="sm" className="h-9">Save</Button>
          {isEditingBigRock && (
            <Button onClick={() => setIsEditingBigRock(false)} size="sm" variant="ghost" className="h-9">×</Button>
          )}
        </div>
      )}

      {/* Compact Checklist - Collapsible when all done */}
      {!allChecked && (
        <div className="flex flex-col gap-1.5 p-2 rounded-lg border bg-card">
          {dailyState.checklist.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <Checkbox
                checked={item.completed}
                onCheckedChange={() => toggleChecklistItem(item.id)}
                className="h-3.5 w-3.5"
              />
              <label className="text-xs cursor-pointer flex-1" onClick={() => toggleChecklistItem(item.id)}>
                {item.label}
              </label>
            </div>
          ))}
          
          {isEditingMeetings ? (
            <div className="space-y-1.5 pt-1.5 mt-1.5 border-t">
              <Textarea
                value={meetingsInput}
                onChange={(e) => setMeetingsInput(e.target.value)}
                placeholder="9am Standup&#10;2pm Client call&#10;tomorrow 10am Planning"
                className="text-xs min-h-[60px] py-1.5"
              />
              <div className="flex gap-1.5">
                <Button onClick={handleCreatePrepTasks} size="sm" className="h-7 text-xs" disabled={createPrepTasksMutation.isPending}>
                  Create Prep Tasks
                </Button>
                <Button onClick={() => setIsEditingMeetings(false)} size="sm" variant="ghost" className="h-7 text-xs">×</Button>
              </div>
            </div>
          ) : (
            <button onClick={() => setIsEditingMeetings(true)} className="text-[10px] text-muted-foreground hover:text-foreground text-left py-1">
              + Add meetings
            </button>
          )}
        </div>
      )}
    </div>
  );
}
