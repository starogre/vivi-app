'use client';

import { useState, useEffect, useRef } from 'react';
import { Task, TaskImage, db } from '@/lib/db';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ImageLightbox } from '@/components/image-lightbox';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Trash2, ArrowRight, CheckCircle2, Circle, CalendarIcon, X, Image as ImageIcon, Upload, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useDropzone } from 'react-dropzone';
import { compressImage, getImageDataUrl } from '@/lib/imageUtils';
import { toast } from 'sonner';

interface TaskDetailSheetProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailSheet({ task, open, onOpenChange }: TaskDetailSheetProps) {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState(task?.description || '');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [localImages, setLocalImages] = useState<TaskImage[]>(task?.images || []);
  const [deletedImage, setDeletedImage] = useState<{ image: TaskImage; index: number } | null>(null);

  useEffect(() => {
    if (task) {
      setDescription(task.description || '');
      setLocalImages(task.images || []);
    }
  }, [task]);

  const updateTaskMutation = useMutation({
    mutationFn: async (updates: Partial<Task>) => {
      if (task?.id) {
        await db.tasks.update(task.id, updates);
        // Update local state immediately for real-time UI
        if (updates.images !== undefined) {
          setLocalImages(updates.images);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['archive-tasks'] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      if (task?.id) {
        await db.tasks.update(task.id, { status: 'completed', completedAt: new Date() });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['archive-tasks'] });
      onOpenChange(false);
    },
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif']
    },
    onDrop: async (acceptedFiles) => {
      if (!task?.id || acceptedFiles.length === 0) return;

      try {
        const compressedImages = await Promise.all(
          acceptedFiles.map(file => compressImage(file))
        );

        const currentImages = localImages;
        const updatedImages = [...currentImages, ...compressedImages];
        setLocalImages(updatedImages);
        updateTaskMutation.mutate({ images: updatedImages });
      } catch (error) {
        toast.error('Failed to add images');
        console.error('Error compressing images:', error);
      }
    },
  });

  const toggleComplete = (checked: boolean) => {
    updateTaskMutation.mutate({ 
      status: checked ? 'completed' : 'todo',
      completedAt: checked ? new Date() : undefined
    });
    if (checked) {
      onOpenChange(false);
    }
  };

  const moveToFocus = () => {
    updateTaskMutation.mutate({ isFocus: true });
  };

  const removeFromFocus = () => {
    updateTaskMutation.mutate({ isFocus: false });
  };

  const saveDescription = () => {
    updateTaskMutation.mutate({ description });
  };

  const toggleSubTask = (subTaskId: string) => {
    if (!task?.subTasks) return;
    const updated = task.subTasks.map(st => 
      st.id === subTaskId ? { ...st, completed: !st.completed } : st
    );
    updateTaskMutation.mutate({ subTasks: updated });
  };

  const handleDeleteImage = (imageId: string, index: number) => {
    if (!localImages || !task?.id) return;

    const imageToDelete = localImages[index];
    const updatedImages = localImages.filter((_, i) => i !== index);
    setLocalImages(updatedImages);
    setDeletedImage({ image: imageToDelete, index });

    updateTaskMutation.mutate({ images: updatedImages });

    // Auto-hide undo button after 5 seconds
    setTimeout(() => {
      setDeletedImage(null);
    }, 5000);
  };

  const handleUndoDelete = () => {
    if (!deletedImage || !task?.id) return;

    const restored = [...localImages];
    restored.splice(deletedImage.index, 0, deletedImage.image);
    setLocalImages(restored);
    updateTaskMutation.mutate({ images: restored });
    setDeletedImage(null);
  };

  const handleImageClick = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  if (!task) return null;

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-blue-500 text-white';
      case 'info': return 'bg-gray-400 text-white';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-6">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Checkbox 
                checked={task.status === 'completed'} 
                onCheckedChange={toggleComplete}
              />
              <span className={cn(task.status === 'completed' && "line-through")}>{task.title}</span>
            </SheetTitle>
            <SheetDescription className="flex items-center gap-2 flex-wrap mt-2">
              <Badge className={cn("text-xs", getPriorityBadgeColor(task.priority))}>
                {task.priority}
              </Badge>
              {task.isFocus && <Badge className="bg-green-600 text-xs">Focus</Badge>}
              {task.dueDate && (
                <Badge variant="outline" className="text-xs">
                  Due: {format(task.dueDate, 'MMM d, yyyy')}
                </Badge>
              )}
              {task.isStale && <Badge variant="outline" className="text-xs">🕸️ Stale</Badge>}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {/* Focus Controls */}
            <div className="flex gap-2">
              {!task.isFocus && task.status !== 'completed' && (
                <Button size="sm" variant="outline" onClick={moveToFocus} className="gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Move to Focus
                </Button>
              )}
              {task.isFocus && task.status !== 'completed' && (
                <Button size="sm" variant="outline" onClick={removeFromFocus} className="gap-2">
                  <ArrowRight className="h-4 w-4 rotate-180" />
                  Remove from Focus
                </Button>
              )}
            </div>

