type AnyRecord = Record<string, any>;

export type StripHistoricalSearchOptions = {
  /**
   * Keep the most recent turn intact.
   * In practice, we keep from (lastUserIndex - 1) to end, so the LLM still sees
   * the latest assistant response plus the current user message.
   */
  keepLastTurns?: number; // currently only 1 is supported

  /**
   * If true, insert a tiny placeholder text part indicating counts.
   * Default: false (user said this can be omitted).
   */
  leavePlaceholder?: boolean;

  /**
   * If true, also strip search-related parts/tool_results from the most recent
   * assistant message that we keep for conversational continuity.
   *
   * This prevents "last assistant message contains huge search dumps" from
   * causing the next user turn to exceed the model context window.
   */
  stripSearchPartsInKeptTurns?: boolean;
};

const SEARCH_TOOL_RESULT_KEYS = new Set([
  'webSearchResults',
  'googleSearchResults',
  'twitterSearchResults',
]);

function isSearchRelatedPartType(type: unknown): boolean {
  if (typeof type !== 'string') return false;
  // AI SDK v5 parts observed in DB include: tool-twitter_search, data-twitter_search_complete, etc.
  if (type === 'data-query_completion') return true; // used by web_search flow

  const prefixes = [
    'tool-twitter_search',
    'data-twitter_search_',
    'tool-google_search',
    'data-google_search_',
    'tool-web_search',
    'data-web_search_',
  ];
  return prefixes.some((p) => type.startsWith(p));
}

function safeCountSearchResults(toolResultsValue: unknown): number | null {
  // We keep this intentionally conservative: return a small integer if easy, else null.
  const v = toolResultsValue as any;
  if (!v || typeof v !== 'object') return null;
  // Common shape: { searches: [{ results: [...] }, ...] }
  const searches = Array.isArray(v.searches) ? v.searches : null;
  if (!searches) return null;
  let count = 0;
  for (const s of searches) {
    if (s && Array.isArray((s as any).results)) count += (s as any).results.length;
  }
  return Number.isFinite(count) ? count : null;
}

function computeHistoricalBoundary(messages: any[], keepLastTurns: number): number {
  if (!Array.isArray(messages) || messages.length === 0) return 0;
  if (keepLastTurns !== 1) {
    // Only 1 is needed for current requirement; keep behavior predictable.
    keepLastTurns = 1;
  }

  // Keep the last user message and the assistant message immediately before it (if any).
  const lastUserIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === 'user') return i;
    }
    return -1;
  })();

  if (lastUserIndex < 0) {
    // No user message found; treat everything as historical? Safer to keep last 2 messages.
    return Math.max(0, messages.length - 2);
  }

  return Math.max(0, lastUserIndex - 1);
}

/**
 * Remove historical search tool outputs from messages before sending to the LLM.
 * This prevents huge old search dumps from bloating context windows.
 */
export function stripHistoricalSearchFromMessages(
  messages: any[],
  opts: StripHistoricalSearchOptions = {},
): any[] {
  if (!Array.isArray(messages) || messages.length === 0) return Array.isArray(messages) ? messages : [];

  const keepLastTurns = opts.keepLastTurns ?? 1;
  const boundary = computeHistoricalBoundary(messages, keepLastTurns);
  const leavePlaceholder = opts.leavePlaceholder === true;
  const stripSearchPartsInKeptTurns = opts.stripSearchPartsInKeptTurns === true;

  // Note: even when boundary <= 0, we may still want to strip kept assistant parts.

  let changed = false;
  const out = messages.map((msg: any, idx: number) => {
    if (!msg || typeof msg !== 'object') return msg;

    const isKeptRegion = idx >= boundary;
    const shouldStripHere =
      (!isKeptRegion) ||
      (stripSearchPartsInKeptTurns && msg.role === 'assistant');

    if (!shouldStripHere) return msg;

    let msgChanged = false;
    const next: AnyRecord = { ...(msg as AnyRecord) };

    // Strip tool_results keys (keep token_usage and other non-search tool results intact).
    if (next.tool_results && typeof next.tool_results === 'object') {
      const tr: AnyRecord = { ...(next.tool_results as AnyRecord) };
      let placeholderCounts: string[] = [];

      for (const key of SEARCH_TOOL_RESULT_KEYS) {
        if (key in tr) {
          if (leavePlaceholder) {
            const c = safeCountSearchResults(tr[key]);
            placeholderCounts.push(`${key}=${c ?? 'unknown'}`);
          }
          delete tr[key];
          msgChanged = true;
        }
      }

      // If tool_results becomes empty, keep it as-is (nulling is a behavior change); just set trimmed object.
      next.tool_results = tr;

      if (leavePlaceholder && placeholderCounts.length > 0 && !isKeptRegion) {
        const text = `[Previous search results omitted: ${placeholderCounts.join(', ')}]`;
        const parts = Array.isArray(next.parts) ? [...next.parts] : [];
        parts.push({ type: 'text', text });
        next.parts = parts;
        msgChanged = true;
      }
    }

    // Strip search-related parts.
    if (Array.isArray(next.parts) && next.parts.length > 0) {
      const beforeLen = next.parts.length;
      const filtered = next.parts.filter((p: any) => !isSearchRelatedPartType(p?.type));
      if (filtered.length !== beforeLen) {
        next.parts = filtered;
        msgChanged = true;
      }
    }

    if (msgChanged) changed = true;
    return msgChanged ? next : msg;
  });

  return changed ? out : messages;
}

