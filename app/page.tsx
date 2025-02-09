'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()

  const handleStartChat = async () => {
    try {
      // 새 세션 생성
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert([{
          id: Date.now().toString(),
          title: 'New Chat'
        }])
        .select()
        .single();

      if (sessionError) {
        console.error('Failed to create session:', sessionError);
        return;
      }

      if (session) {
        // 새로 생성된 채팅으로 이동
        router.push(`/chat/${session.id}`);
      }
    } catch (error) {
      console.error('Error starting new chat:', error);
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome GOAT</h1>
        {/* <p className="text-lg opacity-70 mb-8">
          Experience intelligent conversations with multiple AI models including DeepSeek and Claude
        </p> */}
        <div className="space-y-4">
          {/* <div className="p-4 border border-[var(--accent)] rounded">
            <h2 className="text-xl font-semibold mb-2">Available Models</h2>
            <ul className="space-y-2">
              <li>🧠 DeepSeek Reasoner - Advanced reasoning capabilities</li>
              <li>💬 DeepSeek Chat - Natural conversation</li>
              <li>🤖 Claude 3.5 Sonnet - Anthropic's latest model</li>
            </ul>
          </div> */}
          <button
            onClick={handleStartChat}
            className="px-6 py-3 bg-[var(--accent)] rounded-lg hover:opacity-80 transition-opacity text-lg font-medium"
          >
            Start New Chat
          </button>
        </div>
      </div>
    </main>
  )
}
