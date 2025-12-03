'use client';

import { Task } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { differenceInHours, isPast, format } from 'date-fns';
import { Link as LinkIcon, ArrowRight, Image as ImageIcon } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

interface TaskItemProps {
  task: Task;
  onClick: () => void;
  onToggleComplete: (checked: boolean) => void;
  onMoveToFocus: () => void;
  onRemoveFromFocus: () => void;
  hideCheckbox?: boolean;
  showStrikethrough?: boolean;
  onImageAdd?: (files: File[]) => void;
  onImageClick?: () => void;
  lightboxOpen?: boolean; // New prop to track if lightbox is open
}

export function TaskItem({ 
  task, 
  onClick, 
  onToggleComplete, 
  onMoveToFocus, 
  onRemoveFromFocus,
  hideCheckbox = false,
  showStrikethrough = true,
  onImageAdd,
  onImageClick,
  lightboxOpen = false
}: TaskItemProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [hoverCardOpen, setHoverCardOpen] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif']
    },
    noClick: true, // Don't open file dialog on click
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0 && onImageAdd) {
        onImageAdd(acceptedFiles);
      }
      setIsDragOver(false);
    },
    onDragEnter: () => setIsDragOver(true),
    onDragLeave: () => setIsDragOver(false),
  });

  // Urgency Logic
  const isOverdue = task.dueDate && isPast(task.dueDate) && task.status !== 'completed';
  const isDueSoon = task.dueDate && differenceInHours(task.dueDate, new Date()) < 24 && !isPast(task.dueDate) && task.status !== 'completed';

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500 hover:bg-red-600 text-white';
      case 'medium': return 'bg-yellow-500 hover:bg-yellow-600 text-white';
      case 'low': return 'bg-blue-500 hover:bg-blue-600 text-white';
      case 'info': return 'bg-gray-400 hover:bg-gray-500 text-white';
      default: return 'bg-secondary text-secondary-foreground hover:bg-secondary/80';
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleButtonClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  const handleImageIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHoverCardOpen(false); // Close hover card when opening lightbox
    if (onImageClick) {
      onImageClick();
    }
  };

  // Close hover card when lightbox opens
  useEffect(() => {
    if (lightboxOpen) {
      setHoverCardOpen(false);
    }
  }, [lightboxOpen]);

  const hasImages = task.images && task.images.length > 0;

  return (
    <div 
      {...getRootProps()}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-2.5 rounded-lg border bg-card text-card-foreground shadow-sm cursor-pointer hover:bg-accent/50 transition-colors",
        isOverdue ? "border-red-500 border-2" : "",
        task.isStale ? "opacity-60" : "",
        task.status === 'completed' && !hideCheckbox && "opacity-50",
        (isDragActive || isDragOver) && "border-blue-500 border-2 bg-blue-50/50"
      )}
    >
      <input {...getInputProps()} />
      
      {!hideCheckbox && (
        <div onClick={handleCheckboxClick}>
          <Checkbox 
            checked={task.status === 'completed'} 
            onCheckedChange={onToggleComplete}
            disabled={task.status === 'completed'}
          />
        </div>
      )}

      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className={cn(
          "text-sm font-medium truncate",
          task.status === 'completed' && showStrikethrough && "line-through text-muted-foreground"
        )}>
          {task.title}
        </span>
        
        {task.isStale && <span className="text-base" title="Stale task">🕸️</span>}
        
        {task.externalLink && (
          <Badge variant="outline" className="gap-1 text-xs py-0 h-5">
            <LinkIcon className="h-2.5 w-2.5" />
            {task.externalLink.includes('clickup') ? 'ClickUp' : 
             task.externalLink.includes('figma') ? 'Figma' : 'Link'}
          </Badge>
        )}

        {task.dueDate && (
          <span className={cn(
            "text-xs text-muted-foreground whitespace-nowrap",
            isOverdue && "text-red-500 font-medium"
          )}>
            {format(task.dueDate, 'MMM d')}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isDueSoon && <Badge variant="outline" className="border-orange-500 text-orange-500 text-xs py-0 h-5">Due Soon</Badge>}
        {task.isFocus && <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs py-0 h-5">Focus</Badge>}
        <Badge className={cn("text-xs py-0 h-5", getPriorityBadgeColor(task.priority))}>
          {task.priority}
        </Badge>

        {/* Image Icon with Hover Preview */}
        {hasImages && (
          <HoverCard 
            open={hoverCardOpen && !lightboxOpen} 
            onOpenChange={setHoverCardOpen} 
            openDelay={0}
            closeDelay={0}
          >
            <HoverCardTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleImageIconClick}
                className="h-7 w-7 p-0"
                title={`${task.images!.length} image${task.images!.length > 1 ? 's' : ''}`}
              >
                <ImageIcon className="h-3.5 w-3.5 text-blue-600" />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent 
              className="w-64 p-2 pointer-events-none" 
              sideOffset={12}
              onClick={(e) => e.stopPropagation()}
              onPointerEnter={() => setHoverCardOpen(false)}
              onPointerLeave={() => setHoverCardOpen(false)}
            >
              <div className="relative">
                <img
                  src={`data:${task.images![0].mimeType};base64,${task.images![0].data}`}
                  alt="Task preview"
                  className="w-full h-auto rounded"
                />
                {task.images!.length > 1 && (
                  <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    +{task.images!.length - 1} more
                  </div>
                )}
              </div>
            </HoverCardContent>
          </HoverCard>
        )}

        {!task.isFocus && task.status !== 'completed' && (
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={(e) => handleButtonClick(e, onMoveToFocus)}
            className="h-7 w-7 p-0"
            title="Move to Focus"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
        {task.isFocus && task.status !== 'completed' && (
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={(e) => handleButtonClick(e, onRemoveFromFocus)}
            className="h-7 w-7 p-0"
            title="Remove from Focus"
          >
            <ArrowRight className="h-3.5 w-3.5 rotate-180" />
          </Button>
        )}
      </div>
    </div>
  );
}
