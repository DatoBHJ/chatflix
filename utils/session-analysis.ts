import { SupabaseClient } from '@supabase/supabase-js';

const MAX_SESSIONS_TO_SCAN = 60;
const MIN_MESSAGES_FOR_LONG_SESSION = 12;
const MAX_MESSAGES_PER_DIGEST = 40;
const MAX_EXCERPT_CHARS = 2500;

type MessageRow = {
  chat_session_id: string | null;
  role: string;
  token_usage?: any;
  content?: string | Record<string, unknown> | null;
  created_at: string;
};

type SessionRow = {
  id: string;
  title?: string | null;
  created_at?: string | null;
  last_activity_at?: string | null;
};

export interface SessionInsight {
  sessionId: string;
  title: string;
  messageCount: number;
  userMessages: number;
  assistantMessages: number;
  durationMinutes: number;
  totalTokens: number;
  score: number;
  startedAt?: string | null;
  endedAt?: string | null;
}

export interface SessionDigest extends SessionInsight {
  conversationExcerpt: string;
}

function extractTokenCount(tokenUsage: any): number {
  if (!tokenUsage) return 0;
  // totalUsage 우선 사용 (usage는 제거됨)
  if (tokenUsage.totalUsage && typeof tokenUsage.totalUsage.totalTokens === 'number') {
    return tokenUsage.totalUsage.totalTokens;
  }
  // 기존 단일 구조 호환성
  if (typeof tokenUsage.totalTokens === 'number') {
    return tokenUsage.totalTokens;
  }
  return 0;
}

function calculateDuration(
  start?: string | null,
  end?: string | null
): number {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  return diffMs > 0 ? diffMs / 60000 : 0;
}

function calculateScore(metrics: {
  messageCount: number;
  durationMinutes: number;
  totalTokens: number;
}): number {
  const messageScore = metrics.messageCount * 0.4;
  const durationScore = metrics.durationMinutes * 0.3;
  const tokenScore = (metrics.totalTokens / 1000) * 0.3;
  return Number((messageScore + durationScore + tokenScore).toFixed(4));
}

function coerceContent(content: MessageRow['content']): string {
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object') {
    try {
      return JSON.stringify(content);
    } catch {
      return '[Unsupported content]';
    }
  }
  return '';
}

function formatTimestamp(isoString?: string | null): string {
  if (!isoString) return '--:--';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function buildConversationExcerpt(messages: MessageRow[]): string {
  if (!messages.length) {
    return 'No conversation data available for this session.';
  }

  const lines = messages.map(msg => {
    const role = msg.role === 'assistant' ? 'Assistant' : 'User';
    const timestamp = formatTimestamp(msg.created_at);
    return `[${timestamp}] ${role}: ${coerceContent(msg.content)}`.trim();
  });

  let excerpt = lines.join('\n');
  if (excerpt.length > MAX_EXCERPT_CHARS) {
    excerpt = excerpt.slice(excerpt.length - MAX_EXCERPT_CHARS);
  }

  return excerpt;
}

export async function getTopLongSessions(
  supabase: SupabaseClient,
  userId: string,
  topK: number = 5
): Promise<SessionInsight[]> {
  try {
    const { data: sessions, error: sessionsError } = await supabase
      .from('chat_sessions')
      .select('id, title, created_at, last_activity_at')
      .eq('user_id', userId)
      .not('last_activity_at', 'is', null)
      .order('last_activity_at', { ascending: false })
      .limit(MAX_SESSIONS_TO_SCAN);

    if (sessionsError) {
      console.error('❌ [SESSION ANALYSIS] Failed to fetch chat sessions:', sessionsError);
      return [];
    }

    if (!sessions || sessions.length === 0) {
      return [];
    }

    const sessionIds = sessions.map(session => session.id).filter(Boolean);

    if (sessionIds.length === 0) {
      return [];
    }

    const { data: messageRows, error: messagesError } = await supabase
      .from('messages')
      .select('chat_session_id, role, token_usage, created_at')
      .eq('user_id', userId)
      .in('chat_session_id', sessionIds as string[]);

    if (messagesError) {
      console.error('❌ [SESSION ANALYSIS] Failed to fetch messages for sessions:', messagesError);
      return [];
    }

    const metricsMap = new Map<string, SessionInsight>();

    sessions.forEach((session: SessionRow) => {
      const durationMinutes = calculateDuration(session.created_at, session.last_activity_at);
      metricsMap.set(session.id, {
        sessionId: session.id,
        title: session.title || 'Untitled Session',
        messageCount: 0,
        userMessages: 0,
        assistantMessages: 0,
        durationMinutes,
        totalTokens: 0,
        score: 0,
        startedAt: session.created_at,
        endedAt: session.last_activity_at
      });
    });

    (messageRows || []).forEach((message: MessageRow) => {
      if (!message.chat_session_id) return;
      const metrics = metricsMap.get(message.chat_session_id);
      if (!metrics) return;

      metrics.messageCount += 1;
      if (message.role === 'user') {
        metrics.userMessages += 1;
      } else if (message.role === 'assistant') {
        metrics.assistantMessages += 1;
      }
      metrics.totalTokens += extractTokenCount(message.token_usage);
    });

    const insights = Array.from(metricsMap.values())
      .filter(metrics => metrics.messageCount >= MIN_MESSAGES_FOR_LONG_SESSION)
      .map(metrics => ({
        ...metrics,
        score: calculateScore(metrics)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return insights;
  } catch (error) {
    console.error('❌ [SESSION ANALYSIS] Unexpected error while ranking sessions:', error);
    return [];
  }
}

export async function getSessionDigest(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  options: {
    messageLimit?: number;
    baseMetrics?: Partial<SessionInsight>;
  } = {}
): Promise<SessionDigest | null> {
  try {
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id, title, created_at, last_activity_at')
      .eq('user_id', userId)
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error(`❌ [SESSION ANALYSIS] Session ${sessionId} not found for user ${userId}:`, sessionError);
      return null;
    }

    const messageLimit = options.messageLimit ?? MAX_MESSAGES_PER_DIGEST;

    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('chat_session_id, role, token_usage, content, created_at')
      .eq('user_id', userId)
      .eq('chat_session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (messagesError) {
      console.error(`❌ [SESSION ANALYSIS] Failed to load messages for session ${sessionId}:`, messagesError);
      return null;
    }

    const totalTokens = (messages || []).reduce((sum, message) => sum + extractTokenCount(message.token_usage), 0);
    const userMessages = (messages || []).filter(msg => msg.role === 'user').length;
    const assistantMessages = (messages || []).filter(msg => msg.role === 'assistant').length;
    const trimmedMessages = (messages || []).slice(-(messageLimit));
    const conversationExcerpt = buildConversationExcerpt(trimmedMessages);
    const messageCount = messages?.length ?? 0;
    const durationMinutes = calculateDuration(session.created_at, session.last_activity_at);

    const digest: SessionDigest = {
      sessionId: session.id,
      title: session.title || 'Untitled Session',
      messageCount,
      userMessages,
      assistantMessages,
      durationMinutes,
      totalTokens,
      score: options.baseMetrics?.score ?? calculateScore({ messageCount, durationMinutes, totalTokens }),
      startedAt: session.created_at,
      endedAt: session.last_activity_at,
      conversationExcerpt
    };

    return digest;
  } catch (error) {
    console.error(`❌ [SESSION ANALYSIS] Failed to build digest for session ${sessionId}:`, error);
    return null;
  }
}

