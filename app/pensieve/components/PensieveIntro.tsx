'use client'

import { useState } from 'react'
// import PensieveWaterBackground from './PensieveWaterBackground'
import UploadImageModal from './UploadImageModal'
import { Aperture } from 'lucide-react'

interface PensieveIntroProps {
  user?: any
  onUploadComplete?: (metadata: any) => void
  showBackground?: boolean
}

export default function PensieveIntro({ user, onUploadComplete, showBackground = true }: PensieveIntroProps) {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)

  return (
    <div className={`relative w-full overflow-hidden ${showBackground ? 'bg-background' : ''}`}>
      {/* Main Content Container */}
      <div className="relative w-full flex flex-col items-center pt-0 sm:pt-0">
        
        {/* Visual Centerpiece (Water Background + Masking) */}
        {/* 
          높이 계산 방식:
          
          1. 목표: 첫 스크롤 전까지 인트로 영역이 화면을 꽉 채우도록 함
          2. 기준: layout.tsx의 상단 패딩(pt)만 고려 (로고는 PensieveNavigationWrapper에서 제거됨)
          
          3. 계산 공식: h = 100svh - layout의 상단 패딩
          
          4. 브레이크포인트별 상세 계산:
          
          [모바일 - 기본]
          - layout.tsx: pt-2 = 0.5rem = 8px
          - 계산: 100svh - 8px
          - 결과: h-[calc(100svh-8px)]
          
          [태블릿 - sm: 640px 이상]
          - layout.tsx: sm:pt-24 = 6rem = 96px
          - 계산: 100svh - 96px
          - 결과: sm:h-[calc(100svh-96px)]
          
          [데스크탑 - md: 768px 이상]
          - layout.tsx: md:pt-28 = 7rem = 112px
          - 계산: 100svh - 112px
          - 결과: md:h-[calc(100svh-112px)]
          
          5. 참고사항:
          - 100svh 사용 이유: 모바일 브라우저 주소창을 고려한 small viewport height
          - 로고 영역은 PensieveNavigationWrapper.tsx에서 주석처리되어 더 이상 계산에 포함되지 않음
          - PensieveNavigationWrapper의 배경 레이어는 h-svh로 전체 화면을 덮고 있음
        */}
        <div className="relative w-full h-[calc(100svh-8px)] sm:h-[calc(100svh-96px)] md:h-[calc(100svh-112px)] overflow-hidden">
          
          {/* Render background only if requested */}
          {showBackground && (
            <>
              {/* Background - Commented out PensieveWaterBackground, replaced with bg-background */}
              <div className="absolute inset-0 bg-background z-0" />
              
              {/* Water Background Component - Commented out */}
              {/* <div className="absolute inset-0 z-10 opacity-90 mix-blend-screen">
                 <PensieveWaterBackground opacity={1} />
              </div> */}
            </>
          )}

          {/* Mask/Fade Overlay at bottom to blend into content - Always needed for fade effect even if BG is external */}
          {/* If BG is external, we still want the fade from black at bottom up */}
          {/* <div className="absolute inset-x-0 bottom-0 h-[30%] bg-linear-to-t from-black to-transparent z-20 pointer-events-none" /> */}
          
          {/* Hero Text Overlay (Positioned at bottom) */}
          <div className="absolute bottom-[10%] sm:bottom-[12%] left-0 right-0 z-30 px-6 sm:px-12 md:px-20 lg:px-32 xl:px-40">
            <div className="w-full max-w-[1600px] mx-auto flex flex-col sm:flex-row sm:items-end sm:justify-between">
              {/* Left Side: Logo/Title & Subtitle */}
              <div className="flex flex-col items-center sm:items-start text-center sm:text-left mb-22 sm:mb-0">
                <h1 className="text-[48px] sm:text-[80px] font-semibold tracking-[-0.005em] leading-[1.05] text-white mb-2 sm:mb-2">
                  Pensieve
                </h1>
                
                <p className="text-[19px] sm:text-[28px] leading-[1.2] sm:leading-[1.1] font-medium text-[#F5F5F7] max-w-[320px] sm:max-w-[600px] tracking-[0.005em]">
                Unlock your vision.
                </p>
              </div>
              
              {/* Right Side: Action Buttons - Hidden on mobile */}
              <div className="hidden sm:flex flex-row items-center justify-end gap-3 sm:gap-4">
                <button 
                  className="min-w-[140px] px-6 py-[11px] rounded-full bg-[#0071e3] text-white text-[17px] font-medium hover:bg-[#0077ed] transition-all cursor-pointer flex items-center justify-center gap-2"
                  onClick={() => setIsUploadModalOpen(true)}
                >
                  <Aperture size={18} />
                  New Project
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      <UploadImageModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadComplete={(metadata) => {
          onUploadComplete?.(metadata)
        }}
        user={user}
      />
    </div>
  )
}