            <Separator />

            {/* Due Date - Compact */}
            <div>
              <h3 className="font-semibold text-sm mb-1.5">Due Date</h3>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal h-8", !task.dueDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {task.dueDate ? format(task.dueDate, 'MMM d, yyyy') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={task.dueDate || undefined}
                      onSelect={(date) => {
                        if (date) {
                          updateTaskMutation.mutate({ dueDate: date });
                          document.body.click();
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {task.dueDate && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateTaskMutation.mutate({ dueDate: undefined })}
                    title="Clear due date"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            {/* External Link - Compact */}
            {task.externalLink && (
              <div>
                <h3 className="font-semibold text-sm mb-1.5">External Link</h3>
                <a 
                  href={task.externalLink} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-2 text-blue-600 hover:underline text-sm"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {task.externalLink.includes('clickup') ? 'Open in ClickUp' :
                   task.externalLink.includes('figma') ? 'Open in Figma' :
                   'Open Link'}
                </a>
              </div>
            )}

            {/* Description - Moved above Images */}
            <div>
              <h3 className="font-semibold text-sm mb-1.5">Description</h3>
              <Textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={saveDescription}
                placeholder="Add a description..."
                className="min-h-[80px] text-sm"
              />
            </div>

            <Separator />

            {/* Images Section */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="font-semibold text-sm">Images</h3>
                {/* Inline Undo Button */}
                {deletedImage && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleUndoDelete}
                    className="h-7 text-xs gap-1.5"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Undo Delete
                  </Button>
                )}
              </div>
              
              {/* Drop Zone - More Compact */}
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                  isDragActive ? "border-blue-500 bg-blue-50/50" : "border-muted-foreground/25 hover:border-muted-foreground/50"
                )}
              >
                <input {...getInputProps()} />
                <Upload className="h-6 w-6 mx-auto mb-1.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  {isDragActive ? 'Drop images here' : 'Drag & drop or click to select'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG, WEBP, GIF</p>
              </div>

              {/* Image Thumbnails */}
              {localImages && localImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                  {localImages.map((image, index) => (
                    <div
                      key={image.id}
                      className="relative group aspect-square rounded-lg overflow-hidden border bg-muted cursor-pointer"
                      onClick={() => handleImageClick(index)}
                    >
                      <img
                        src={getImageDataUrl(image)}
                        alt={`Task image ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1.5 right-1.5 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteImage(image.id, index);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sub-tasks */}
            {task.subTasks && task.subTasks.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-1.5">Sub-tasks</h3>
                <div className="space-y-1.5">
                  {task.subTasks.map((subTask) => (
                    <div key={subTask.id} className="flex items-center gap-2">
                      <button onClick={() => toggleSubTask(subTask.id)}>
                        {subTask.completed ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </button>
                      <span className={cn("text-sm", subTask.completed && "line-through text-muted-foreground")}>
                        {subTask.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {task.notes && (
              <div>
                <h3 className="font-semibold text-sm mb-1.5">Notes</h3>
                <p className="text-sm text-muted-foreground">{task.notes}</p>
              </div>
            )}

            {/* Metadata - Compact */}
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>Created: {format(task.createdAt, 'MMM d, yyyy h:mm a')}</p>
              {task.completedAt && (
                <p>Completed: {format(task.completedAt, 'MMM d, yyyy h:mm a')}</p>
              )}
            </div>

            <Separator />

            {/* Delete Button */}
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => deleteTaskMutation.mutate()}
              className="w-full gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Task
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Lightbox */}
      {localImages && localImages.length > 0 && (
        <ImageLightbox
          images={localImages}
          initialIndex={lightboxIndex}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}
