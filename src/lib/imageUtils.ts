import { TaskImage } from './db';

export async function compressImage(file: File): Promise<TaskImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        // Calculate new dimensions (max width 1200px, maintain aspect ratio)
        const maxWidth = 1200;
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to base64 with quality 0.8
        const mimeType = file.type || 'image/png';
        const quality = 0.8;
        
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            
            const reader2 = new FileReader();
            reader2.onload = (e2) => {
              const base64 = (e2.target?.result as string).split(',')[1];
              
              resolve({
                id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                data: base64,
                mimeType: blob.type,
                createdAt: Date.now()
              });
            };
            
            reader2.onerror = () => reject(new Error('Failed to read compressed image'));
            reader2.readAsDataURL(blob);
          },
          mimeType,
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function getImageDataUrl(image: TaskImage): string {
  return `data:${image.mimeType};base64,${image.data}`;
}

