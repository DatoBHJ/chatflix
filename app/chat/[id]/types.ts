import { Message } from 'ai';

export interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export interface ExtendedMessage extends Message {
  model?: string;
  isEditing?: boolean;
  sequence_number?: number;
} 