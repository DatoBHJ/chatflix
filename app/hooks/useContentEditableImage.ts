import { useState, useCallback, useRef } from 'react';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export interface InsertedImage {
  blobUrl: string;
  base64: string;
  file: File;
}

export function useContentEditableImage() {
  const [insertedImages, setInsertedImages] = useState<Map<string, InsertedImage>>(new Map());
  const contentEditableRef = useRef<HTMLDivElement>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const insertImageIntoContentEditable = useCallback(async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) return { error: 'Unsupported file type.' };
    if (file.size > MAX_SIZE) return { error: 'File size exceeds 10MB.' };
    if (!contentEditableRef.current) return { error: 'Input area not found.' };

    try {
      const blobUrl = URL.createObjectURL(file);
      const base64 = await fileToBase64(file);
      const imageId = `img_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      
      setInsertedImages(prev => {
        const next = new Map(prev);
        next.set(imageId, { blobUrl, base64, file });
        return next;
      });

      // Create image container (block element for line break)
      const container = document.createElement('div');
      container.contentEditable = 'false';
      container.style.display = 'block';
      container.style.margin = '6px 0';
      container.style.userSelect = 'none';
      
      const img = document.createElement('img');
      img.src = blobUrl;
      img.setAttribute('data-image-id', imageId);
      
      // Style adjustment: Maintain aspect ratio with fixed constraints
      // "가로가 크면 가로가 크게, 세로가 크면 세로가 크게" -> Maintain natural aspect ratio within max limits
      img.style.display = 'block';
      img.style.width = 'auto';
      img.style.height = 'auto';
      img.style.maxWidth = '100%'; // Limit width to container
      img.style.maxHeight = '200px'; // Limit height to prevent taking up too much space
      img.style.borderRadius = '12px';
      img.style.cursor = 'default';
      img.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
      img.style.border = '1px solid rgba(0,0,0,0.05)';
      
      // Auto-scroll to bottom when image loads
      img.onload = () => {
        if (contentEditableRef.current) {
          contentEditableRef.current.scrollTop = contentEditableRef.current.scrollHeight;
        }
      };
      
      container.appendChild(img);
      
      const selection = window.getSelection();
      
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        
        if (contentEditableRef.current.contains(range.commonAncestorContainer)) {
            range.deleteContents();
            
            // If we are inside a text node, inserting a block element (div) might split it or be invalid in some contexts.
            // But usually browsers handle inserting block into contenteditable div fine.
            range.insertNode(container);
            
            // Insert a new line (div with br) after the image
            const newLine = document.createElement('div');
            newLine.appendChild(document.createElement('br'));
            
            range.setStartAfter(container);
            range.insertNode(newLine);
            
            // Move cursor to the start of the new line
            range.setStart(newLine, 0);
            range.collapse(true);
            
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // Append to end if selection is outside
            contentEditableRef.current.appendChild(container);
            const newLine = document.createElement('div');
            newLine.appendChild(document.createElement('br'));
            contentEditableRef.current.appendChild(newLine);
        }
      } else {
        contentEditableRef.current.appendChild(container);
        const newLine = document.createElement('div');
        newLine.appendChild(document.createElement('br'));
        contentEditableRef.current.appendChild(newLine);
      }
      
      contentEditableRef.current.focus();
      
      // Trigger input event
      const inputEvent = new Event('input', { bubbles: true });
      contentEditableRef.current.dispatchEvent(inputEvent);

      // Force scroll to bottom immediately after insertion
      requestAnimationFrame(() => {
        if (contentEditableRef.current) {
          contentEditableRef.current.scrollTop = contentEditableRef.current.scrollHeight;
        }
        // Double check after a short delay for layout calculation
        setTimeout(() => {
             if (contentEditableRef.current) {
                contentEditableRef.current.scrollTop = contentEditableRef.current.scrollHeight;
             }
        }, 10);
      });

      return { success: true, imageId, blobUrl };
    } catch (error) {
      console.error('Failed to insert image:', error);
      return { error: 'Failed to insert image.' };
    }
  }, []);

  // Function to sync insertedImages map with DOM (call onInput)
  const syncImagesWithDOM = useCallback(() => {
    if (!contentEditableRef.current) return;
    
    const domImages = contentEditableRef.current.querySelectorAll('img[data-image-id]');
    const domImageIds = new Set(Array.from(domImages).map(img => img.getAttribute('data-image-id')).filter(Boolean) as string[]);
    
    setInsertedImages(prev => {
      const next = new Map(prev);
      let hasChanges = false;
      for (const [imageId, data] of prev) {
        if (!domImageIds.has(imageId)) {
          // Revoke URL to avoid memory leaks
          URL.revokeObjectURL(data.blobUrl);
          next.delete(imageId);
          hasChanges = true;
        }
      }
      return hasChanges ? next : prev;
    });
  }, []);

  // Extract content from contentEditable with uploaded_image_N placeholders
  const extractContentFromEditable = useCallback((startIndex: number = 1) => {
    if (!contentEditableRef.current) {
      return { text: '', imageFiles: [], imageOrder: [] };
    }

    const imageFiles: File[] = [];
    const imageOrder: string[] = [];
    let text = '';
    let imageIndex = startIndex;

    const walker = document.createTreeWalker(
      contentEditableRef.current,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
          if (node.nodeType === Node.ELEMENT_NODE && 
              (node as Element).tagName === 'IMG') return NodeFilter.FILTER_ACCEPT;
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const img = node as HTMLImageElement;
        const imageId = img.getAttribute('data-image-id');
        if (imageId && insertedImages.has(imageId)) {
          const imageData = insertedImages.get(imageId)!;
          imageFiles.push(imageData.file);
          imageOrder.push(imageId);
          text += ` uploaded_image_${imageIndex++} `;
        }
      }
    }

    return { 
      text: text.trim().replace(/\s+/g, ' '), 
      imageFiles, 
      imageOrder 
    };
  }, [insertedImages]);

  return {
    insertedImages,
    setInsertedImages,
    contentEditableRef,
    insertImageIntoContentEditable,
    syncImagesWithDOM,
    extractContentFromEditable
  };
}
