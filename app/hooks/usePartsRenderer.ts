'use client';

import { useMemo } from 'react';

/**
 * Render segment types for interleaved tool preview
 */
export type RenderSegmentType = 'text' | 'tool' | 'reasoning' | 'image' | 'file' | 'data';

/**
 * Render segment structure
 */
export interface RenderSegment {
  type: RenderSegmentType;
  content: any;
  index: number;
}

/**
 * Tool segment content structure
 */
export interface ToolSegmentContent {
  call: {
    type: 'tool-call';
    toolCallId: string;
    toolName: string;
    args: any;
  };
  result: {
    type: 'tool-result';
    toolCallId: string;
    result: any;
  } | null;
}

/**
 * Segments parts array into renderable segments
 * Groups tool-call with its corresponding tool-result
 * Merges consecutive text parts
 */
function segmentParts(parts: any[]): RenderSegment[] {
  const segments: RenderSegment[] = [];
  let textBuffer = '';
  let segmentIndex = 0;
  const seenTexts = new Set<string>(); // Sequential text deduplication
  const seenToolCalls = new Set<string>(); // Tool call deduplication

  const flushTextBuffer = () => {
    const trimmed = textBuffer.trim();
    if (trimmed) {
      // 🚀 DUPLICATION FIX: If this exact text was just seen in the previous text segment, 
      // and it's long enough to be an intro/outro, we skip it to prevent repetitive bubbles.
      // This often happens in Agent Mode steps.
      const isDuplicate = segments.length > 0 && 
                         segments[segments.length - 1].type === 'text' && 
                         segments[segments.length - 1].content.trim() === trimmed;
      
      // Also check if it's the exact same text as ANY previous segment to catch model loops
      const isLikelyModelLoop = seenTexts.has(trimmed) && trimmed.length > 20;

      if (!isDuplicate && !isLikelyModelLoop) {
        segments.push({
          type: 'text',
          content: textBuffer,
          index: segmentIndex++,
        });
        seenTexts.add(trimmed);
      }
      textBuffer = '';
    }
  };

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    // 🚀 AI SDK 실제 포맷: type이 "tool-calculator", "tool-gemini_image_tool" 등으로 시작하는 경우 tool-call로 인식
    const isToolCall = part.type?.startsWith('tool-') && part.toolCallId && part.input;

    if (isToolCall) {
      // Flush text buffer first
      flushTextBuffer();
      
      // 🚀 DUPLICATION FIX: Skip if this exact tool call was already processed
      const toolCallKey = `${part.type}-${JSON.stringify(part.input)}`;
      if (seenToolCalls.has(toolCallKey)) {
        continue;
      }
      seenToolCalls.add(toolCallKey);

      // AI SDK 포맷: output이 tool-call 객체 안에 직접 포함됨
      const toolResult = part.output ? {
        type: 'tool-result',
        toolCallId: part.toolCallId,
        result: part.output,
      } : null;
      
      // tool-call 형식으로 정규화
      const normalizedToolCall = {
        type: 'tool-call',
        toolCallId: part.toolCallId,
        toolName: part.type.replace('tool-', ''), // "tool-calculator" → "calculator"
        args: part.input,
      };

      // Add tool segment
      segments.push({
        type: 'tool',
        content: {
          call: normalizedToolCall,
          result: toolResult,
        } as ToolSegmentContent,
        index: segmentIndex++,
      });
      continue;
    }

    switch (part.type) {
      case 'text':
        // Accumulate text parts
        textBuffer += part.text || '';
        break;

      case 'reasoning':
        // Flush text buffer first
        flushTextBuffer();
        // Add reasoning segment
        segments.push({
          type: 'reasoning',
          content: {
            reasoningText: part.reasoningText || part.text || '',
            details: part.details || [],
          },
          index: segmentIndex++,
        });
        break;

      case 'tool-call':
        // 표준 tool-call 형식 (하위 호환)
        // Flush text buffer first
        flushTextBuffer();
        
        // 🚀 DUPLICATION FIX: Skip if this exact tool call was already processed
        const legacyToolCallKey = `tool-call-${part.toolName || part.type}-${JSON.stringify(part.args || part.input)}`;
        if (seenToolCalls.has(legacyToolCallKey)) {
          break;
        }
        seenToolCalls.add(legacyToolCallKey);

        // Look for corresponding tool-result
        let toolResult = null;
        const nextPart = parts[i + 1];
        
        if (nextPart?.type === 'tool-result' && nextPart.toolCallId === part.toolCallId) {
          toolResult = nextPart;
          i++; // Skip the tool-result in next iteration
        } else {
          // Look ahead for the matching tool-result (might not be immediately next)
          for (let j = i + 1; j < parts.length; j++) {
            if (parts[j].type === 'tool-result' && parts[j].toolCallId === part.toolCallId) {
              toolResult = parts[j];
              // Don't skip here since it's not immediately after
              break;
            }
          }
        }

        // Add tool segment
        segments.push({
          type: 'tool',
          content: {
            call: part,
            result: toolResult,
          } as ToolSegmentContent,
          index: segmentIndex++,
        });
        break;

      case 'tool-result':
        // tool-result without a preceding tool-call (already processed)
        // Skip if already paired with tool-call
        break;

      case 'image':
        // Flush text buffer first
        flushTextBuffer();
        segments.push({
          type: 'image',
          content: part,
          index: segmentIndex++,
        });
        break;

      case 'file':
        // Flush text buffer first
        flushTextBuffer();
        segments.push({
          type: 'file',
          content: part,
          index: segmentIndex++,
        });
        break;

      default:
        // Handle data annotations (data-*) and step-start
        if (part.type?.startsWith('data-') || part.type === 'step-start') {
          // Data annotations are metadata, skip in segments
          // They are used by toolFunction.ts for extracting tool data
        }
        break;
    }
  }

  // Flush remaining text
  flushTextBuffer();

  return segments;
}

