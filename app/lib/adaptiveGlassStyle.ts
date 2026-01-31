/**
 * Adaptive glass styling utility
 * Provides consistent glass morphism effects that adapt to background brightness
 */

interface AdaptiveGlassStyleOptions {
  isMobile?: boolean;
  isSafari?: boolean;
}

/**
 * Get initial theme state synchronously to prevent flickering
 * @returns boolean indicating if dark theme is active
 */
export function getInitialTheme(): boolean {
  if (typeof window === 'undefined') return false;
  
  const theme = document.documentElement.getAttribute('data-theme');
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  
  // System theme or null
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * 글라스 버튼/입력창용 배경색 + 그림자 (테마 기반, 중앙 관리)
 * - 다크: rgba(0, 0, 0, 0.55) + getAdaptiveGlassStyle과 동일한 inset boxShadow (글라스 하이라이트 유지)
 * - 라이트: rgba(255, 255, 255, 0.75) + 강하고 퍼진 외부 그림자
 * - SSR: transparent, boxShadow none
 */
export function getAdaptiveGlassBackgroundColor(): { backgroundColor: string; boxShadow: string } {
  if (typeof window === 'undefined') {
    return { backgroundColor: 'transparent', boxShadow: 'none' };
  }
  const isDark = getInitialTheme();
  if (isDark) {
    // 다크모드: getAdaptiveGlassStyle(121-132)의 inset boxShadow 유지 (글라스 하이라이트)
    const glassStyle = getAdaptiveGlassStyle({ isMobile: false, isSafari: false });
    return {
      backgroundColor: 'rgba(0, 0, 0, 0.0)',
      boxShadow: glassStyle.boxShadow as string,
    };
  }
  return {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    boxShadow: '0 20px 80px rgba(0, 0, 0, 0.2), 0 40px 160px rgba(0, 0, 0, 0.1)',
  };
}

/**
 * 아바타/아이콘 전용 글라스 스타일 (채팅 메시지 좌측 모델 아이콘)
 * - contain: paint 환경에서 잘리지 않도록 그림자를 아이콘 근처로 한정
 * - 메시지 버블을 가리지 않음
 */
export function getAdaptiveGlassAvatarStyle(): Record<string, string> {
  if (typeof window === 'undefined') {
    return { backgroundColor: 'transparent', boxShadow: 'none' };
  }
  const blurStyle = getAdaptiveGlassStyleBlur();
  const isDark = getInitialTheme();
  const compactShadow = isDark
    ? (blurStyle.boxShadow as string)
    : '0 4px 12px rgba(0, 0, 0, 0.15)';
  const { backgroundColor } = getAdaptiveGlassBackgroundColor();
  return {
    ...blurStyle,
    backgroundColor,
    boxShadow: compactShadow,
  };
}

/**
 * Determine if current route has background image based on pathname
 * @param pathname - Current route pathname
 * @returns boolean indicating if background image should be present
 */
export function hasBackgroundImageByRoute(pathname: string): boolean {
  // Home route always has background image
  if (pathname === '/') {
    return true;
  }
  
  // Chat routes never have background image
  if (pathname.startsWith('/chat/')) {
    return false;
  }
  
  // Photo, Memory pages don't have background images
  if (pathname.startsWith('/photo') || pathname.startsWith('/memory')) {
    return false;
  }
  
  // Other routes default to no background image
  return false;
}

/**
 * Get adaptive glass styling based on background brightness
 * @param options - Styling options including background state
 * @returns CSS style object for glass morphism effect
 */
export function getAdaptiveGlassStyle(options: AdaptiveGlassStyleOptions) {
  const { isMobile = false, isSafari = false } = options;
  
  const useSimpleBlur = isMobile || isSafari;

  // Determine if we need adaptive styling based on background brightness
  // const needsAdaptiveStyling = !isDark && isBackgroundDark;
  
  // if (needsAdaptiveStyling) {
  //   // Dark background + Light mode: Use dark glass with enhanced contrast
  //   return {
  //     // background: 'rgba(0, 0, 0, 0.4)',
  //     backdropFilter: useSimpleBlur ? 'blur(12px)' : 'url(#glass-distortion-dark) blur(2px)',
  //     WebkitBackdropFilter: useSimpleBlur ? 'blur(12px)' : 'url(#glass-distortion-dark) blur(2px)',
  //     border: '1px solid rgba(255, 255, 255, 0.2)',
  //     boxShadow: '0 3px 12px rgba(0, 0, 0, 0.2), 0 6px 25px rgba(0, 0, 0, 0.15), 0 12px 50px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
  //     color: 'rgba(255, 255, 255, 0.9)',
  //   };
  // }

  const blurValue = useSimpleBlur ? 'blur(10px) saturate(140%)' : 'url(#glass-distortion-dark) blur(6px) saturate(140%)';

  return {
    // background shorthand 대신 backgroundImage + backgroundColor 분리
    // → 호출처에서 backgroundColor로 오버라이드할 때 shorthand와 충돌하지 않음
    // backgroundImage: `radial-gradient(circle at 0% 0%, rgba(255, 255, 255, 0.065) 0%, rgba(255, 255, 255, 0.022) 10%, transparent 24%), radial-gradient(circle at 100% 100%, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 10%, transparent 24%)`,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    backdropFilter: blurValue,
    WebkitBackdropFilter: blurValue,
    // border: '1px solid rgba(255, 255, 255, 0.08)',
    // 좌상/우하만 살짝 강조, 나머지는 거의 음영
    boxShadow: `
      inset 1px 1px 0.5px rgba(255, 255, 255, 0.2),
      inset 0px -4px 15px rgba(0, 0, 0, 0.00),
      inset -0.5px -0.5px 4px rgba(255, 255, 255, 0.15),
      0 10px 25px -12px rgba(0, 0, 0, 0.15)
    `,
    // borderRadius: '24px',
    // // overflow: hidden을 추가하여 필터 효과가 영역 밖으로 나가지 않도록 함
    // overflow: 'hidden',
  };
}

/**
 * Get adaptive glass styling with automatic browser detection (blur version for widgets)
 * Automatically detects the device/browser to pick the right blur fallback.
 * @returns CSS style object for glass morphism effect with blur
 */
export function getAdaptiveGlassStyleBlur() {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const isSafari = typeof window !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  
  return getAdaptiveGlassStyle({
    isMobile,
    isSafari
  });
}

/**
 * Get adaptive glass styling with clean blur values (for non-widget components)
 * Uses lighter blur values optimized for app icons and other UI elements
 * @param isBackgroundDark - Whether background is dark
 * @returns CSS style object for clean glass morphism effect
 */
export function getAdaptiveGlassStyleClean(isBackgroundDark: boolean) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const isSafari = typeof window !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const useSimpleBlur = isMobile || isSafari;

  return isBackgroundDark ? {
    // backgroundColor: 'rgba(255, 255, 255, 0.02)',
    backdropFilter: useSimpleBlur ? 'blur(4px)' : 'url(#glass-distortion-dark) blur(0px)',
    WebkitBackdropFilter: useSimpleBlur ? 'blur(4px)' : 'url(#glass-distortion-dark) blur(0px)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 20px rgba(0, 0, 0, 0.05), 0 8px 40px rgba(0, 0, 0, 0.025)',
  } : {
    // backgroundColor: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: useSimpleBlur ? 'blur(4px)' : 'url(#glass-distortion) blur(0px)',
    WebkitBackdropFilter: useSimpleBlur ? 'blur(4px)' : 'url(#glass-distortion) blur(0px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05), 0 4px 20px rgba(0, 0, 0, 0.025), 0 8px 40px rgba(0, 0, 0, 0.012)',
  };
}

/**
 * Get icon className with glass effect based on background image presence
 * White icon when background image exists, theme-based when no background image
 * @param hasBackgroundImage - Whether background image exists
 * @returns className string with text color matching text style
 */
export function getIconClassName(hasBackgroundImage: boolean): string {
  if (hasBackgroundImage) {
    // Background image exists: white icon
    return 'text-white';
  }
  
  // No background image: theme-based icon
  const isDark = getInitialTheme();
  return isDark ? 'text-white' : 'text-black';
}

/**
 * Get text style with glass effect based on background image presence
 * White text when background image exists, theme-based when no background image
 * @param hasBackgroundImage - Whether background image exists
 * @returns CSS style object with text color
 */
export function getTextStyle(hasBackgroundImage: boolean) {
  if (hasBackgroundImage) {
    // Background image exists: use white text
    return {
      color: 'rgba(255, 255, 255)',
    };
  }
  
  // No background image: theme-based text
  const isDark = getInitialTheme();
  return {
    color: isDark ? 'rgba(255, 255, 255)' : 'rgba(0, 0, 0)',
  };
}


