import React, { useState, useEffect } from 'react';
import WhatsNew, { FeatureUpdate } from './WhatsNew';
import { useLastSeenUpdate } from '../hooks/useLastSeenUpdate';

// Sample updates - in a real app, these could be fetched from an API
const UPDATES: FeatureUpdate[] = [
  {
    id: '(Experimental) pdf-support',
    title: '(Experimental) PDF Support',
    date: 'Not confirmed',
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
    description: '',
    images: [
      '/images/updates/imageg.png',
    ],
    highlights: [
     'Experimental feature for image generation',
    //  'Supports uncensored image generation',
    ],
    instructions: [
     'Start your prompt with /imagine to generate images'
    ]
  },
  {
    id: 'prompt-shortcuts',
    title: 'Custom Prompt Shortcuts',
    date: '14th March 2025',
    description: 'We\'ve added support for custom prompt shortcuts! Now you can create and use your own shortcuts for frequently used prompts. This feature makes it faster and easier to give specific instructions to the AI.',
    images: [
      '/images/updates/shortcut1.png',
      '/images/updates/shortcut2.png',
      '/images/updates/shortcut3.png'
    ],
    highlights: [
      'Create custom shortcuts for frequently used prompts',
      'Access shortcuts quickly using the @ symbol',
      'Customize both shortcut names and prompt contents',
      'Manage your shortcuts through an easy-to-use interface'
    ],
    instructions: [
      'Type @ to access shortcuts',
      'To create a new shortcut, click "CLICK TO CUSTOMIZE SHORTCUTS"',
      'Enter a name and the prompt text for your shortcut',
      'Use your shortcuts by typing @ followed by your shortcut name in the chat'
    ]
  },
];

const WhatsNewContainer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewUpdates, setHasNewUpdates] = useState(false);
  const { lastSeenUpdateId, updateLastSeen, isLoaded } = useLastSeenUpdate();
  
  // Check if there are updates the user hasn't seen
  useEffect(() => {
    if (!isLoaded) return;
    
    if (lastSeenUpdateId) {
      const lastSeenIndex = UPDATES.findIndex(update => update.id === lastSeenUpdateId);
      setHasNewUpdates(lastSeenIndex > 0 || lastSeenIndex === -1);
    } else {
      setHasNewUpdates(UPDATES.length > 0);
    }
  }, [lastSeenUpdateId, isLoaded]);
  
  const handleOpen = () => {
    setIsOpen(true);
    if (UPDATES.length > 0) {
      updateLastSeen(UPDATES[0].id);
      setHasNewUpdates(false);
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
          <span className="absolute top-0 right-0 w-2 h-2 bg-[var(--foreground)] rounded-full"></span>
        )}
      </button>
      
      <WhatsNew 
        isOpen={isOpen} 
        onClose={handleClose} 
        updates={UPDATES} 
      />
    </>
  );
};

export default WhatsNewContainer; 