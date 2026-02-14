export type VideoMapValue =
  | string
  | { url: string; size?: string }
  | { videoUrl: string; size?: string };

export type ResolveMediaPlaceholdersOptions = {
  linkMap?: Record<string, string>;
  imageMap?: Record<string, string>;
  videoMap?: Record<string, VideoMapValue>;
  /** How to render resolved images. */
  imageOutput?: 'markdown' | 'url';
  /**
   * What to do when the placeholder can't be resolved.
   * - 'remove': remove the token entirely (matches current chat behavior)
   * - 'keep': keep the original token text
   */
  unresolvedPolicy?: 'remove' | 'keep';
};

const TOKEN_TYPES = ['LINK_ID', 'IMAGE_ID', 'VIDEO_ID'] as const;
type TokenType = (typeof TOKEN_TYPES)[number];

const BRACKETED_TOKEN_REGEX = /\[(LINK_ID|IMAGE_ID|VIDEO_ID):([^\]]+)\]/g;
// Plain form used in some workspace markdown files: LINK_ID:..., IMAGE_ID:..., VIDEO_ID:...
// We intentionally require a non-word prefix so we don't match inside other strings.
const PLAIN_TOKEN_REGEX = /(^|[^\w\[])(LINK_ID|IMAGE_ID|VIDEO_ID):([A-Za-z0-9_.:-]+)/g;

function normalizeVideoUrl(value: VideoMapValue | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  const v: any = value as any;
  if (typeof v.url === 'string') return v.url;
  if (typeof v.videoUrl === 'string') return v.videoUrl;
  return null;
}

function resolveOneToken(
  type: TokenType,
  id: string,
  maps: Required<Pick<ResolveMediaPlaceholdersOptions, 'linkMap' | 'imageMap' | 'videoMap'>>,
  imageOutput: 'markdown' | 'url',
): string | null {
  if (type === 'LINK_ID') return maps.linkMap[id] || null;
  if (type === 'IMAGE_ID') {
    const url = maps.imageMap[id];
    if (!url) return null;
    return imageOutput === 'url' ? url : `![](${url})`;
  }
  if (type === 'VIDEO_ID') {
    const url = normalizeVideoUrl(maps.videoMap[id]);
    return url || null;
  }
  return null;
}

function splitByFencedCodeBlocks(content: string): Array<{ text: string; isCode: boolean }> {
  // Very small parser: toggles on lines that start with ``` (optionally indented).
  // We skip replacement inside code blocks so mermaid fences never get mutated.
  const lines = content.split('\n');
  const out: Array<{ text: string; isCode: boolean }> = [];
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isFenceLine = /^\s*```/.test(line);

    if (isFenceLine) {
      // Include fence markers in the current state, then toggle.
      out.push({ text: line + (i === lines.length - 1 ? '' : '\n'), isCode: true });
      inFence = !inFence;
      continue;
    }

    out.push({ text: line + (i === lines.length - 1 ? '' : '\n'), isCode: inFence });
  }

  return out;
}

export function resolveMediaPlaceholders(
  content: string,
  options: ResolveMediaPlaceholdersOptions = {},
): string {
  if (!content) return content;

  const linkMap = options.linkMap || {};
  const imageMap = options.imageMap || {};
  const videoMap = options.videoMap || {};
  const imageOutput = options.imageOutput || 'markdown';
  const unresolvedPolicy = options.unresolvedPolicy || 'remove';

  // Fast-path: if none of the keywords appear, skip work.
  if (
    !content.includes('LINK_ID:') &&
    !content.includes('IMAGE_ID:') &&
    !content.includes('VIDEO_ID:') &&
    !content.includes('[LINK_ID:') &&
    !content.includes('[IMAGE_ID:') &&
    !content.includes('[VIDEO_ID:')
  ) {
    return content;
  }

  const segments = splitByFencedCodeBlocks(content);
  const resolved = segments
    .map((seg) => {
      if (seg.isCode) return seg.text;

      let text = seg.text;

      // Bracketed tokens: [LINK_ID:x], [IMAGE_ID:x], [VIDEO_ID:x]
      text = text.replace(BRACKETED_TOKEN_REGEX, (match, type: TokenType, id: string) => {
        const replacement = resolveOneToken(type, id, { linkMap, imageMap, videoMap }, imageOutput);
        if (replacement) return replacement;
        return unresolvedPolicy === 'keep' ? match : '';
      });

      // Plain tokens: LINK_ID:x, IMAGE_ID:x, VIDEO_ID:x
      text = text.replace(PLAIN_TOKEN_REGEX, (match, prefix: string, type: TokenType, id: string) => {
        const tokenText = `${type}:${id}`;
        const replacement = resolveOneToken(type, id, { linkMap, imageMap, videoMap }, imageOutput);
        if (replacement) return `${prefix}${replacement}`;
        return unresolvedPolicy === 'keep' ? `${prefix}${tokenText}` : prefix;
      });

      return text;
    })
    .join('');

  return resolved;
}

