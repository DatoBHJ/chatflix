import React, { useState, useEffect } from 'react';
import WhatsNew, { FeatureUpdate } from './WhatsNew';
import { useLastSeenUpdate } from '../hooks/useLastSeenUpdate';

// Sample updates - in a real app, these could be fetched from an API
const UPDATES: FeatureUpdate[] = [
  {
    id: 'customer-support-email',
    date: '27th March 2025',
    timestamp: 1774310400000, // 2025-03-27 in ms since epoch
    title: 'Contact Info',
    description: 'Email: sply@chatflix.app'
  },
  // {
  //   id: 'mega-update-v2',
  //   date: '30th March 2025',
  //   timestamp: 1774569600000, // 2025-03-30 in ms since epoch
  //   title: 'MEGA UPDATE INCOMING HANG TIGHT',
  //   description: 'STAY TUNED'
  // },
  {
    id: 'gemini-2-5-pro-high-demand',
    title: "We're experiencing high demand on Gemini 2.5 Pro",
    date: '28th March 2025',
    timestamp: 1774396800000, // 2025-03-28 in ms since epoch
    description: "Gemini 2.5 Pro is currently experiencing high demand. If you're experiencing slow response times, please try again later or switch to a different model."
  },
  {
    id: 'new-model-release-1',
    title: 'New Model: Gemini 2.5 Pro (Mar\' 25)',
    date: '27th March 2025',
    timestamp: 1774224000000, // 2025-03-26 in ms since epoch
    description: 'Google\'s most powerful thinking model. Slower than Flash series but more powerful. Reasoning tokens used in its chain-of-thought process are hidden by Google and not included in the visible output.',
  },
  {
    id: 'new-model-release',
    title: 'New Model: DeepSeek V3 (Mar\' 25)',
    date: '25th March 2025',
    timestamp: 1774051200000, // 2025-03-24 in ms since epoch
    description: 'The best open source non-reasoning model in the world, outscoring Grok3, Claude 3.7 Sonnet and GPT-4.5 in the Artificial Analysis Intelligence Index.',
  },
  {
    id: '(Experimental) pdf-support',
    title: '(Experimental) PDF Support',
    date: 'Not confirmed',
    timestamp: 1771545600000, // 2025-02-24 in ms since epoch
    description: 'We\'ve added support for PDF files! Now you can upload and chat about PDF documents with compatible AI models. This feature allows you to easily reference and analyze PDF content directly in your conversations.',
    images: [
      // '/images/updates/pdf1.png',
      '/images/updates/pdf2.png'    ],
    highlights: [
      'Chat with PDF files',
    ],
    instructions: [
      'Upload a PDF by clicking the attachment icon or dragging and dropping the file',
      'Once uploaded, simply ask questions about the PDF content like "summarize this pdf" or "explain the key points in this document"'
    ]
  },
  // {
  //   id: '(Experimental) pdf-support',
  //   title: '(Experimental) PDF Support',
  //   date: '24th March 2025',
  //   description: 'We\'ve added support for PDF files! Now you can upload and chat about PDF documents with compatible AI models. This feature allows you to easily reference and analyze PDF content directly in your conversations.',
  //   images: [
  //     '/images/updates/pdf1.png',
  //     '/images/updates/pdf2.png'
  //   ],
  //   highlights: [
  //     'Upload PDF files directly in chat via drag-and-drop or attachment button',
  //     'Automatic compatibility check with AI models that support PDF processing',
  //     'Clean PDF document display with file name and type indicators',
  //     'Ask specific questions about PDF content for instant analysis'
  //   ],
  //   instructions: [
  //     'Upload a PDF by clicking the attachment icon or dragging and dropping the file',
  //     'The system will automatically check if your current model supports PDFs',
  //     'If needed, you\'ll be prompted to switch to a compatible model',
  //     'Once uploaded, simply ask questions about the PDF content like "summarize this pdf" or "explain the key points in this document"'
  //   ]
  // },
  {
    id: '(Experimental) Image Generation',
    title: '(Experimental) Image Generation',
    date: 'Not confirmed',
    timestamp: 1771459200000, // 2025-02-23 in ms since epoch
    description: 'We\'ve added support for image generation! Now you can generate images with compatible AI models. This feature allows you to easily generate images directly in your conversations.',
    images: [
      '/images/updates/imageg.png',
    ],
    highlights: [
     'Experimental feature for image generation',
    //  'Supports uncensored image generation',
    ],
    instructions: [
     'Start your prompt with /image to generate images'
    ]
  },
  {
    id: 'prompt-shortcuts',
    title: 'Custom Prompt Shortcuts',
    date: '14th March 2025',
    timestamp: 1771372800000, // 2025-02-22 in ms since epoch
    description: 'We\'ve added support for custom prompt shortcuts! Now you can create and use your own shortcuts for frequently used prompts. This feature makes it faster and easier to give specific instructions to the AI.',
    images: [
      '/images/updates/shortcut1.png',
      '/images/updates/shortcut2.png',
      '/images/updates/shortcut3.png'
    ],
    highlights: [
      'Create custom shortcuts for frequently used prompts',
      // 'Access shortcuts quickly using the @ symbol',
      // 'Customize both shortcut names and prompt contents',
      // 'Manage your shortcuts through an easy-to-use interface'
    ],
    instructions: [
      'Type @ to access shortcuts',
      'To create a new shortcut, click "CLICK TO CUSTOMIZE SHORTCUTS"',
      'Enter a name and the prompt text for your shortcut',
      'Use your shortcuts by typing @ followed by your shortcut name in the chat'
    ]
  },
];

