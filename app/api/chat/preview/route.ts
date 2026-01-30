import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const PREVIEW_MAX_LEN = 120;

function getPreviewText(msg: any): string {
  if (!msg) return '';
  if (typeof msg.content === 'string' && msg.content.trim()) return msg.content;
  if (Array.isArray(msg.parts)) {
    const t = msg.parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join(' ')
      .trim();
    if (t) return t;
  }
  if (Array.isArray(msg.content)) {
    const t = msg.content
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join(' ')
      .trim();
    if (t) return t;
  }
  return '';
}

function truncate(s: string): string {
  if (s.length <= PREVIEW_MAX_LEN) return s;
  return s.slice(0, PREVIEW_MAX_LEN) + '…';
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get('chatId');
  const messageId = searchParams.get('messageId');

  if (!chatId) {
    return NextResponse.json(
      { user: null, assistant: null },
      { status: 200 }
    );
  }

  try {
    if (messageId) {
      // Fetch assistant message by id
      const { data: assistantRow, error: assErr } = await supabase
        .from('messages')
        .select('id, content, parts, role, sequence_number, chat_session_id')
        .eq('id', messageId)
        .eq('chat_session_id', chatId)
        .eq('user_id', user.id)
        .single();

      if (assErr || !assistantRow || assistantRow.role !== 'assistant') {
        return NextResponse.json({ user: null, assistant: null }, { status: 200 });
      }

      const seq = assistantRow.sequence_number;

      // Fetch immediately preceding user message
      const { data: userRows } = await supabase
        .from('messages')
        .select('content, parts')
        .eq('chat_session_id', chatId)
        .eq('user_id', user.id)
        .eq('role', 'user')
        .lt('sequence_number', seq)
        .order('sequence_number', { ascending: false })
        .limit(1);

      const userRow = userRows?.[0] ?? null;

      const userText = truncate(getPreviewText(userRow));
      const assistantText = truncate(getPreviewText(assistantRow));

      return NextResponse.json({
        user: userText || null,
        assistant: assistantText || null,
      });
    }

    // No messageId: fetch last 20, find last assistant + preceding user
    const { data: rows } = await supabase
      .from('messages')
      .select('id, content, parts, role, sequence_number')
      .eq('chat_session_id', chatId)
      .eq('user_id', user.id)
      .order('sequence_number', { ascending: false })
      .limit(20);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ user: null, assistant: null }, { status: 200 });
    }

    const lastAssistant = rows.find((r) => r.role === 'assistant');
    if (!lastAssistant) {
      return NextResponse.json({ user: null, assistant: null }, { status: 200 });
    }

    const lastUser = rows.find(
      (r) => r.role === 'user' && r.sequence_number < lastAssistant.sequence_number
    );

    const userText = lastUser ? truncate(getPreviewText(lastUser)) : null;
    const assistantText = truncate(getPreviewText(lastAssistant));

    return NextResponse.json({
      user: userText || null,
      assistant: assistantText || null,
    });
  } catch (e) {
    console.error('[chat/preview]', e);
    return NextResponse.json({ user: null, assistant: null }, { status: 200 });
  }
}