/**
 * Hook to process message parts into renderable segments
 * Determines whether to use interleaved mode based on stored parts
 */
export function usePartsRenderer(
  parts: any[] | undefined,
  hasStoredParts: boolean | undefined
): {
  segments: RenderSegment[];
  useInterleavedMode: boolean;
} {
  // 🚀 OPTIMIZATION: parts 배열의 실제 내용 비교 (progress annotation 제외)
  // parts 배열 참조 변경만으로는 재계산하지 않도록 최적화
  const partsKey = useMemo(() => {
    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      return '';
    }
    // progress annotation을 제외한 나머지만 직렬화하여 비교
    const partsWithoutProgress = parts.filter(
      (p: any) => p?.type !== 'data-wan25_video_progress'
    );
    return JSON.stringify(partsWithoutProgress);
  }, [parts]);

  return useMemo(() => {
    // No parts or empty parts
    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      return { segments: [], useInterleavedMode: false };
    }

    // 🚀 AI SDK 실제 포맷 인식: "tool-"로 시작하는 타입도 tool로 인식
    const hasToolParts = parts.some(
      (p) => p.type === 'tool-call' || 
             p.type === 'tool-result' || 
             (p.type?.startsWith('tool-') && p.toolCallId && p.input)
    );

    // Only use interleaved mode if:
    // 1. Parts were stored in DB (hasStoredParts is true) OR streaming mode
    // 2. Parts contain tool-call or tool-result
    if (!hasToolParts) {
      // No tool parts - use legacy mode
      return { segments: [], useInterleavedMode: false };
    }

    // Interleaved mode: segment the parts
    const segments = segmentParts(parts);
    
    return {
      segments,
      useInterleavedMode: true,
    };
  }, [partsKey, hasStoredParts, parts]); // partsKey가 변경되지 않으면 재계산 방지
}

/**
 * Utility to check if a message should use interleaved rendering
 */
export function shouldUseInterleavedMode(message: any): boolean {
  const parts = message?.parts;
  if (!parts || !Array.isArray(parts)) return false;
  
  return parts.some(
    (p: any) => p.type === 'tool-call' || p.type === 'tool-result'
  );
}

export default usePartsRenderer;
