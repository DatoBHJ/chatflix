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

// 🚀 미디어(이미지/비디오) 전용 lazy loading 훅
// - 화면 근처에서만 로드하여 초기 로딩 속도 최대화
// - 200px rootMargin으로 살짝 미리 로드 시작
export const useLazyMedia = (rootMargin: string = '200px') => {
  // 🚀 기본값을 true로 설정하여 이미지가 즉시 보이도록 함
  const [shouldLoad, setShouldLoad] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // 이미 로드 상태라면 observer 설정 불필요
    if (shouldLoad) return;

    // rootMargin에서 숫자 추출 (예: "200px" -> 200)
    const marginValue = parseInt(rootMargin.replace('px', ''), 10) || 200;

    // 초기 마운트 시 뷰포트에 이미 있는지 체크
    const checkInitialVisibility = () => {
      const rect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      const isInViewport = (
        rect.top < viewportHeight + marginValue &&
        rect.bottom > -marginValue &&
        rect.left < viewportWidth + marginValue &&
        rect.right > -marginValue
      );
      
      return isInViewport;
    };

    let observer: IntersectionObserver | null = null;

    // 초기 체크 (약간의 지연을 두어 DOM이 완전히 렌더링된 후 체크)
    const timeoutId = setTimeout(() => {
      if (checkInitialVisibility()) {
        setShouldLoad(true);
        return;
      }

      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            // 한 번 로드되면 더 이상 관찰 불필요
            if (observer) {
              observer.disconnect();
            }
          }
        },
        {
          threshold: 0,
          rootMargin // 화면 밖 200px에서 미리 로드 시작
        }
      );

      observer.observe(element);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [shouldLoad, rootMargin]);

  return { ref, shouldLoad };
};
