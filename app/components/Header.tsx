'use client'

import { useRouter, usePathname } from 'next/navigation'
import { ThemeToggle } from './ThemeToggle'
import WhatsNewContainer from './WhatsNewContainer'
import { AccountDialog, fetchUserName } from './AccountDialog'
import { SubscriptionDialog } from './SubscriptionDialog'
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link'
import Image from 'next/image'
import { checkSubscriptionClient, clearClientSubscriptionCache } from '@/lib/subscription-client'
import { clearAllSubscriptionCache } from '@/lib/utils'
import { Battery, SquarePencil, Bookmark, Gear } from 'react-ios-icons'
import { FeatureUpdate } from '../types/FeatureUpdate'; // Import FeatureUpdate type
// Remove MarkdownContent import - not needed for simple text display
import { createClient } from '@/utils/supabase/client';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export interface HeaderProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  showBackButton?: boolean;
  user?: any;
  isHovering?: boolean; // Add hover state prop
  handleDeleteAllChats?: () => Promise<void>;
}

export function Header({ isSidebarOpen, toggleSidebar, showBackButton, user, isHovering, handleDeleteAllChats }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  
  // 홈 화면이 아닌지 확인
  const isNotHomePage = pathname !== '/'

  // 🚀 익명 사용자 지원: 익명 사용자 식별
  const isAnonymousUser = user?.isAnonymous || user?.id === 'anonymous';

    const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
    const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(true);
    const [batteryAnimationProgress, setBatteryAnimationProgress] = useState(0);
    const [isBatteryAnimating, setIsBatteryAnimating] = useState(false);
    const [isBatteryPanelOpen, setIsBatteryPanelOpen] = useState(false);
    const [isBatteryPanelVisible, setIsBatteryPanelVisible] = useState(false);
  const [batteryPanelElements, setBatteryPanelElements] = useState({
    background: false,
    content: false
  });
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [isSubscriptionDialogOpen, setIsSubscriptionDialogOpen] = useState(false);
  const [isAccountPanelOpen, setIsAccountPanelOpen] = useState(false);
  const [isAccountPanelVisible, setIsAccountPanelVisible] = useState(false);
  const [accountPanelElements, setAccountPanelElements] = useState({
    background: false,
    content: false
  });
  
  // Image modal state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(-1);
  const [currentUpdateImages, setCurrentUpdateImages] = useState<string[]>([]);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // What's New Panel States
  const [isWhatsNewPanelOpen, setIsWhatsNewPanelOpen] = useState(false);
  const [isWhatsNewPanelVisible, setIsWhatsNewPanelVisible] = useState(false);
  const [whatsNewPanelElements, setWhatsNewPanelElements] = useState({ background: false, content: false });
  const [updates, setUpdates] = useState<FeatureUpdate[]>([]);
  const [isLoadingUpdates, setIsLoadingUpdates] = useState(true);
  const [expandedUpdates, setExpandedUpdates] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  // Get user name
  const [userName, setUserName] = useState('');
  const [isUserNameLoading, setIsUserNameLoading] = useState(true);
  const batteryRef = useRef<HTMLDivElement>(null);
  const batteryRef2 = useRef<HTMLDivElement>(null);
  // Load user name when user changes
  useEffect(() => {
    if (user && !isAnonymousUser) {
      const loadUserName = async () => {
        try {
          const supabase = createClient();
          const name = await fetchUserName(user.id, supabase);
          setUserName(name);
        } catch (error) {
          console.error('Error loading user name:', error);
          setUserName('Account');
        } finally {
          setIsUserNameLoading(false);
        }
      };
      
      loadUserName();
    } else if (isAnonymousUser) {
      setUserName('Guest');
      setIsUserNameLoading(false);
    } else {
      setUserName('Account');
      setIsUserNameLoading(false);
    }
  }, [user, isAnonymousUser]);

  // Mount state for portal rendering
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Disable body scroll when panel is visible and add ESC listener
  useEffect(() => {
    if (isBatteryPanelVisible || isAccountPanelVisible) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsBatteryPanelOpen(false);
          setIsAccountPanelOpen(false);
        }
      };
      window.addEventListener('keydown', onKey);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', onKey);
      };
    }
  }, [isBatteryPanelVisible, isAccountPanelVisible]);

  // Image modal functions
  const handleImageClick = (imageUrl: string, images: string[], index: number) => {
    setSelectedImage(imageUrl);
    setSelectedImageIndex(index);
    setCurrentUpdateImages(images);
    setIsImageModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeImageModal = () => {
    setSelectedImage(null);
    setSelectedImageIndex(-1);
    setCurrentUpdateImages([]);
    setIsImageModalOpen(false);
    document.body.style.overflow = '';
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (currentUpdateImages.length === 0) return;
    
    let newIndex = selectedImageIndex;
    if (direction === 'next') {
      newIndex = (selectedImageIndex + 1) % currentUpdateImages.length;
    } else {
      newIndex = selectedImageIndex === 0 ? currentUpdateImages.length - 1 : selectedImageIndex - 1;
    }
    
    setSelectedImageIndex(newIndex);
    setSelectedImage(currentUpdateImages[newIndex]);
  };

  // Handle keyboard navigation for image modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isImageModalOpen) return;
      
      if (e.key === 'Escape') {
        closeImageModal();
      } else if (e.key === 'ArrowRight') {
        navigateImage('next');
      } else if (e.key === 'ArrowLeft') {
        navigateImage('prev');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isImageModalOpen, selectedImageIndex, currentUpdateImages]);

  // Stage mount/unmount for smooth enter/exit with staggered animation
  useEffect(() => {
    if (isBatteryPanelOpen) {
      // ensure visible when opening
      setIsBatteryPanelVisible(true);
      
      // Staggered sequence - background first, then content (like AccountDialog)
      const timeouts = [
        setTimeout(() => setBatteryPanelElements(prev => ({ ...prev, background: true })), 20),
        setTimeout(() => setBatteryPanelElements(prev => ({ ...prev, content: true })), 300)
      ];
      
      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
      };
    } else if (isBatteryPanelVisible) {
      // closing: reverse sequence
      setBatteryPanelElements({ background: false, content: false });
      const timeoutId = setTimeout(() => setIsBatteryPanelVisible(false), 500);
      return () => clearTimeout(timeoutId);
    }
  }, [isBatteryPanelOpen, isBatteryPanelVisible]);

  const openBatteryPanel = () => {
    setIsBatteryPanelVisible(true);
    // next frame activate enter state
    requestAnimationFrame(() => setIsBatteryPanelOpen(true));
  };

  const closeBatteryPanel = () => {
    setIsBatteryPanelOpen(false);
  };

  // Account panel animation logic
  useEffect(() => {
    if (isAccountPanelOpen) {
      setIsAccountPanelVisible(true);
      
      const timeouts = [
        setTimeout(() => setAccountPanelElements(prev => ({ ...prev, background: true })), 20),
        setTimeout(() => setAccountPanelElements(prev => ({ ...prev, content: true })), 300)
      ];
      
      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
      };
    } else if (isAccountPanelVisible) {
      setAccountPanelElements({ background: false, content: false });
      const timeoutId = setTimeout(() => setIsAccountPanelVisible(false), 500);
      return () => clearTimeout(timeoutId);
    }
  }, [isAccountPanelOpen, isAccountPanelVisible]);

  const openAccountPanel = () => {
    setIsAccountPanelVisible(true);
    requestAnimationFrame(() => setIsAccountPanelOpen(true));
  };

  const closeAccountPanel = () => {
    setIsAccountPanelOpen(false);
  };
  
  // What's New Panel Animation Logic
  const openWhatsNewPanel = () => setIsWhatsNewPanelOpen(true);
  
  const closeWhatsNewPanel = useCallback(() => {
    setIsWhatsNewPanelOpen(false);
  }, []);

  // Accordion functionality
  const toggleUpdate = useCallback((updateId: string) => {
    setExpandedUpdates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(updateId)) {
        newSet.delete(updateId);
      } else {
        newSet.add(updateId);
      }
      return newSet;
    });
  }, []);

  const toggleAllUpdates = useCallback(() => {
    if (allExpanded) {
      setExpandedUpdates(new Set());
      setAllExpanded(false);
    } else {
      setExpandedUpdates(new Set(updates.map(update => update.id)));
      setAllExpanded(true);
    }
  }, [allExpanded, updates]);

  useEffect(() => {
    if (isWhatsNewPanelOpen) {
      document.body.style.overflow = 'hidden';
      setIsWhatsNewPanelVisible(true);
      // Reset accordion state when opening
      setExpandedUpdates(new Set());
      setAllExpanded(false);
      
      const timeouts = [
        setTimeout(() => setWhatsNewPanelElements(prev => ({ ...prev, background: true })), 20),
        setTimeout(() => setWhatsNewPanelElements(prev => ({ ...prev, content: true })), 300)
      ];
      
      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
      };
    } else if (isWhatsNewPanelVisible) {
      document.body.style.overflow = '';
      setWhatsNewPanelElements({ background: false, content: false });
      
      const timer = setTimeout(() => {
        setIsWhatsNewPanelVisible(false);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isWhatsNewPanelOpen, isWhatsNewPanelVisible]);

  // Fetch updates for WhatsNew panel
  useEffect(() => {
    if (isWhatsNewPanelOpen) {
      const fetchUpdates = async () => {
        setIsLoadingUpdates(true);
        const supabase = createClient();
        try {
          const { data, error } = await supabase
            .from('feature_updates')
            .select('*')
            .order('created_at', { ascending: false });
          
          if (error) {
            console.error('Error fetching updates:', error);
            return;
          }

          const formattedUpdates: FeatureUpdate[] = data.map((update: any) => ({
            id: update.id,
            title: update.title,
            description: update.description,
            date: new Date(update.created_at).toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            }),
            timestamp: new Date(update.created_at).getTime(),
            images: update.images || [],
          }));
          
          setUpdates(formattedUpdates);
        } catch (error) {
          console.error('Error in fetchUpdates:', error);
        } finally {
          setIsLoadingUpdates(false);
        }
      };

      fetchUpdates();
    }
  }, [isWhatsNewPanelOpen]);


  // Close panels with ESC key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeBatteryPanel();
        closeAccountPanel();
        closeWhatsNewPanel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeBatteryPanel, closeAccountPanel, closeWhatsNewPanel]);
  
  // 최적화를 위한 캐시 관련 상태
  const lastCheckTimeRef = useRef<number>(0);
  const lastCheckedUserIdRef = useRef<string | null>(null);
  const CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시 (공백 현상을 방지를 위해 단축)
  
  // 인증 사용자에서는 과거 익명 ID를 정리
  useEffect(() => {
    if (!isAnonymousUser) {
      try { localStorage.removeItem('anonymousId'); } catch {}
    }
  }, [isAnonymousUser]);

  
  // 🔧 FIX: 구독 상태 확인 함수 최적화 - 단순화
  const checkSubscriptionStatus = useCallback(async (forceCheck = false) => {
    // 🚀 익명 사용자 지원: 익명 사용자는 Free Plan으로 처리 (캐싱 불필요)
    if (!user?.id || isAnonymousUser) {
      setIsSubscribed(false);
      setIsSubscriptionLoading(false);
      lastCheckedUserIdRef.current = null;
      // 익명 전환 시 남아있을 수 있는 클라이언트 캐시 제거
      try { clearClientSubscriptionCache(); } catch {}
      return;
    }

    const now = Date.now();
    const isSameUser = lastCheckedUserIdRef.current === user.id;

    // 새로운 사용자이거나 첫 로드인 경우에만 로딩 상태 표시
    if (!isSameUser || isSubscribed === null) {
      setIsSubscriptionLoading(true);
    }
    
    try {
      // 서버 캐시(Upstash) 의존. 필요 시 강제 새로고침만 사용
      const has = await checkSubscriptionClient(forceCheck);
      setIsSubscribed(has);
      lastCheckTimeRef.current = now;
      lastCheckedUserIdRef.current = user.id;
    } catch (error) {
      console.error('Failed to check subscription status:', error);
      setIsSubscribed(false);
    } finally {
      setIsSubscriptionLoading(false);
      }
    }, [user?.id, isSubscribed, isAnonymousUser]);
    
    // 배터리 애니메이션 효과 - 로딩 완료 시에만 애니메이션
    useEffect(() => {
      if (!isSubscriptionLoading && isSubscribed !== null) {
        const targetWidth = isSubscribed ? 19 : 7;
        
        // 이미 애니메이션이 완료된 상태라면 바로 표시
        if (batteryAnimationProgress === targetWidth) {
          return;
        }
        
        // 로딩이 완료된 상태라면 애니메이션으로 채우기
        setIsBatteryAnimating(true);
        setBatteryAnimationProgress(0);
        
        // 애니메이션 진행
        const animateBattery = () => {
          const duration = 1200; // 1.2초
          const startTime = Date.now();
          
          const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // easeOutCubic 이징 함수
            const easeOutCubic = 1 - Math.pow(1 - progress, 3);
            const currentWidth = easeOutCubic * targetWidth;
            
            setBatteryAnimationProgress(currentWidth);
            
            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              setIsBatteryAnimating(false);
            }
          };
          
          requestAnimationFrame(animate);
        };
        
        // 약간의 지연 후 애니메이션 시작
        setTimeout(animateBattery, 200);
      }
    }, [isSubscriptionLoading, isSubscribed]);
    
    useEffect(() => {
    // 🚀 익명 사용자 지원: 익명 사용자는 구독 상태 확인 건너뛰기
    if (isAnonymousUser) {
      setIsSubscribed(false);
      setIsSubscriptionLoading(false);
      try { clearClientSubscriptionCache(); } catch {}
      return;
    }
    
    // 첫 로드 시에만 구독 상태 확인
    if (isSubscribed === null) {
      checkSubscriptionStatus();
    }
  }, [checkSubscriptionStatus, isAnonymousUser]); // ✅ P0 FIX: isSubscribed 의존성 제거

  // 백그라운드 새로고침 함수 (로딩 상태 표시 안 함)
  const refreshSubscriptionStatusInBackground = useCallback(async () => {
    // 🚀 익명 사용자 지원: 익명 사용자는 구독 상태 확인 건너뛰기
    if (!user?.id || isAnonymousUser) return;
    
    // 캐시 확인 - 최근에 확인했다면 재확인하지 않음
    const now = Date.now();
    const isCacheValid = now - lastCheckTimeRef.current < CACHE_DURATION;
    const isSameUser = lastCheckedUserIdRef.current === user.id;
    
    // ✅ P0 FIX: isSubscribed 상태 의존성 제거로 무한 루프 방지
    if (isCacheValid && isSameUser) {
      return;
    }
    
    try {
      // 서버측 캐시만 신뢰, 강제 새로고침으로 최신화
      const has = await checkSubscriptionClient(true);
      setIsSubscribed(has);
      lastCheckTimeRef.current = now;
      lastCheckedUserIdRef.current = user.id;
    } catch (error) {
      console.error('Header: Error refreshing subscription status:', error);
      setIsSubscribed(false);
    }
  }, [user?.id, isAnonymousUser]); // ✅ P0 FIX: isSubscribed 의존성 제거

  useEffect(() => {
    const handleVisibilityChange = () => {
      // 🚀 익명 사용자 지원: 익명 사용자는 구독 상태 확인 건너뛰기
      if (!document.hidden && user?.id && !isAnonymousUser) {
        // 캐시가 유효한 경우 재확인하지 않음
        const now = Date.now();
        const isCacheValid = now - lastCheckTimeRef.current < CACHE_DURATION;
        const isSameUser = lastCheckedUserIdRef.current === user.id;
        
        // ✅ P0 FIX: isSubscribed 상태 체크 제거로 안정성 증대
        if (isCacheValid && isSameUser) {
          return;
        }
        
        refreshSubscriptionStatusInBackground();
      }
    };

    // 🔧 FIX: 구독 성공 이벤트 리스너 - 강제 새로고침만 수행
    const handleSubscriptionSuccess = () => {
      if (isAnonymousUser) return;
      checkSubscriptionStatus(true); // 강제 재확인
    };

    // 🔧 FIX: 주기적 구독 상태 확인 (웹훅 지연 대응)
    const periodicCheck = () => {
      if (user?.id && !isAnonymousUser && !document.hidden) {
        const now = Date.now();
        const isCacheValid = now - lastCheckTimeRef.current < CACHE_DURATION;
        const isSameUser = lastCheckedUserIdRef.current === user.id;
        
        if (!isCacheValid || !isSameUser) {
          refreshSubscriptionStatusInBackground();
        }
      }
    };

    // 5분마다 구독 상태 확인
    const intervalId = setInterval(periodicCheck, 5 * 60 * 1000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('subscriptionSuccess', handleSubscriptionSuccess);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('subscriptionSuccess', handleSubscriptionSuccess);
      clearInterval(intervalId);
    };
  }, [user?.id, refreshSubscriptionStatusInBackground, checkSubscriptionStatus, isAnonymousUser]); // ✅ P0 FIX: isSubscribed 의존성 제거로 무한 루프 방지


  return (<>
    <header 
      className={`fixed top-0 right-0 left-0 z-30 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        isHovering || isSidebarOpen 
          ? 'bg-transparent' 
          : 'bg-[var(--accent)] dark:bg-[var(--sidebar-dark)]'
          // : 'bg-[var(--accent)] dark:bg-[var(--sidebar-dark)]'
      }`}
    >
      <div className="flex justify-between items-center py-1.5 sm:py-1 md:py-0.5 pl-10 sm:pl-4 pr-5 h-10 md:h-8">
        <div className="flex items-center gap-2 md:gap-1.5 relative">
          {showBackButton && (
            <button
              onClick={() => router.back()}
              className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
              title="Go back"
            >
              <svg className="w-4 h-4 md:w-3.5 md:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          
          <div className={`flex items-center transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            (isHovering || isSidebarOpen) ? 'ml-0 sm:ml-[80px]' : 'ml-1 sm:ml-4'
          }`}>
             {/* CHATFLIX 로고 - 홈으로 이동 */}
             {/* <Link href="/" className="text-sm px-2 py-0.5 rounded-md bg-[var(--muted)]/10 text-[var(--muted)] font-base tracking-wide select-none hover:bg-[var(--muted)]/20 transition-colors">
              Chatflix
              </Link> */}
          </div>
        </div>

        <div className="flex items-center gap-1.5 md:gap-[0.6rem]">
          {/* Sign In Button for Anonymous Users */}
          
          {/* Account Icon */}
          <div 
            className="flex items-center justify-center cursor-pointer"
            onClick={openAccountPanel}
          >
            <svg className="w-6.5 h-6.5 md:w-5.5 md:h-5.5 text-[var(--foreground)]" viewBox="0 0 16 25" fill="none">
                 <g id="person.crop.circle_compact">
                   <rect id="box_" width="16" height="25" fill="none"></rect>
                   <path id="art_" d="M15.09,12.5a7.1,7.1,0,1,1-7.1-7.1A7.1077,7.1077,0,0,1,15.09,12.5ZM7.99,6.6a5.89,5.89,0,0,0-4.4609,9.7471c.6069-.9658,2.48-1.6787,4.4609-1.6787s3.8545.7129,4.4615,1.6787A5.89,5.89,0,0,0,7.99,6.6ZM7.99,8.4A2.5425,2.5425,0,0,0,5.5151,11,2.5425,2.5425,0,0,0,7.99,13.6,2.5424,2.5424,0,0,0,10.4653,11,2.5424,2.5424,0,0,0,7.99,8.4Z" fill="currentColor"></path>
                 </g>
               </svg>
          </div>
          
          {/* Pro/Free Status - moved next to notification */}
          <div className="flex items-center justify-center">
            <div className="flex items-center justify-center relative">
              {isAnonymousUser ? (
                <>
                  {/* Decorative Battery for Anonymous Users */}
                  <div 
                    ref={batteryRef}
                    className="flex items-center justify-center relative group cursor-pointer"
                    onClick={openBatteryPanel}
                  >
                     <svg 
                       className={`w-8 h-9 text-[var(--foreground)] transition-all duration-500 ease-out ${
                         isBatteryAnimating ? 'scale-105 drop-shadow-lg' : 'scale-100'
                       }`} 
                       viewBox="0 0 35 30" 
                       fill="none" 
                     >
                       {/* Battery Body */}
                       <rect 
                         x="9" 
                         y="9" 
                         width="22" 
                         height="11" 
                         rx="2.2" 
                         fill="none" 
                         stroke="currentColor" 
                         strokeWidth="1.2"
                       />
                       {/* Battery Terminal */}
                       <polygon 
                         points="33,12.5 33.3,15 33,17.5" 
                         fill="none" 
                         stroke="currentColor" 
                         strokeWidth="1.2"
                       />
                       <rect 
                         x="10.5" 
                         y="10.5" 
                         rx="1.2" 
                         height="8" 
                         width={isSubscriptionLoading ? 0 : (isBatteryAnimating ? batteryAnimationProgress : 2.5)} 
                         fill={isSubscriptionLoading ? "transparent" : "currentColor"}
                         className="transition-all duration-75 ease-out"
                       />
                     </svg>
                     
                   </div>
                </>
              ) : (
                <>
                  {/* iPhone Battery Icon from react-ios-icons */}
                  <div 
                    ref={batteryRef2}
                    className="relative flex items-center justify-center cursor-pointer group"
                    onClick={openBatteryPanel}
                  >
                     <svg 
                       className={`w-8 h-9 text-[var(--foreground)] transition-all duration-500 ease-out cursor-pointer ${
                         isBatteryAnimating ? 'scale-105 drop-shadow-lg' : 'scale-100'
                       }`}
                       viewBox="0 0 35 30" 
                       fill="none" 
                     >
                       {/* Battery Body */}
                       <rect 
                         x="9" 
                         y="9" 
                         width="22" 
                         height="11" 
                         rx="2.2" 
                         fill="none" 
                         stroke="currentColor" 
                         strokeWidth="1.2"
                       />
                       {/* Battery Terminal */}
                       <polygon 
                         points="33,12.5 33.3,15 33,17.5" 
                         fill="none" 
                         stroke="currentColor" 
                         strokeWidth="1.2"
                       />
                       <rect 
                         x="10.5" 
                         y="10.5" 
                         rx="1.2" 
                         height="8" 
                         width={isSubscriptionLoading ? 0 : (isBatteryAnimating ? batteryAnimationProgress : (isSubscribed ? 19 : 7))} 
                         fill={isSubscriptionLoading ? "transparent" : "currentColor"}
                         className="transition-all duration-75 ease-out"
                       />
                     </svg>
                     
                   </div>
                </>
              )}
            </div>
          </div>
          
          <WhatsNewContainer openPanel={openWhatsNewPanel} />
          <ThemeToggle />
        </div>
      </div>
    </header>
    
    {isBatteryPanelVisible && (
      <div className={`fixed inset-0 z-[70] text-[var(--foreground)] pointer-events-auto transition-all duration-500 ease-out ${
        batteryPanelElements.background ? 'opacity-100' : 'opacity-0'
      }`}
        style={{ backgroundColor: 'var(--accent)' }}
      >
        <div className="absolute inset-0" onClick={closeBatteryPanel} />
        <div 
          className={`relative h-full w-full flex flex-col transform-gpu transition-all duration-400 ease-out ${
            batteryPanelElements.content ? 'opacity-100 translate-y-0 scale-y-100' : 'opacity-0 -translate-y-4 scale-y-[0.95]'
          }`} 
          style={{ transformOrigin: 'top center' }}
        >
          <button
            aria-label="Close"
            className="absolute top-3 right-3 p-2 rounded-full z-10 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              closeBatteryPanel();
            }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className={`px-12 sm:px-16 md:px-20 lg:px-28 pt-12 sm:pt-30 pb-8 transform-gpu transition-all duration-400 ease-out ${
            batteryPanelElements.content ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'
          }`}>
            <h2 className="text-3xl sm:text-3xl md:text-4xl font-semibold tracking-tight pl-0.5">{isAnonymousUser ? 'Guest Mode' : isSubscribed ? 'Pro' : 'Free'}</h2>
            {isAnonymousUser && (
              <p className="mt-6 text-sm text-[var(--muted)] pl-1">
                <button 
                  onClick={() => router.push('/login')}
                  className="text-blue-500 underline cursor-pointer"
                >
                  Sign in
                </button> to view your subscription and billing details
              </p>
            )}
            <div className={`mt-10 text-base text-[var(--muted)] transform-gpu transition-all duration-400 ease-out ${
              batteryPanelElements.content ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
            }`}>
              <div className="mb-5 text-base font-normal text-[var(--muted)] pl-1">Subscription</div>
              <div className="space-y-3">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSubscriptionDialogOpen(true);
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <svg className="w-6 h-6" viewBox="0 0 16 25" fill="none">
                    <g id="creditcard_compact">
                      <rect id="box_" width="16" height="25" fill="none"></rect>
                      <path id="art_" d="M14.5,6.5h-13A1.5,1.5,0,0,0,0,8v9a1.5,1.5,0,0,0,1.5,1.5h13A1.5,1.5,0,0,0,16,17V8A1.5,1.5,0,0,0,14.5,6.5ZM1.5,8h13v2h-13Zm0,9V11.5h13V17Z" fill="currentColor"></path>
                    </g>
                  </svg>
                  <span className="text-base font-semibold text-[var(--foreground)]">{isSubscribed ? 'Your Plan' : 'Plan'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    
    {/* Account Panel */}
    {isAccountPanelVisible && !isUserNameLoading && (
      <div className={`fixed inset-0 z-[70] text-[var(--foreground)] pointer-events-auto transition-all duration-500 ease-out ${
        accountPanelElements.background ? 'opacity-100' : 'opacity-0'
      }`}
        style={{ backgroundColor: 'var(--accent)' }}
      >
        <div className="absolute inset-0" onClick={closeAccountPanel} />
        <div 
          className={`relative h-full w-full flex flex-col transform-gpu transition-all duration-400 ease-out ${
            accountPanelElements.content ? 'opacity-100 translate-y-0 scale-y-100' : 'opacity-0 -translate-y-4 scale-y-[0.95]'
          }`} 
          style={{ transformOrigin: 'top center' }}
        >
          <button
            aria-label="Close"
            className="absolute top-3 right-3 p-2 rounded-full z-10 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              closeAccountPanel();
            }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className={`px-12 sm:px-16 md:px-20 lg:px-28 pt-12 sm:pt-30 pb-8 transform-gpu transition-all duration-400 ease-out ${
            accountPanelElements.content ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'
          }`}>
            <h2 className="text-3xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
              {!isUserNameLoading && userName}
            </h2>
            {isAnonymousUser && (
              <p className="mt-6 text-sm text-[var(--muted)] pl-1">
                <button 
                  onClick={() => router.push('/login')}
                  className="text-blue-500 underline cursor-pointer"
                >
                  Sign in
                </button> to access your bookmarks and account settings
              </p>
            )}
            <div className={`mt-10 text-base text-[var(--muted)] transform-gpu transition-all duration-400 ease-out ${
              accountPanelElements.content ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
            }`}>
              <div className="mb-5 text-base font-normal text-[var(--muted)] pl-1.5">My Profile</div>
              <div className="space-y-3">
                {isAnonymousUser ? (
                  <>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push('/login');
                      }}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Bookmark className="w-6 h-6" />
                      <span className="text-base font-semibold text-[var(--foreground)]">Bookmarks</span>
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push('/login');
                      }}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                        <svg className="w-6 h-6" viewBox="0 0 16 25" fill="none">
                          <g id="gear_compact">
                            <rect id="box_" width="16" height="25" fill="none"></rect>
                            <path id="art_" d="M15.6094,12.3252a.5142.5142,0,0,0-.2959-.2959l-.5972-.2324a6.6665,6.6665,0,0,0-.16-.917l.4809-.42a.5172.5172,0,0,0-.3291-.9073l-.6372-.0136c-.0654-.1377-.1343-.2784-.2139-.4151s-.1635-.2636-.2519-.3935l.3076-.5576a.517.517,0,0,0-.62-.7393l-.6035.2051a6.68,6.68,0,0,0-.7134-.5977l.0986-.6328a.5172.5172,0,0,0-.43-.5918.54.54,0,0,0-.4052.1084l-.5015.4033A6.911,6.911,0,0,0,9.87,6.01l-.124-.6328a.5178.5178,0,0,0-.9512-.167l-.333.5507a7.2576,7.2576,0,0,0-.92.0039L7.2056,5.207a.518.518,0,0,0-.9512.167l-.125.6377a6.6192,6.6192,0,0,0-.8652.31l-.501-.4063a.5176.5176,0,0,0-.8364.4834l.0991.6358a6.6073,6.6073,0,0,0-.7017.5947L2.71,7.417a.5173.5173,0,0,0-.6211.7392l.3134.5694a6.7192,6.7192,0,0,0-.4653.7959l-.6421.0117a.516.516,0,0,0-.5083.5264.52.52,0,0,0,.1763.38l.4849.4238a6.8261,6.8261,0,0,0-.16.9111l-.6006.23a.5176.5176,0,0,0-.001.9658l.5972.2324a6.6665,6.6665,0,0,0,.16.917l-.4809.419a.5184.5184,0,0,0-.05.7314.52.52,0,0,0,.3789.1758l.6367.0137c.063.1318.1333.2754.2144.416.0673.1172.143.2246.2163.3281l.04.0566-.312.5664a.5176.5176,0,0,0,.2036.7032.52.52,0,0,0,.416.0361l.5967-.2031a6.82,6.82,0,0,0,.7207.5937l-.0991.6348a.5153.5153,0,0,0,.0933.3857.5187.5187,0,0,0,.7421.0977l.5064-.4082a6.6137,6.6137,0,0,0,.8628.3193l.1245.6358a.5139.5139,0,0,0,.22.33.53.53,0,0,0,.3877.0782.5193.5193,0,0,0,.3433-.24l.3388-.56.0577.0049a4.8076,4.8076,0,0,0,.7871.0019l.0669-.0058.3383.5625a.518.518,0,0,0,.9512-.167l.1245-.6348a6.6152,6.6152,0,0,0,.8589-.3193l.5088.4131a.5176.5176,0,0,0,.8364-.4834l-.0991-.6358a6.6173,6.6173,0,0,0,.7017-.5947l.6142.2119a.5174.5174,0,0,0,.6211-.7392l-.3135-.5694a6.6548,6.6548,0,0,0,.4649-.7959l.6421-.0117a.5168.5168,0,0,0,.5088-.5264.5166.5166,0,0,0-.1768-.38l-.4849-.4238a6.6694,6.6694,0,0,0,.16-.9111l.6006-.2315a.5177.5177,0,0,0,.2969-.6689ZM6.4941,13.9043,4.7666,16.8926a5.4449,5.4449,0,0,1,.0044-8.792L6.5,11.0986A2.0525,2.0525,0,0,0,6.4941,13.9043Zm2.1646-1.7822a.7608.7608,0,1,1-.4609-.3555A.7543.7543,0,0,1,8.6587,12.1221ZM7.54,10.499,5.8154,7.5068A5.4579,5.4579,0,0,1,7.9907,7.041h.0239a5.4693,5.4693,0,0,1,5.4068,4.8633l-3.457-.0029a2.0363,2.0363,0,0,0-.18-.43A2.0586,2.0586,0,0,0,7.54,10.499Zm-.0058,4.0049a2.0556,2.0556,0,0,0,2.435-1.4023l3.4512.0029a5.4455,5.4455,0,0,1-7.6147,4.3877Z" fill="currentColor"></path>
                          </g>
                        </svg>
                      <span className="text-base font-semibold text-[var(--foreground)]">Account</span>
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push('/login');
                      }}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                        <svg className="w-6 h-6" viewBox="0 0 16 25" fill="none">
                          <g id="person.crop.circle_compact">
                            <rect id="box_" width="16" height="25" fill="none"></rect>
                            <path id="art_" d="M15.09,12.5a7.1,7.1,0,1,1-7.1-7.1A7.1077,7.1077,0,0,1,15.09,12.5ZM7.99,6.6a5.89,5.89,0,0,0-4.4609,9.7471c.6069-.9658,2.48-1.6787,4.4609-1.6787s3.8545.7129,4.4615,1.6787A5.89,5.89,0,0,0,7.99,6.6ZM7.99,8.4A2.5425,2.5425,0,0,0,5.5151,11,2.5425,2.5425,0,0,0,7.99,13.6,2.5424,2.5424,0,0,0,10.4653,11,2.5424,2.5424,0,0,0,7.99,8.4Z" fill="currentColor"></path>
                          </g>
                        </svg>
                      <span className="text-base font-semibold text-[var(--foreground)]">Sign in</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push('/bookmarks');
                        closeAccountPanel();
                      }}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Bookmark className="w-6 h-6" />
                      <span className="text-base font-semibold text-[var(--foreground)]">Bookmarks</span>
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsAccountDialogOpen(true);
                      }}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                        <svg className="w-6 h-6" viewBox="0 0 16 25" fill="none">
                          <g id="gear_compact">
                            <rect id="box_" width="16" height="25" fill="none"></rect>
                            <path id="art_" d="M15.6094,12.3252a.5142.5142,0,0,0-.2959-.2959l-.5972-.2324a6.6665,6.6665,0,0,0-.16-.917l.4809-.42a.5172.5172,0,0,0-.3291-.9073l-.6372-.0136c-.0654-.1377-.1343-.2784-.2139-.4151s-.1635-.2636-.2519-.3935l.3076-.5576a.517.517,0,0,0-.62-.7393l-.6035.2051a6.68,6.68,0,0,0-.7134-.5977l.0986-.6328a.5172.5172,0,0,0-.43-.5918.54.54,0,0,0-.4052.1084l-.5015.4033A6.911,6.911,0,0,0,9.87,6.01l-.124-.6328a.5178.5178,0,0,0-.9512-.167l-.333.5507a7.2576,7.2576,0,0,0-.92.0039L7.2056,5.207a.518.518,0,0,0-.9512.167l-.125.6377a6.6192,6.6192,0,0,0-.8652.31l-.501-.4063a.5176.5176,0,0,0-.8364.4834l.0991.6358a6.6073,6.6073,0,0,0-.7017.5947L2.71,7.417a.5173.5173,0,0,0-.6211.7392l.3134.5694a6.7192,6.7192,0,0,0-.4653.7959l-.6421.0117a.516.516,0,0,0-.5083.5264.52.52,0,0,0,.1763.38l.4849.4238a6.8261,6.8261,0,0,0-.16.9111l-.6006.23a.5176.5176,0,0,0-.001.9658l.5972.2324a6.6665,6.6665,0,0,0,.16.917l-.4809.419a.5184.5184,0,0,0-.05.7314.52.52,0,0,0,.3789.1758l.6367.0137c.063.1318.1333.2754.2144.416.0673.1172.143.2246.2163.3281l.04.0566-.312.5664a.5176.5176,0,0,0,.2036.7032.52.52,0,0,0,.416.0361l.5967-.2031a6.82,6.82,0,0,0,.7207.5937l-.0991.6348a.5153.5153,0,0,0,.0933.3857.5187.5187,0,0,0,.7421.0977l.5064-.4082a6.6137,6.6137,0,0,0,.8628.3193l.1245.6358a.5139.5139,0,0,0,.22.33.53.53,0,0,0,.3877.0782.5193.5193,0,0,0,.3433-.24l.3388-.56.0577.0049a4.8076,4.8076,0,0,0,.7871.0019l.0669-.0058.3383.5625a.518.518,0,0,0,.9512-.167l.1245-.6348a6.6152,6.6152,0,0,0,.8589-.3193l.5088.4131a.5176.5176,0,0,0,.8364-.4834l-.0991-.6358a6.6173,6.6173,0,0,0,.7017-.5947l.6142.2119a.5174.5174,0,0,0,.6211-.7392l-.3135-.5694a6.6548,6.6548,0,0,0,.4649-.7959l.6421-.0117a.5168.5168,0,0,0,.5088-.5264.5166.5166,0,0,0-.1768-.38l-.4849-.4238a6.6694,6.6694,0,0,0,.16-.9111l.6006-.2315a.5177.5177,0,0,0,.2969-.6689ZM6.4941,13.9043,4.7666,16.8926a5.4449,5.4449,0,0,1,.0044-8.792L6.5,11.0986A2.0525,2.0525,0,0,0,6.4941,13.9043Zm2.1646-1.7822a.7608.7608,0,1,1-.4609-.3555A.7543.7543,0,0,1,8.6587,12.1221ZM7.54,10.499,5.8154,7.5068A5.4579,5.4579,0,0,1,7.9907,7.041h.0239a5.4693,5.4693,0,0,1,5.4068,4.8633l-3.457-.0029a2.0363,2.0363,0,0,0-.18-.43A2.0586,2.0586,0,0,0,7.54,10.499Zm-.0058,4.0049a2.0556,2.0556,0,0,0,2.435-1.4023l3.4512.0029a5.4455,5.4455,0,0,1-7.6147,4.3877Z" fill="currentColor"></path>
                          </g>
                        </svg>
                      <span className="text-base font-semibold text-[var(--foreground)]">Account</span>
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        // 로그아웃 기능 (사이드바 참고)
                        if (typeof window !== 'undefined') {
                          // Supabase 로그아웃
                          import('@/utils/supabase/client').then(({ createClient }) => {
                            const supabase = createClient();
                            supabase.auth.signOut().then(() => {
                              window.location.href = '/login';
                            });
                          });
                        }
                      }}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                        <svg className="w-6 h-6" viewBox="0 0 16 25" fill="none">
                          <g id="person.crop.circle_compact">
                            <rect id="box_" width="16" height="25" fill="none"></rect>
                            <path id="art_" d="M15.09,12.5a7.1,7.1,0,1,1-7.1-7.1A7.1077,7.1077,0,0,1,15.09,12.5ZM7.99,6.6a5.89,5.89,0,0,0-4.4609,9.7471c.6069-.9658,2.48-1.6787,4.4609-1.6787s3.8545.7129,4.4615,1.6787A5.89,5.89,0,0,0,7.99,6.6ZM7.99,8.4A2.5425,2.5425,0,0,0,5.5151,11,2.5425,2.5425,0,0,0,7.99,13.6,2.5424,2.5424,0,0,0,10.4653,11,2.5424,2.5424,0,0,0,7.99,8.4Z" fill="currentColor"></path>
                          </g>
                        </svg>
                      <span className="text-base font-semibold text-[var(--foreground)]">Log Out</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    
    {/* What's New Panel */}
    {isWhatsNewPanelVisible && (
      <div className={`fixed inset-0 z-[70] text-[var(--foreground)] pointer-events-auto transition-all duration-500 ease-out ${
        whatsNewPanelElements.background ? 'opacity-100' : 'opacity-0'
      }`}
        style={{ backgroundColor: 'var(--accent)' }}
      >
        <div className="absolute inset-0" onClick={closeWhatsNewPanel} />
        <div 
          className={`relative h-full w-full flex flex-col transform-gpu transition-all duration-400 ease-out ${
            whatsNewPanelElements.content ? 'opacity-100 translate-y-0 scale-y-100' : 'opacity-0 -translate-y-4 scale-y-[0.95]'
          }`} 
          style={{ transformOrigin: 'top center' }}
        >
          <button
            aria-label="Close"
            className="absolute top-3 right-3 p-2 rounded-full z-10 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              closeWhatsNewPanel();
            }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className={`flex-grow overflow-y-auto px-12 sm:px-16 md:px-20 lg:px-28 pt-12 sm:pt-30 pb-8 transform-gpu transition-all duration-400 ease-out ${
            whatsNewPanelElements.content ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'
          }`}>
            <h2 className="text-3xl sm:text-3xl md:text-4xl font-semibold tracking-tight">What's New</h2>
            
            <div className={`sm:mt-20 mt-10 text-base text-[var(--muted)] transform-gpu transition-all duration-400 ease-out pl-1.5 ${
              whatsNewPanelElements.content ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
            }`}>
              {isLoadingUpdates ? (
                <div className="flex justify-center items-center h-64">
                  <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <>
                  {/* Section Header with Toggle Button */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="text-base font-normal text-[var(--muted)] pl-0">Latest Updates</div>
                    {updates.length > 0 && (
                      <button
                        onClick={toggleAllUpdates}
                        className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer pr-1"
                      >
                        {allExpanded ? 'Collapse All' : 'Expand All'}
                      </button>
                    )}
                  </div>
                  
                  <div className="border-t border-[var(--subtle-divider)]">
                    {updates.map((update, index) => {
                      const isExpanded = expandedUpdates.has(update.id);
                      return (
                        <div key={update.id} className="border-b border-[var(--subtle-divider)] last:border-b-0">
                          <button
                            onClick={() => toggleUpdate(update.id)}
                            className="w-full text-left py-4 group cursor-pointer"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <span className="text-base font-semibold text-[var(--foreground)] group-hover:text-[var(--muted)] transition-colors">
                                  {update.title}
                                </span>
                                <p className="text-xs text-[var(--muted)] font-light mt-0.5">
                                  {update.date}
                                </p>
                              </div>
                            </div>
                          </button>
                          
                          {/* Expanded Content */}
                          <div className={`overflow-hidden transition-all duration-500 ease-out ${
                            isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                          }`}>
                            <div className="pb-6 pt-2">
                              {/* Description */}
                              <div className="text-[var(--foreground)]/80 whitespace-pre-wrap leading-relaxed mb-6">
                                {update.description}
                              </div>
                              
                              {/* Images */}
                              {update.images && update.images.length > 0 && (
                                <div className="space-y-4">
                                  {update.images.length === 1 ? (
                                    <div 
                                      className="rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => handleImageClick(update.images![0], update.images!, 0)}
                                    >
                                      <Image 
                                        src={update.images[0]}
                                        alt={update.title}
                                        width={800}
                                        height={400}
                                        className="w-full h-auto object-cover"
                                      />
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      {update.images.map((img, i) => (
                                        <div 
                                          key={i} 
                                          className="rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                          onClick={() => handleImageClick(img, update.images!, i)}
                                        >
                                          <Image 
                                            src={img}
                                            alt={`${update.title} image ${i+1}`}
                                            width={400}
                                            height={300}
                                            className="w-full h-auto object-cover"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
    
    {/* Account Dialog */}
    <AccountDialog
      user={user}
      isOpen={isAccountDialogOpen}
      onClose={() => setIsAccountDialogOpen(false)}
      handleDeleteAllChats={handleDeleteAllChats}
    />
    
    {/* Subscription Dialog */}
    <SubscriptionDialog
      user={user}
      isOpen={isSubscriptionDialogOpen}
      onClose={() => setIsSubscriptionDialogOpen(false)}
    />
    
    {/* Image Modal */}
    {isMounted && isImageModalOpen && selectedImage && createPortal(
      <div 
        className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center" 
        onClick={closeImageModal}
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          width: '100vw', 
          height: '100vh',
          margin: 0,
          padding: 0
        }}
      >
        {/* Close button */}
        <button
          onClick={closeImageModal}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
        
        {/* Navigation buttons */}
        {currentUpdateImages.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigateImage('prev');
              }}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigateImage('next');
              }}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </>
        )}
        
        {/* Image counter */}
        {currentUpdateImages.length > 1 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-black/50 text-white text-sm">
            {selectedImageIndex + 1} / {currentUpdateImages.length}
          </div>
        )}
        
        {/* Image content */}
        <div 
          className="max-w-[90vw] max-h-[90vh] relative"
          onClick={(e) => e.stopPropagation()}
        >
          <Image 
            src={selectedImage}
            alt={`Image ${selectedImageIndex + 1}`}
            width={1200}
            height={900}
            className="max-h-[90vh] max-w-full h-auto object-contain"
            style={{ borderRadius: '8px' }}
          />
        </div>
      </div>,
      document.body
    )}
  </>)
}
