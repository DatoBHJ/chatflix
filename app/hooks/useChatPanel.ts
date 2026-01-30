import { useState, useCallback } from 'react';

type PanelType = 'canvas' | 'structuredResponse' | 'attachment';

interface ActivePanel {
  messageId: string;
  type: PanelType;
  fileIndex?: number;
  toolType?: string;
  fileName?: string;
}

export function useChatPanel() {
  const [activePanel, setActivePanel] = useState<ActivePanel | null>(null);
  const [isPanelMaximized, setIsPanelMaximized] = useState(false);

  const togglePanel = useCallback((
    messageId: string, 
    type: PanelType, 
    fileIndex?: number, 
    toolType?: string, 
    fileName?: string
  ) => {
    setActivePanel(prev => {
      const isSame = prev?.messageId === messageId 
        && prev.type === type 
        && prev.fileIndex === fileIndex 
        && prev.toolType === toolType;
      
      if (isSame) {
        setIsPanelMaximized(false);
        return null;
      }
      return { messageId, type, fileIndex, toolType, fileName };
    });
  }, []);

  const closePanel = useCallback(() => {
    setActivePanel(null);
    setIsPanelMaximized(false);
  }, []);

  return {
    activePanel,
    isPanelMaximized,
    togglePanel,
    closePanel,
    toggleMaximize: useCallback(() => setIsPanelMaximized(p => !p), []),
  };
}

