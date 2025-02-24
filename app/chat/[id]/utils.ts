import { DatabaseMessage } from '@/lib/types';
import { ExtendedMessage } from './types';

export const convertMessage = (msg: DatabaseMessage): ExtendedMessage => {
  const baseMessage = {
    id: msg.id,
    content: msg.content,
    role: msg.role as 'user' | 'assistant' | 'system',
    createdAt: new Date(msg.created_at),
    model: msg.model
  };

  if (msg.role === 'assistant' && msg.reasoning) {
    return {
      ...baseMessage,
      parts: [
        {
          type: 'reasoning' as const,
          reasoning: msg.reasoning
        },
        {
          type: 'text' as const,
          text: msg.content
        }
      ]
    };
  }

  return baseMessage;
}; 