// Sort updates by timestamp (newest first)
const SORTED_UPDATES = [...UPDATES].sort((a, b) => b.timestamp - a.timestamp);

const WhatsNewContainer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewUpdates, setHasNewUpdates] = useState(false);
  const [newUpdatesCount, setNewUpdatesCount] = useState(0);
  const { lastSeenUpdateId, lastSeenTimestamp, updateLastSeen, isLoaded } = useLastSeenUpdate();
  
  // Check if there are updates the user hasn't seen
  useEffect(() => {
    if (!isLoaded) return;

    const checkForNewUpdates = () => {
      if (!lastSeenUpdateId && lastSeenTimestamp === 0) {
        // First time user - all updates are new
        setNewUpdatesCount(SORTED_UPDATES.length);
        setHasNewUpdates(SORTED_UPDATES.length > 0);
        return;
      }

      // Find the last update the user has seen
      const lastSeenUpdate = SORTED_UPDATES.find(update => update.id === lastSeenUpdateId);
      
      if (!lastSeenUpdate) {
        // If the last seen update no longer exists, use timestamp approach
        // Count updates newer than the last seen timestamp
        const newUpdates = SORTED_UPDATES.filter(update => update.timestamp > lastSeenTimestamp);
        setNewUpdatesCount(newUpdates.length);
        setHasNewUpdates(newUpdates.length > 0);
      } else {
        // Count updates with newer timestamps than the last seen
        const newUpdates = SORTED_UPDATES.filter(
          update => update.timestamp > lastSeenUpdate.timestamp
        );
        setNewUpdatesCount(newUpdates.length);
        setHasNewUpdates(newUpdates.length > 0);
      }
    };

    checkForNewUpdates();
  }, [lastSeenUpdateId, lastSeenTimestamp, isLoaded]);
  
  const handleOpen = () => {
    setIsOpen(true);
    
    if (SORTED_UPDATES.length > 0) {
      // Store both the ID and timestamp of the newest update
      const newestUpdate = SORTED_UPDATES[0];
      updateLastSeen(newestUpdate.id, newestUpdate.timestamp);
      
      setHasNewUpdates(false);
      setNewUpdatesCount(0);
    }
  };
  
  const handleClose = () => {
    setIsOpen(false);
  };
  
  return (
    <>
      <button
        onClick={handleOpen}
        className="relative text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        aria-label="What's New"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="18" 
          height="18" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {hasNewUpdates && (
          <span className="absolute -top-2 -right-2 flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[10px] font-semibold bg-[var(--foreground)] text-[var(--background)] rounded-full">
            {newUpdatesCount}
          </span>
        )}
      </button>
      
      <WhatsNew 
        isOpen={isOpen} 
        onClose={handleClose} 
        updates={SORTED_UPDATES} 
      />
    </>
  );
};

export default WhatsNewContainer; 