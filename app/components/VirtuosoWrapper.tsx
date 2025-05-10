import React, { useRef, useEffect, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { Message } from 'ai';

type VirtuosoWrapperProps = {
  messages: Message[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  renderMessage: (message: Message, index: number) => React.ReactNode;
  parentContainerRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
  onScroll?: (info: { scrollTop: number, scrollHeight: number, clientHeight: number }) => void;
};

const VirtuosoWrapper: React.FC<VirtuosoWrapperProps> = ({
  messages,
  messagesEndRef,
  renderMessage,
  parentContainerRef,
  className = '',
  onScroll
}) => {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [height, setHeight] = useState('calc(100vh - 220px)');

  // Calculate appropriate height on mount and window resize
  useEffect(() => {
    const updateHeight = () => {
      const windowHeight = window.innerHeight;
      // Reserve space for header and input area
      const newHeight = windowHeight - 220;
      setHeight(`${newHeight}px`);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (virtuosoRef.current && messages.length > 0) {
      try {
        virtuosoRef.current.scrollToIndex({
          index: messages.length - 1,
          behavior: 'smooth'
        });
      } catch (error) {
        console.error('Error scrolling to bottom:', error);
      }
    }
  }, [messages.length]);

  // Combined event handler for scroll prevention and custom scroll handling
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Prevent events from reaching parent scroller
    e.stopPropagation();
    
    // Call custom onScroll handler if provided
    if (onScroll && e.currentTarget) {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      onScroll({ scrollTop, scrollHeight, clientHeight });
    }
  };

  // Safely check if the parent container exists and is an Element
  const hasValidParent = parentContainerRef?.current instanceof Element;

  // Use try-catch to render with proper fallbacks
  try {
    return (
      <div className={`virtuoso-wrapper ${className}`} onScroll={handleScroll}>
        <Virtuoso
          ref={virtuosoRef}
          data={messages}
          totalCount={messages.length}
          style={{ height }}
          overscan={800}
          initialTopMostItemIndex={messages.length - 1}
          followOutput="auto"
          useWindowScroll={false}
          components={{
            Footer: () => <div ref={messagesEndRef} className="h-px" />
          }}
          // Only include customScrollParent if we have a valid parent
          {...(hasValidParent ? { 
            customScrollParent: parentContainerRef?.current as HTMLElement 
          } : {})}
          computeItemKey={(index) => messages[index].id}
          itemContent={(index) => (
            <div className="virtuoso-item-wrapper">
              {renderMessage(messages[index], index)}
            </div>
          )}
          // Pass the onScroll callback to Virtuoso if provided
          {...(onScroll ? {
            scrollerRef: (element) => {
              if (element && element instanceof HTMLElement) {
                element.addEventListener('scroll', () => {
                  onScroll({
                    scrollTop: element.scrollTop,
                    scrollHeight: element.scrollHeight,
                    clientHeight: element.clientHeight
                  });
                });
              }
            }
          } : {})}
        />
      </div>
    );
  } catch (error) {
    console.error('Error rendering VirtuosoWrapper:', error);
    
    // Fallback to non-virtualized renderer
    return (
      <div 
        className={`virtuoso-wrapper-fallback ${className}`} 
        style={{ height }}
        onScroll={handleScroll}
      >
        {messages.map((message, index) => (
          <div key={message.id || index}>
            {renderMessage(message, index)}
          </div>
        ))}
        <div ref={messagesEndRef} className="h-px" />
      </div>
    );
  }
};

export default VirtuosoWrapper;
