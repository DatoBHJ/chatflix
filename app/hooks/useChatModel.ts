import { useState, useEffect, useCallback } from 'react';
import { getSystemDefaultModelId, resolveDefaultModelVariantId } from '@/lib/models/config';

export function useChatModel() {
  const [currentModel, setCurrentModel] = useState('');
  const [nextModel, setNextModel] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [rateLimitedLevels, setRateLimitedLevels] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('selectedModel');
      const defaultModel = getSystemDefaultModelId();
      const model = resolveDefaultModelVariantId(stored || defaultModel);
      setCurrentModel(model);
      setNextModel(model);
    } catch {
      const fallback = resolveDefaultModelVariantId(getSystemDefaultModelId());
      setCurrentModel(fallback);
      setNextModel(fallback);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateModel = useCallback((model: string) => {
    setCurrentModel(model);
    setNextModel(model);
    try {
      localStorage.setItem('selectedModel', model);
    } catch {}
  }, []);

  return {
    currentModel,
    nextModel,
    setNextModel,
    updateModel,
    isLoading,
    rateLimitedLevels,
    setRateLimitedLevels,
  };
}

