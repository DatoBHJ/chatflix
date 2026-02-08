import { structuredPatch } from 'diff';

// ── Types ──────────────────────────────────────────────

export type DiffLineType = 'added' | 'removed' | 'context';

export interface DiffLine {
  type: DiffLineType;
  content: string;       // line text (without +/- prefix)
  oldLineNo?: number;    // line number in original file
  newLineNo?: number;    // line number in modified file
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
  id: string;            // unique ID for accept/reject tracking
}

export interface ChangeBlock {
  id: string;
  lines: DiffLine[];
}

export interface DiffSummary {
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

// ── Helpers ────────────────────────────────────────────

/**
 * Split a hunk into contiguous blocks of changes separated by context lines.
 */
export function splitHunkIntoChangeBlocks(hunk: DiffHunk): Array<{ type: 'context'; lines: DiffLine[] } | { type: 'change'; block: ChangeBlock }> {
  const segments: Array<{ type: 'context'; lines: DiffLine[] } | { type: 'change'; block: ChangeBlock }> = [];
  let ctxBuf: DiffLine[] = [];
  let chgBuf: DiffLine[] = [];
  let blockIdx = 0;

  const flushCtx = () => { if (ctxBuf.length) { segments.push({ type: 'context', lines: ctxBuf }); ctxBuf = []; } };
  const flushChg = () => {
    if (chgBuf.length) {
      // Use the first line's line number as part of the ID for stability
      const firstLine = chgBuf[0];
      const lineId = firstLine.type === 'removed' ? `o${firstLine.oldLineNo}` : `n${firstLine.newLineNo}`;
      segments.push({ type: 'change', block: { id: `${hunk.id}-cb-${lineId}`, lines: chgBuf } });
      chgBuf = [];
    }
  };

  for (const line of hunk.lines) {
    if (line.type === 'context') {
      flushChg();
      ctxBuf.push(line);
    } else {
      flushCtx();
      chgBuf.push(line);
    }
  }
  flushChg();
  flushCtx();
  return segments;
}

// ── Core function ──────────────────────────────────────

/**
 * Compute structured diff hunks between original and modified content.
 * If original is null/undefined, every line in modified is treated as "added" (new file).
 */
export function computeDiffHunks(
  original: string | null | undefined,
  modified: string,
  contextLines: number = 3,
): DiffSummary {
  // New file: all lines are additions
  if (original == null || original === '') {
    const modLines = modified.split('\n');
    const lines: DiffLine[] = modLines.map((line, i) => ({
      type: 'added' as const,
      content: line,
      newLineNo: i + 1,
    }));
    return {
      additions: modLines.length,
      deletions: 0,
      hunks: [{
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: modLines.length,
        lines,
        id: 'hunk-new-file',
      }],
    };
  }

  const patch = structuredPatch('a', 'b', original, modified, '', '', { context: contextLines });

  let totalAdded = 0;
  let totalRemoved = 0;
  const hunks: DiffHunk[] = [];

  for (let hi = 0; hi < patch.hunks.length; hi++) {
    const h = patch.hunks[hi];
    const diffLines: DiffLine[] = [];
    let oldLine = h.oldStart;
    let newLine = h.newStart;

    for (const rawLine of h.lines) {
      const prefix = rawLine[0];
      const text = rawLine.slice(1);

      if (prefix === '+') {
        diffLines.push({ type: 'added', content: text, newLineNo: newLine });
        newLine++;
        totalAdded++;
      } else if (prefix === '-') {
        diffLines.push({ type: 'removed', content: text, oldLineNo: oldLine });
        oldLine++;
        totalRemoved++;
      } else {
        // context line (prefix === ' ')
        diffLines.push({ type: 'context', content: text, oldLineNo: oldLine, newLineNo: newLine });
        oldLine++;
        newLine++;
      }
    }

    hunks.push({
      oldStart: h.oldStart,
      oldLines: h.oldLines,
      newStart: h.newStart,
      newLines: h.newLines,
      lines: diffLines,
      id: `hunk-${hi}`,
    });
  }

  return { additions: totalAdded, deletions: totalRemoved, hunks };
}

// ── Helpers ────────────────────────────────────────────

/**
 * Compute segments for the ENTIRE file, interleaving diff hunks into the full content.
 * This ensures the entire file is rendered in the UI, not just the changed parts.
 */
export function computeFullFileSegments(
  original: string | null | undefined,
  modified: string,
  hunks: DiffHunk[],
): Array<{ type: 'context'; lines: DiffLine[] } | { type: 'change'; block: ChangeBlock }> {
  if (original == null || original === '') {
    // New file: just return the hunks (which will be a single hunk with all added lines)
    return hunks.flatMap(h => splitHunkIntoChangeBlocks(h));
  }
  const origLines = original.split('\n');
  const modLines = modified.split('\n');
  const allSegments: Array<{ type: 'context'; lines: DiffLine[] } | { type: 'change'; block: ChangeBlock }> = [];
  let origIdx = 0; // 0-based current position in original lines
  let newIdx = 0;  // 0-based current position in modified lines

  for (const hunk of hunks) {
    const hunkOrigStart = hunk.oldStart - 1; // 0-based
    const hunkNewStart = hunk.newStart - 1;   // 0-based

    // 1. Fill gap before this hunk with context lines from original
    if (origIdx < hunkOrigStart) {
      const gapLines: DiffLine[] = [];
      while (origIdx < hunkOrigStart && origIdx < origLines.length) {
        gapLines.push({
          type: 'context',
          content: origLines[origIdx],
          oldLineNo: origIdx + 1,
          newLineNo: newIdx + 1,
        });
        origIdx++;
        newIdx++;
      }
      allSegments.push({ type: 'context', lines: gapLines });
    }

    // 2. Add the hunk's segments (context + change blocks)
    const segments = splitHunkIntoChangeBlocks(hunk);
    allSegments.push(...segments);
    
    // Update indices based on hunk's consumed lines
    origIdx += hunk.oldLines;
    newIdx += hunk.newLines;
  }

  // 3. Fill remaining lines after last hunk
  if (origIdx < origLines.length) {
    const tailLines: DiffLine[] = [];
    while (origIdx < origLines.length) {
      tailLines.push({
        type: 'context',
        content: origLines[origIdx],
        oldLineNo: origIdx + 1,
        newLineNo: newIdx + 1,
      });
      origIdx++;
      newIdx++;
    }
    allSegments.push({ type: 'context', lines: tailLines });
  }

  return allSegments;
}
/**
 * Rebuild file content by applying accept/reject decisions per change block.
 * This version uses the segments computed for the entire file to ensure 100% accuracy.
 */
export function rebuildContentFromSegments(
  allSegments: Array<{ type: 'context'; lines: DiffLine[] } | { type: 'change'; block: ChangeBlock }>,
  rejectedBlockIds: Set<string>,
): string {
  const lines: string[] = [];
  for (const seg of allSegments) {
    if (seg.type === 'context') {
      lines.push(...seg.lines.map(l => l.content));
    } else {
      if (rejectedBlockIds.has(seg.block.id)) {
        // Rejected block: use original (removed) lines
        lines.push(...seg.block.lines.filter(l => l.type === 'removed').map(l => l.content));
      } else {
        // Accepted block: use modified (added) lines
        lines.push(...seg.block.lines.filter(l => l.type === 'added').map(l => l.content));
      }
    }
  }
  return lines.join('\n');
}
