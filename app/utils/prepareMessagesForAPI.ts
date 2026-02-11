type AnyRecord = Record<string, any>;

const MAX_STDIO_LINES = 20;
const MAX_STDIO_LINE_CHARS = 400;
const MAX_ERROR_VALUE_CHARS = 500;
const MAX_ERROR_TRACEBACK_LINES = 5;
const MAX_TEXT_RESULT_CHARS = 300;
const MAX_URL_LENGTH = 300;

const SEARCH_UI_ONLY_KEYS = ['linkMap', 'imageMap', 'thumbnailMap', 'titleMap', 'linkMetaMap'];

function truncateString(value: string, maxChars: number): string {
  if (typeof value !== 'string') return '';
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}...`;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((line) => typeof line === 'string')
    .slice(0, MAX_STDIO_LINES)
    .map((line) => truncateString(line, MAX_STDIO_LINE_CHARS));
}

function summarizeRunCodeResultItem(item: unknown): AnyRecord {
  const x = item && typeof item === 'object' ? (item as AnyRecord) : {};
  let type = 'output';
  if (x.chart != null) type = 'chart';
  else if (x.png != null || x.jpeg != null) type = 'figure';
  else if (x.html != null) type = 'html';
  else if (x.text != null) type = 'text';
  else if (x.json != null) type = 'json';

  const summary: AnyRecord = { type, summary: type };
  if (typeof x.filename === 'string') summary.filename = x.filename;
  if (typeof x.path === 'string') summary.path = x.path;
  if (typeof x.url === 'string') summary.url = truncateString(x.url, MAX_URL_LENGTH);
  if (typeof x.mime === 'string') summary.mime = x.mime;
  if (typeof x.size === 'number') summary.size = x.size;
  if (typeof x.text === 'string' && type === 'text') {
    summary.text = truncateString(x.text, MAX_TEXT_RESULT_CHARS);
  }
  return summary;
}

export function slimRunCodePayload(raw: unknown): AnyRecord {
  const payload = raw && typeof raw === 'object' ? (raw as AnyRecord) : {};
  const error = payload.error && typeof payload.error === 'object'
    ? {
        name: typeof payload.error.name === 'string' ? payload.error.name : undefined,
        value: typeof payload.error.value === 'string'
          ? truncateString(payload.error.value, MAX_ERROR_VALUE_CHARS)
          : payload.error.value,
        traceback: Array.isArray(payload.error.traceback)
          ? payload.error.traceback
              .filter((line: unknown) => typeof line === 'string')
              .slice(0, MAX_ERROR_TRACEBACK_LINES)
          : undefined,
      }
    : undefined;

  const normalizedResults = Array.isArray(payload.results)
    ? payload.results.map((item: unknown) => summarizeRunCodeResultItem(item))
    : [];

  return {
    success: payload.success === true,
    stdout: normalizeStringArray(payload.stdout),
    stderr: normalizeStringArray(payload.stderr),
    results: normalizedResults,
    ...(error ? { error } : {}),
    ...(typeof payload.toolCallId === 'string' ? { toolCallId: payload.toolCallId } : {}),
  };
}

function slimToolResultEntry(entry: unknown): AnyRecord {
  const result = entry && typeof entry === 'object' ? { ...(entry as AnyRecord) } : {};
  for (const key of SEARCH_UI_ONLY_KEYS) {
    if (key in result) delete result[key];
  }
  return result;
}

export function slimToolResults(raw: unknown): AnyRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const toolResults: AnyRecord = { ...(raw as AnyRecord) };

  if (Array.isArray(toolResults.runCodeResults)) {
    toolResults.runCodeResults = toolResults.runCodeResults.map((run: unknown) => slimRunCodePayload(run));
  }

  if (Array.isArray(toolResults.webSearchResults)) {
    toolResults.webSearchResults = toolResults.webSearchResults.map((entry: unknown) => slimToolResultEntry(entry));
  }

  if (Array.isArray(toolResults.googleSearchResults)) {
    toolResults.googleSearchResults = toolResults.googleSearchResults.map((entry: unknown) => slimToolResultEntry(entry));
  }

  if (Array.isArray(toolResults.twitterSearchResults)) {
    toolResults.twitterSearchResults = toolResults.twitterSearchResults.map((entry: unknown) => slimToolResultEntry(entry));
  }

  if (Array.isArray(toolResults.wan25VideoResults)) {
    toolResults.wan25VideoResults = toolResults.wan25VideoResults.map((entry: unknown) => slimToolResultEntry(entry));
  }

  if (Array.isArray(toolResults.grokVideoResults)) {
    toolResults.grokVideoResults = toolResults.grokVideoResults.map((entry: unknown) => slimToolResultEntry(entry));
  }

  if (Array.isArray(toolResults.videoUpscalerResults)) {
    toolResults.videoUpscalerResults = toolResults.videoUpscalerResults.map((entry: unknown) => slimToolResultEntry(entry));
  }

  if (Array.isArray(toolResults.imageUpscalerResults)) {
    toolResults.imageUpscalerResults = toolResults.imageUpscalerResults.map((entry: unknown) => slimToolResultEntry(entry));
  }

  return toolResults;
}

function slimAttachmentForApi(attachment: unknown): AnyRecord {
  const item = attachment && typeof attachment === 'object' ? (attachment as AnyRecord) : {};
  const slim: AnyRecord = {
    url: item.url,
  };

  if (typeof item.name === 'string') slim.name = item.name;
  if (typeof item.contentType === 'string') slim.contentType = item.contentType;
  if (typeof item.fileType === 'string') slim.fileType = item.fileType;
  if (typeof item.path === 'string') slim.path = item.path;

  if (item.metadata?.estimatedTokens) {
    slim.metadata = { estimatedTokens: item.metadata.estimatedTokens };
  }
  return slim;
}

function slimPartForApi(part: unknown): AnyRecord | null {
  const item = part && typeof part === 'object' ? { ...(part as AnyRecord) } : null;
  if (!item || typeof item.type !== 'string') return item;

  if (item.type === 'data-run_code_complete') {
    return {
      ...item,
      data: slimRunCodePayload(item.data),
    };
  }

  if (item.type === 'tool-run_python_code' && item.output && typeof item.output === 'object') {
    return {
      ...item,
      output: slimRunCodePayload(item.output),
    };
  }

  return item;
}

export function prepareMessagesForAPI(messages: unknown[]): AnyRecord[] {
  if (!Array.isArray(messages)) return [];
  return messages.map((msg) => {
    const message = msg && typeof msg === 'object' ? { ...(msg as AnyRecord) } : {};

    if (Array.isArray(message.parts)) {
      message.parts = message.parts
        .map((part: unknown) => slimPartForApi(part))
        .filter((part: unknown) => part != null);
    }

    if (Array.isArray(message.experimental_attachments)) {
      message.experimental_attachments = message.experimental_attachments.map((attachment: unknown) =>
        slimAttachmentForApi(attachment),
      );
    }

    if (message.tool_results && typeof message.tool_results === 'object') {
      message.tool_results = slimToolResults(message.tool_results);
    }

    if ('annotations' in message) {
      delete message.annotations;
    }

    return message;
  });
}

export function estimatePayloadBytes(payload: unknown): number {
  try {
    const json = JSON.stringify(payload);
    return new TextEncoder().encode(json).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function dropRunCodeDataEvents(messages: AnyRecord[]): AnyRecord[] {
  return messages.map((msg) => {
    if (!Array.isArray(msg.parts)) return msg;
    return {
      ...msg,
      parts: msg.parts.filter((part: AnyRecord) => {
        const type = part?.type;
        return !(typeof type === 'string' && type.startsWith('data-run_code_'));
      }),
    };
  });
}

function keepRecentMessages(messages: AnyRecord[], count: number): AnyRecord[] {
  if (messages.length <= count) return messages;
  return messages.slice(-count);
}

export function trimMessagesToByteLimit(
  messages: unknown[],
  buildPayload: (messagesForPayload: AnyRecord[]) => unknown,
  maxBytes: number,
): { messages: AnyRecord[]; bytes: number; trimmed: boolean } {
  let current = prepareMessagesForAPI(messages);
  let bytes = estimatePayloadBytes(buildPayload(current));
  if (bytes <= maxBytes) {
    return { messages: current, bytes, trimmed: false };
  }

  current = dropRunCodeDataEvents(current);
  bytes = estimatePayloadBytes(buildPayload(current));
  if (bytes <= maxBytes) {
    return { messages: current, bytes, trimmed: true };
  }

  current = keepRecentMessages(current, 40);
  bytes = estimatePayloadBytes(buildPayload(current));
  if (bytes <= maxBytes) {
    return { messages: current, bytes, trimmed: true };
  }

  current = keepRecentMessages(current, 25);
  bytes = estimatePayloadBytes(buildPayload(current));
  return { messages: current, bytes, trimmed: true };
}
