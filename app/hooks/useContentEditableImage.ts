import { useState, useCallback, useRef } from 'react';
import { getIcon } from 'material-file-icons';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export interface InsertedImage {
  blobUrl: string;
  base64: string;
  file: File;
}

export interface InsertedFileChip {
  file: File;
  label: string;
}

export function useContentEditableImage() {
  const [insertedImages, setInsertedImages] = useState<Map<string, InsertedImage>>(new Map());
  const [insertedFileChips, setInsertedFileChips] = useState<Map<string, InsertedFileChip>>(new Map());
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
      container.style.userSelect = 'text'; // 텍스트 선택 가능하도록 변경
      container.style.position = 'relative';
      container.setAttribute('data-image-container-id', imageId);
      
      // Add click handler to allow cursor positioning around image (no preventDefault for natural behavior)
      container.addEventListener('click', (e) => {
        const selection = window.getSelection();
        if (!selection || !contentEditableRef.current) return;
        
        const rect = container.getBoundingClientRect();
        const clickX = e.clientX;
        const containerCenterX = rect.left + rect.width / 2;
        
        const range = document.createRange();
        if (clickX < containerCenterX) {
          range.setStartBefore(container);
          range.collapse(true);
        } else {
          range.setStartAfter(container);
          range.collapse(true);
        }
        
        selection.removeAllRanges();
        selection.addRange(range);
        contentEditableRef.current.focus();
      });
      
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
      
      // Use execCommand('insertHTML') to ensure undo stack recording
      // This is the most reliable way to make browser record DOM manipulation in undo history
      // We'll convert the container to HTML string, insert it, then fix cursor position
      // Add zero-width space before and after image to allow cursor positioning between images
      const br = document.createElement('br');
      const tempDiv = document.createElement('div');
      const zeroWidthSpaceBefore = document.createTextNode('\u200B');
      const zeroWidthSpaceAfter = document.createTextNode('\u200B');
      tempDiv.appendChild(zeroWidthSpaceBefore.cloneNode(true));
      tempDiv.appendChild(container.cloneNode(true));
      tempDiv.appendChild(zeroWidthSpaceAfter.cloneNode(true));
      tempDiv.appendChild(br.cloneNode(true));
      const htmlString = tempDiv.innerHTML;
      
      // Helper function to re-attach click handler to inserted container
      const attachClickHandler = (insertedContainer: HTMLElement) => {
        insertedContainer.addEventListener('click', (e) => {
          const sel = window.getSelection();
          if (!sel || !contentEditableRef.current) return;
          
          const rect = insertedContainer.getBoundingClientRect();
          const clickX = e.clientX;
          const containerCenterX = rect.left + rect.width / 2;
          
          // Find zero-width space nodes before and after container
          const prevSibling = insertedContainer.previousSibling;
          const nextSibling = insertedContainer.nextSibling;
          
          const r = document.createRange();
          if (clickX < containerCenterX) {
            // Click on left side - place cursor before image
            // Use zero-width space before if exists, otherwise before container
            if (prevSibling && prevSibling.nodeType === Node.TEXT_NODE && prevSibling.textContent === '\u200B') {
              r.setStart(prevSibling, 0);
            } else {
              r.setStartBefore(insertedContainer);
            }
            r.collapse(true);
          } else {
            // Click on right side - place cursor after image
            // Use zero-width space after if exists, otherwise after container
            if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE && nextSibling.textContent === '\u200B') {
              r.setStart(nextSibling, 1);
            } else {
              r.setStartAfter(insertedContainer);
            }
            r.collapse(true);
          }
          
          sel.removeAllRanges();
          sel.addRange(r);
          contentEditableRef.current.focus();
        });
      };
      
      // Helper function to set cursor after the BR tag that follows the inserted container
      const setCursorAfterBr = (insertedContainer: HTMLElement | null) => {
        if (!insertedContainer) return;
        
        // Find the BR tag that immediately follows the inserted container
        const nextSibling = insertedContainer.nextSibling;
        if (nextSibling && nextSibling.nodeType === Node.ELEMENT_NODE && (nextSibling as HTMLElement).tagName === 'BR') {
          const br = nextSibling as HTMLElement;
          const newRange = document.createRange();
          newRange.setStartAfter(br);
          newRange.collapse(true);
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(newRange);
          }
        } else {
          // If BR is not found as next sibling, try to find it or create one
          // Fallback: set cursor after the container itself
          const newRange = document.createRange();
          newRange.setStartAfter(insertedContainer);
          newRange.collapse(true);
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(newRange);
          }
        }
      };
      
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        
        if (contentEditableRef.current.contains(range.commonAncestorContainer)) {
            // Insert at cursor position using execCommand (preserves undo stack)
            if (!range.collapsed) {
              range.deleteContents();
            }
            
            // Set selection to collapsed range for insertion
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            
            // Use execCommand to insert HTML (this is recorded in undo stack)
            document.execCommand('insertHTML', false, htmlString);
            
            // Re-attach event listener to the newly inserted container
            const insertedContainer = contentEditableRef.current.querySelector(`[data-image-container-id="${imageId}"]`) as HTMLElement;
            if (insertedContainer) {
              attachClickHandler(insertedContainer);
              // Set cursor position after BR tag
              setCursorAfterBr(insertedContainer);
            }
        } else {
            // Append to end - move cursor to end first
            const endRange = document.createRange();
            endRange.selectNodeContents(contentEditableRef.current);
            endRange.collapse(false);
            selection.removeAllRanges();
            selection.addRange(endRange);
            
            // Use execCommand to insert HTML (this is recorded in undo stack)
            document.execCommand('insertHTML', false, htmlString);
            
            // Re-attach event listener to the newly inserted container
            const insertedContainer = contentEditableRef.current.querySelector(`[data-image-container-id="${imageId}"]`) as HTMLElement;
            if (insertedContainer) {
              attachClickHandler(insertedContainer);
              // Set cursor position after BR tag
              setCursorAfterBr(insertedContainer);
            }
        }
      } else {
        // No selection - append to end
        const endRange = document.createRange();
        endRange.selectNodeContents(contentEditableRef.current);
        endRange.collapse(false);
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(endRange);
        }
        
        // Use execCommand to insert HTML (this is recorded in undo stack)
        document.execCommand('insertHTML', false, htmlString);
        
        // Re-attach event listener to the newly inserted container
        const insertedContainer = contentEditableRef.current.querySelector(`[data-image-container-id="${imageId}"]`) as HTMLElement;
        if (insertedContainer) {
          attachClickHandler(insertedContainer);
          // Set cursor position after BR tag
          setCursorAfterBr(insertedContainer);
        }
      }
      
      contentEditableRef.current.focus();

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

  const getFileChipLabel = useCallback((file: File) => {
    return file.name;
  }, []);

  const escapeHtml = useCallback((value: string) => {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }, []);

  const dispatchInputEvent = useCallback(() => {
    if (!contentEditableRef.current) return;
    contentEditableRef.current.dispatchEvent(new Event('input', { bubbles: true }));
  }, []);

  const removeFileChipFromContentEditable = useCallback((chipId: string) => {
    if (!contentEditableRef.current) return;
    const chip = contentEditableRef.current.querySelector(`[data-file-chip-id="${chipId}"]`);
    if (!chip) return;
    const trailingSpacer = chip.nextSibling;
    if (trailingSpacer && trailingSpacer.nodeType === Node.TEXT_NODE && trailingSpacer.textContent === ' ') {
      trailingSpacer.remove();
    }
    chip.remove();
    setInsertedFileChips((prev) => {
      const next = new Map(prev);
      next.delete(chipId);
      return next;
    });
    dispatchInputEvent();
  }, [dispatchInputEvent]);

  const insertFileChipIntoContentEditable = useCallback((file: File, providedChipId?: string) => {
    if (!contentEditableRef.current) return { error: 'Input area not found.' };

    const chipId = providedChipId || `file_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const label = getFileChipLabel(file);
    const escapedLabel = escapeHtml(label);
    const escapedTitle = escapeHtml(file.name);
    const fileIconSvg = getIcon(file.name).svg;

    setInsertedFileChips((prev) => {
      const next = new Map(prev);
      next.set(chipId, { file, label });
      return next;
    });

    const chipHtml = `<span data-file-chip-id="${chipId}" contenteditable="false" style="display:inline-flex;align-items:center;gap:7px;vertical-align:middle;border-radius:9999px;overflow:hidden;flex-shrink:0;font-size:14px;line-height:1.2;color:var(--foreground);padding:4px 10px;background:var(--accent);max-width:100%;margin:0 4px 0 0;">
<span style="width:1.25em;height:1.25em;min-width:1.25em;min-height:1.25em;overflow:hidden;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;">
<span style="width:100%;height:100%;display:inline-flex;align-items:center;justify-content:center;">${fileIconSvg}</span>
</span>
<span title="${escapedTitle}" style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px;">${escapedLabel}</span>
<span data-file-chip-remove="true" style="cursor:pointer;opacity:0.8;font-size:12px;line-height:1;padding-left:2px;">×</span>
</span> `;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (!range.collapsed) {
        range.deleteContents();
      }
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand('insertHTML', false, chipHtml);
    } else {
      const endRange = document.createRange();
      endRange.selectNodeContents(contentEditableRef.current);
      endRange.collapse(false);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(endRange);
      }
      document.execCommand('insertHTML', false, chipHtml);
    }

    const insertedChip = contentEditableRef.current.querySelector(`[data-file-chip-id="${chipId}"]`) as HTMLElement | null;
    if (insertedChip) {
      const removeButton = insertedChip.querySelector('[data-file-chip-remove="true"]');
      if (removeButton) {
        removeButton.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          removeFileChipFromContentEditable(chipId);
          contentEditableRef.current?.focus();
        });
      }
    }

    contentEditableRef.current.focus();
    dispatchInputEvent();
    return { success: true, chipId };
  }, [dispatchInputEvent, escapeHtml, getFileChipLabel, removeFileChipFromContentEditable]);

  const syncFileChipsWithDOM = useCallback(() => {
    if (!contentEditableRef.current) return;
    const domChips = contentEditableRef.current.querySelectorAll('[data-file-chip-id]');
    const domChipIds = new Set(
      Array.from(domChips)
        .map((chip) => chip.getAttribute('data-file-chip-id'))
        .filter(Boolean) as string[]
    );

    setInsertedFileChips((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const chipId of prev.keys()) {
        if (!domChipIds.has(chipId)) {
          next.delete(chipId);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
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

  // Extract content from contentEditable with uploaded_image_N and uploaded_file_N placeholders
  const extractContentFromEditable = useCallback((startImageIndex: number = 1, startFileIndex: number = 1) => {
    if (!contentEditableRef.current) {
      return { text: '', imageFiles: [], imageOrder: [], fileFiles: [], fileOrder: [] };
    }

    const imageFiles: File[] = [];
    const imageOrder: string[] = [];
    const fileFiles: File[] = [];
    const fileOrder: string[] = [];
    let text = '';
    let imageIndex = startImageIndex;
    let fileIndex = startFileIndex;

    const walker = document.createTreeWalker(
      contentEditableRef.current,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (element.tagName === 'IMG') return NodeFilter.FILTER_ACCEPT;
            if (element.hasAttribute('data-file-chip-id')) return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        const parentElement = (node as Text).parentElement;
        if (parentElement?.closest('[data-file-chip-id]')) {
          continue;
        }
        const textContent = node.textContent || '';
        // Filter out zero-width spaces used for cursor positioning (empty text nodes are fine)
        const filteredText = textContent.replace(/\u200B/g, '');
        text += filteredText;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const imageId = element.getAttribute('data-image-id');
        if (imageId && insertedImages.has(imageId)) {
          const imageData = insertedImages.get(imageId)!;
          imageFiles.push(imageData.file);
          imageOrder.push(imageId);
          text += ` uploaded_image_${imageIndex++} `;
          continue;
        }

        const fileChipId = element.getAttribute('data-file-chip-id');
        if (fileChipId && insertedFileChips.has(fileChipId)) {
          const fileChipData = insertedFileChips.get(fileChipId)!;
          fileFiles.push(fileChipData.file);
          fileOrder.push(fileChipId);
          text += ` uploaded_file_${fileIndex++} `;
        }
      }
    }

    return { 
      text: text.trim().replace(/\s+/g, ' '), 
      imageFiles, 
      imageOrder,
      fileFiles,
      fileOrder
    };
  }, [insertedImages, insertedFileChips]);

  return {
    insertedImages,
    setInsertedImages,
    insertedFileChips,
    setInsertedFileChips,
    contentEditableRef,
    insertImageIntoContentEditable,
    insertFileChipIntoContentEditable,
    removeFileChipFromContentEditable,
    syncImagesWithDOM,
    syncFileChipsWithDOM,
    extractContentFromEditable
  };
}
