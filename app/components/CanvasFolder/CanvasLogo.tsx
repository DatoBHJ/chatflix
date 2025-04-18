
// Wolfram Alpha logo component
export const WolframAlphaLogo = ({ size = 24, className = "", strokeWidth = 1.5 }: { size?: number, className?: string, strokeWidth?: number }) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className={className}
      >
        {/* Wolfram Alpha's red background square */}
        <rect x="2" y="2" width="20" height="20" rx="2" fill="currentColor" opacity="0.9" />
        
        {/* Wolfram "W" stylized logo in white */}
        <path 
          d="M19.5 7L17.5 17H16L14.5 10L13 17H11.5L9.5 7H11L12.25 15L13.75 7H15.25L16.75 15L18 7H19.5Z" 
          fill="white" 
          stroke="none"
        />
        <path 
          d="M8 7L6 17H4.5L6.5 7H8Z" 
          fill="white" 
          stroke="none"
        />
      </svg>
    );
  };
  
  // Custom X logo component based on the new design
  export const XLogo = ({ size = 24, className = "", strokeWidth = 1.5 }: { size?: number, className?: string, strokeWidth?: number }) => {
    return (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size} 
        height={size} 
        fill="currentColor"
        viewBox="0 0 256 256" 
        className={className}
      >
        <path d="M214.75,211.71l-62.6-98.38,61.77-67.95a8,8,0,0,0-11.84-10.76L143.24,99.34,102.75,35.71A8,8,0,0,0,96,32H48a8,8,0,0,0-6.75,12.3l62.6,98.37-61.77,68a8,8,0,1,0,11.84,10.76l58.84-64.72,40.49,63.63A8,8,0,0,0,160,224h48a8,8,0,0,0,6.75-12.29ZM164.39,208,62.57,48h29L193.43,208Z"></path>
      </svg>
    );
  };
  
  // YouTube logo component
  export const YouTubeLogo = ({ size = 24, className = "", strokeWidth = 1.5 }: { size?: number, className?: string, strokeWidth?: number }) => {
    return (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="currentColor"
        className={className}
        strokeWidth={strokeWidth}
      >
        <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
      </svg>
    );
  };