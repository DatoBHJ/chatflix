import { useEffect, useRef, useState } from 'react';

// 🚀 Intersection Observer 훅 - 뷰포트에 들어온 요소만 감지
export const useIntersectionObserver = (
  options: IntersectionObserverInit = {}
) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting;
        setIsIntersecting(isVisible);
        
        // 한 번이라도 뷰포트에 들어왔다면 기록
        if (isVisible && !hasIntersected) {
          setHasIntersected(true);
        }
      },
      {
        threshold: 0.1, // 10% 보이면 감지
        rootMargin: '50px', // 50px 여백으로 미리 감지
        ...options
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [hasIntersected, options]);

  return { ref, isIntersecting, hasIntersected };
};

// 🚀 지연 로딩을 위한 훅
export const useLazyLoad = (delay: number = 100) => {
  const { ref, isIntersecting, hasIntersected } = useIntersectionObserver();
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (isIntersecting && !shouldLoad) {
      // 뷰포트에 들어오면 약간의 지연 후 로딩 시작
      const timeoutId = setTimeout(() => {
        setShouldLoad(true);
      }, delay);

      return () => clearTimeout(timeoutId);
    }
  }, [isIntersecting, shouldLoad, delay]);

  return { ref: ref as React.RefObject<HTMLDivElement>, shouldLoad, hasIntersected };
};
