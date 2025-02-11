import { Dispatch, SetStateAction } from 'react';

interface ModelSelectorProps {
  currentModel: string;
  nextModel: string;
  setNextModel: Dispatch<SetStateAction<string>>;
  disabled?: boolean;
}

export function ModelSelector({ currentModel, nextModel, setNextModel, disabled }: ModelSelectorProps) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-xs uppercase tracking-wider text-[var(--muted)]">Model</span>
      <select
        value={nextModel}
        onChange={(e) => setNextModel(e.target.value)}
        className="yeezy-model-selector text-[var(--muted)]"
        disabled={disabled}
      >
        <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet</option>
        <option value="deepseek-reasoner">DeepSeek Reasoner</option>
        <option value="deepseek-chat">DeepSeek Chat</option>
        <option value="deepseek-ai/DeepSeek-R1">DeepSeek R1 (Together)</option>
        <option value="deepseek-ai/DeepSeek-V3">DeepSeek V3 (Together)</option>
        <option value="DeepSeek r1 distill llama 70b">DeepSeek R1 (Groq)</option>
      </select>
    </div>
  );
} 