import { UIMessage } from 'ai';

export interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export interface ExtendedMessage extends UIMessage {
  content: any;
  model?: string;
  isEditing?: boolean;
  sequence_number?: number;
  tool_results?: any;
} 