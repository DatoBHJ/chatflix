import { useState, useEffect, useRef } from 'react';

/**
 * Hook to detect when the mouse has been idle for a specified duration
 * @param idleTime - Time in milliseconds before considering mouse as idle (default: 3000ms)
 * @returns boolean indicating if mouse is currently idle
 */
export function useMouseIdleDetection(idleTime = 3000) {
  const [isIdle, setIsIdle] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleMouseMove = () => {
      setIsIdle(false);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        setIsIdle(true);
      }, idleTime);
    };

    const handleMouseEnter = () => {
      // 마우스가 페이지에 들어왔을 때도 움직임으로 간주
      handleMouseMove();
    };

    // 초기 타이머 설정 - 페이지 로드 시 즉시 시작하지 않도록 지연
    const initialTimer = setTimeout(() => {
      timeoutRef.current = setTimeout(() => {
        setIsIdle(true);
      }, idleTime);
    }, 3000); // 페이지 로드 후 3초 후에 타이머 시작

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      clearTimeout(initialTimer);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [idleTime]);

  return isIdle;
}
