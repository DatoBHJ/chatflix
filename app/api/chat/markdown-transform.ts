import { TextStreamPart, ToolSet } from 'ai';

class MarkdownJoiner {
  private buffer = '';
  private isBuffering = false;

  processText(text: string): string {
    let output = '';

    for (const char of text) {
      if (!this.isBuffering) {
        // Check if we should start buffering
        if (char === '[' || char === '*') {
          this.buffer = char;
          this.isBuffering = true;
        } else {
          // Pass through character directly
          output += char;
        }
      } else {
        this.buffer += char;

        // Check for complete markdown elements or false positives
        if (this.isCompleteLink() || this.isCompleteBold()) {
          // Complete markdown element - flush buffer as is
          output += this.buffer;
          this.clearBuffer();
        } else if (this.isFalsePositive(char)) {
          // False positive - flush buffer as raw text
          output += this.buffer;
          this.clearBuffer();
        }
      }
    }

    return output;
  }

  private isCompleteLink(): boolean {
    // Match [text](url) pattern
    const linkPattern = /^\[.*?\]\(.*?\)$/;
    return linkPattern.test(this.buffer);
  }

  private isCompleteBold(): boolean {
    // Match **text** pattern
    const boldPattern = /^\*\*.*?\*\*$/;
    return boldPattern.test(this.buffer);
  }

  private isFalsePositive(char: string): boolean {
    // For links: if we see [ followed by something other than valid link syntax
    if (this.buffer.startsWith('[')) {
      // If we hit a newline or another [ without completing the link, it's false positive
      return char === '\n' || (char === '[' && this.buffer.length > 1);
    }

    // For bold: if we see * or ** followed by whitespace or newline
    if (this.buffer.startsWith('*')) {
      // Single * followed by whitespace is likely a list item
      if (this.buffer.length === 1 && /\s/.test(char)) {
        return true;
      }
      // If we hit newline without completing bold, it's false positive
      return char === '\n';
    }

    return false;
  }

  private clearBuffer(): void {
    this.buffer = '';
    this.isBuffering = false;
  }

  flush(): string {
    const remaining = this.buffer;
    this.clearBuffer();
    return remaining;
  }
}

export const markdownJoinerTransform = <TOOLS extends ToolSet>() => () => {
  const joiner = new MarkdownJoiner();

  return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
    transform(chunk, controller) {
      if (chunk.type === 'text-delta') {
        try {
          // AI SDK v5 sometimes uses textDelta; fall back to text if present
          const incoming = (chunk as any).textDelta ?? (chunk as any).text ?? '';
          const processedText = joiner.processText(incoming);
          if (processedText) {
            controller.enqueue({
              ...chunk,
              // Preserve both fields for compatibility
              text: processedText,
              textDelta: processedText,
            } as any);
          }
        } catch (error) {
          console.error('Error in markdown transform:', error);
          // Fallback: pass through original chunk
          controller.enqueue(chunk);
        }
      } else {
        controller.enqueue(chunk);
      }
    },
    flush(controller) {
      const remaining = joiner.flush();
      if (remaining) {
        controller.enqueue({
          type: 'text-delta',
          id: crypto.randomUUID(),
          text: remaining,
          textDelta: remaining,
        } as TextStreamPart<TOOLS>);
      }
    },
  });
};