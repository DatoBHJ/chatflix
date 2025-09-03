import React from 'react';

interface TypingIndicatorProps {
  variant?: 'default' | 'compact' | 'xs';
  className?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ 
  variant = 'default',
  className = ''
}) => {
  const isCompact = variant === 'compact';
  const isXS = variant === 'xs';
  
  let containerClass = 'typing-indicator';
  let dotClass = 'typing-dot';
  
  if (isCompact) {
    containerClass = 'typing-indicator-compact';
    dotClass = 'typing-dot-compact';
  } else if (isXS) {
    containerClass = 'typing-indicator-xs';
    dotClass = 'typing-dot-xs';
  }

  return (
    <div className={`${containerClass} ${className}`}>
      <div className={dotClass}></div>
      <div className={dotClass}></div>
      <div className={dotClass}></div>
    </div>
  );
};
