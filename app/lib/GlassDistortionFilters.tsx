/**
 * Centralized glass distortion SVG filters
 * These filters are used throughout the app for glass morphism effects
 * 
 * 필터 작동 원리:
 * 1. feTurbulence: 프랙탈 노이즈 생성 (유리 표면의 불규칙한 패턴)
 * 2. feImage: 방사형 그라데이션 마스크 생성 (중앙에서 가장자리로 강도 조절)
 * 3. feComposite: 노이즈와 마스크를 결합하여 중앙 강조 효과 생성
 * 4. feGaussianBlur: 노이즈를 부드럽게 만들어 자연스러운 왜곡 패턴 생성
 * 5. Chromatic Aberration: RGB 채널 분리를 통한 색수차 효과
 *    - 각 RGB 채널에 다른 변위 강도 적용 (Red > Green > Blue)
 *    - feDisplacementMap으로 각 채널별 변위 적용
 *    - feColorMatrix로 채널 분리
 *    - feBlend로 채널 재결합하여 렌즈 굴절 효과 시뮬레이션
 */

export function GlassDistortionFilters() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        {/* 
          ============================================
          표준 글라스 필터 (light mode, liquid glass feeling)
          ============================================
        */}
        <filter 
          id="glass-distortion" 
          x="-10%" 
          y="-10%" 
          width="120%" 
          height="120%" 
          colorInterpolationFilters="sRGB"
        >
          {/* 
            x, y, width, height: 필터 적용 영역 확장
            - 음수 좌표와 140% 크기로 확장하여 가장자리 왜곡 효과가 잘리지 않도록 함
            - 왜곡이 영역 밖으로 나가면 잘릴 수 있으므로 여유 공간 확보
          */}
          
          {/* 
            feTurbulence: 프랙탈 노이즈 생성
            - baseFrequency를 대폭 낮춰 자글자글한 질감 대신 큰 곡면을 만듦
            - numOctaves를 3으로 낮춰 디테일을 줄이고 liquid 곡선을 강조
          */}
          <feTurbulence 
            type="fractalNoise" 
            baseFrequency="0.003 0.006" 
            numOctaves="3" 
            seed="7" 
            result="noise" 
          />
          
          {/* 
            feImage: 방사형 그라데이션 마스크 생성
            - 중앙에서 가장자리로 갈수록 효과가 약해지도록 하는 마스크
            - radialGradient: 중앙(black)에서 가장자리(white)로 그라데이션
            - r="90%": 더 넓은 영역에 효과 적용
            - result="radialMask": 결과를 'radialMask'로 저장
          */}
          <feImage 
            result="radialMask" 
            preserveAspectRatio="none" 
            x="0" 
            y="0" 
            width="100%" 
            height="100%" 
            xlinkHref="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><defs><radialGradient id='g' cx='50%25' cy='50%25' r='75%25'><stop offset='0%25' stop-color='black'/><stop offset='100%25' stop-color='white'/></radialGradient></defs><rect width='100%25' height='100%25' fill='url(%23g)'/></svg>" 
          />
          
          {/* 
            feComposite: 노이즈와 마스크를 결합
            - operator="arithmetic": 산술 연산으로 두 입력을 결합
            - k1="0": 첫 번째 입력(noise)의 곱셈 계수
            - k2="0": 두 번째 입력(radialMask)의 곱셈 계수
            - k3="1": 두 입력의 곱셈 계수 (noise * radialMask * 1)
            - k4="0": 상수 추가 값
            - 결과: 중앙은 강하게, 가장자리는 약하게 노이즈가 적용됨
            - result="modulatedNoise": 결과를 'modulatedNoise'로 저장
          */}
          <feComposite 
            in="noise" 
            in2="radialMask" 
            operator="arithmetic" 
            k1="0" 
            k2="0" 
            k3="1.35" 
            k4="0" 
            result="modulatedNoise" 
          />
          
          {/* 
            feGaussianBlur: 노이즈를 부드럽게 만듦
            - stdDeviation="1.2": 블러 강도 증가로 표면을 더 매끄럽게 표현
            - edgeMode="duplicate": 가장자리 처리 방식 (가장자리 픽셀 복제)
            - 부드러운 노이즈가 더 자연스러운 liquid glass 효과를 만듦
            - result="smoothNoise": 결과를 'smoothNoise'로 저장 (변위 맵으로 사용)
          */}
          <feGaussianBlur 
            in="modulatedNoise" 
            stdDeviation="1.2" 
            edgeMode="duplicate" 
            result="smoothNoise" 
          />
          
          {/* 
            BASE_DISPLACED: 중앙 영역에서 사용할 기본 변위 레이어
            - chromatic aberration을 적용하지 않는 내부 영역용
          */}
          {/* <feDisplacementMap 
            in="SourceGraphic" 
            in2="smoothNoise" 
            scale="33" 
            xChannelSelector="R" 
            yChannelSelector="B" 
            result="BASE_DISPLACED" 
          /> */}
          
          {/* 
            Chromatic Aberration: RGB 채널 분리로 색수차 효과 생성
            - 각 RGB 채널에 다른 변위 강도를 적용하여 렌즈 굴절 효과 시뮬레이션
            - 무지개 효과 비율 유지하면서 전체 왜곡 강도 증가 (Red=20, Green=18, Blue=16)
          */}
          
          {/* Red 채널 변위 적용 (기본 강도) */}
          <feDisplacementMap 
            in="SourceGraphic" 
            in2="smoothNoise" 
            scale="20" 
            xChannelSelector="R" 
            yChannelSelector="B" 
            result="RED_DISPLACED" 
          />
          
          {/* Green 채널 변위 적용 (90% 강도) */}
          <feDisplacementMap 
            in="SourceGraphic" 
            in2="smoothNoise" 
            scale="18" 
            xChannelSelector="R" 
            yChannelSelector="B" 
            result="GREEN_DISPLACED" 
          />
          
          {/* Blue 채널 변위 적용 (80% 강도) */}
          <feDisplacementMap 
            in="SourceGraphic" 
            in2="smoothNoise" 
            scale="16" 
            xChannelSelector="R" 
            yChannelSelector="B" 
            result="BLUE_DISPLACED" 
          />
          
          {/* Red 채널 분리 */}
          <feColorMatrix
            in="RED_DISPLACED"
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="RED_CHANNEL"
          />
          
          {/* Green 채널 분리 */}
          <feColorMatrix
            in="GREEN_DISPLACED"
            type="matrix"
            values="0 0 0 0 0
                    0 1 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="GREEN_CHANNEL"
          />
          
          {/* Blue 채널 분리 */}
          <feColorMatrix
            in="BLUE_DISPLACED"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
            result="BLUE_CHANNEL"
          />
          
          {/* Green과 Blue 채널 결합 */}
          <feBlend 
            in="GREEN_CHANNEL" 
            in2="BLUE_CHANNEL" 
            mode="screen" 
            result="GB_COMBINED" 
          />
          
          {/* Red 채널과 결합된 GB 채널 결합 (최종 결과) */}
          <feBlend 
            in="RED_CHANNEL" 
            in2="GB_COMBINED" 
            mode="screen" 
            result="CHROMATIC_COMBINED" 
          />
          
          {/* 
            edgeMask: 테두리 영역만 추출하여 색수차 적용
            - radialMask를 알파 채널로 변환 후 감마 보정으로 가장자리 강조
          */}
          {/* <feColorMatrix
            in="radialMask"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    1 0 0 0 0"
            result="edgeMask"
          />
          <feComponentTransfer in="edgeMask" result="edgeMaskStrong">
            <feFuncA type="gamma" amplitude="1" exponent="3" offset="0" />
          </feComponentTransfer> */}
          
          {/* 테두리에는 색수차, 중앙에는 기본 변위만 적용 */}
          {/* <feComposite 
            in="CHROMATIC_COMBINED" 
            in2="edgeMaskStrong" 
            operator="in" 
            result="EDGE_CHROMA" 
          />
          <feComposite 
            in="BASE_DISPLACED" 
            in2="edgeMaskStrong" 
            operator="out" 
            result="CENTER_BASE" 
          />
          <feComposite 
            in="EDGE_CHROMA" 
            in2="CENTER_BASE" 
            operator="over" 
          /> */}
        </filter>
        
        {/* 
          ============================================
          다크모드 전용 글라스 필터 - 강한 liquid glass 효과
          ============================================
        */}
        <filter 
          id="glass-distortion-dark" 
          x="-10%" 
          y="-10%" 
          width="120%" 
          height="120%" 
          colorInterpolationFilters="sRGB"
        >
          {/* 
            baseFrequency를 0.002/0.004로 크게 낮춰 느린 파동 패턴을 생성
            numOctaves는 3으로 감소시켜 디테일을 줄이고 부드러운 곡선을 강조
          */}
          <feTurbulence 
            type="fractalNoise" 
            baseFrequency="0.002 0.004" 
            numOctaves="3" 
            seed="7" 
            result="noise" 
          />
          
          {/* 
            radialGradient r="85%": 더 부드러운 마스킹으로 액체 느낌 강조
            - 중앙(white)에서 가장자리(black)로: 다크모드는 반대 그라데이션 사용
          */}
          <feImage 
            result="radialMask" 
            preserveAspectRatio="none" 
            x="0" 
            y="0" 
            width="100%" 
            height="100%" 
            xlinkHref="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><defs><radialGradient id='g-dark' cx='50%25' cy='50%25' r='80%25'><stop offset='0%25' stop-color='white'/><stop offset='100%25' stop-color='black'/></radialGradient></defs><rect width='100%25' height='100%25' fill='url(%23g-dark)'/></svg>" 
          />
          
          {/* 
            k3 값을 1.5로 높여 중앙 쪽 굴절을 강화
          */}
          <feComposite 
            in="noise" 
            in2="radialMask" 
            operator="arithmetic" 
            k1="0" 
            k2="0" 
            k3="1.5" 
            k4="0" 
            result="modulatedNoise" 
          />
          
          {/* 
            stdDeviation="1.5": 노이즈를 크게 뭉개서 젤리 같은 표면을 연출
          */}
          <feGaussianBlur 
            in="modulatedNoise" 
            stdDeviation="1.5" 
            edgeMode="duplicate" 
            result="smoothNoise" 
          />
          
          {/* 다크 모드 기본 변위 (중앙 영역용) */}
          {/* <feDisplacementMap 
            in="SourceGraphic" 
            in2="smoothNoise" 
            scale="43" 
            xChannelSelector="R" 
            yChannelSelector="B" 
            result="BASE_DISPLACED" 
          />
           */}
          {/* 
            Chromatic Aberration: RGB 채널 분리로 색수차 효과 생성
            - 무지개 효과 비율 유지하면서 전체 왜곡 강도 증가 (Red=26, Green=23, Blue=20)
          */}
          
          {/* Red 채널 변위 적용 (기본 강도) */}
          <feDisplacementMap 
            in="SourceGraphic" 
            in2="smoothNoise" 
            scale="26" 
            xChannelSelector="R" 
            yChannelSelector="B" 
            result="RED_DISPLACED" 
          />
          
          {/* Green 채널 변위 적용 (88% 강도) */}
          <feDisplacementMap 
            in="SourceGraphic" 
            in2="smoothNoise" 
            scale="23" 
            xChannelSelector="R" 
            yChannelSelector="B" 
            result="GREEN_DISPLACED" 
          />
          
          {/* Blue 채널 변위 적용 (77% 강도) */}
          <feDisplacementMap 
            in="SourceGraphic" 
            in2="smoothNoise" 
            scale="20" 
            xChannelSelector="R" 
            yChannelSelector="B" 
            result="BLUE_DISPLACED" 
          />
          
          {/* Red 채널 분리 */}
          <feColorMatrix
            in="RED_DISPLACED"
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="RED_CHANNEL"
          />
          
          {/* Green 채널 분리 */}
          <feColorMatrix
            in="GREEN_DISPLACED"
            type="matrix"
            values="0 0 0 0 0
                    0 1 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="GREEN_CHANNEL"
          />
          
          {/* Blue 채널 분리 */}
          <feColorMatrix
            in="BLUE_DISPLACED"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
            result="BLUE_CHANNEL"
          />
          
          {/* Green과 Blue 채널 결합 */}
          <feBlend 
            in="GREEN_CHANNEL" 
            in2="BLUE_CHANNEL" 
            mode="screen" 
            result="GB_COMBINED" 
          />
          
          {/* Red 채널과 결합된 GB 채널 결합 (최종 결과) */}
          <feBlend 
            in="RED_CHANNEL" 
            in2="GB_COMBINED" 
            mode="screen" 
            result="CHROMATIC_COMBINED" 
          />
          
          {/* 테두리 마스크 생성 및 색수차 범위 제한 */}
          {/* <feColorMatrix
            in="radialMask"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    1 0 0 0 0"
            result="edgeMask"
          />
          <feComponentTransfer in="edgeMask" result="edgeMaskStrong">
            <feFuncA type="gamma" amplitude="1" exponent="3" offset="0" />
          </feComponentTransfer>
          
          <feComposite 
            in="CHROMATIC_COMBINED" 
            in2="edgeMaskStrong" 
            operator="in" 
            result="EDGE_CHROMA" 
          />
          <feComposite 
            in="BASE_DISPLACED" 
            in2="edgeMaskStrong" 
            operator="out" 
            result="CENTER_BASE" 
          />
          <feComposite 
            in="EDGE_CHROMA" 
            in2="CENTER_BASE" 
            operator="over" 
          /> */}
        </filter>
        
        {/* 
          ============================================
          AI 변형 글라스 필터
          ============================================
          표준 필터와 동일한 설정 (AI 메시지용 별도 필터 ID)
        */}
        <filter 
          id="glass-distortion-ai" 
          x="-10%" 
          y="-10%" 
          width="120%" 
          height="120%" 
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence 
            type="fractalNoise" 
            baseFrequency="0.02 0.05" 
            numOctaves="3" 
            seed="7" 
            result="noise" 
          />
          <feImage 
            result="radialMask" 
            preserveAspectRatio="none" 
            x="0" 
            y="0" 
            width="100%" 
            height="100%" 
            xlinkHref="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><defs><radialGradient id='g' cx='50%25' cy='50%25' r='70%25'><stop offset='0%25' stop-color='black'/><stop offset='100%25' stop-color='white'/></radialGradient></defs><rect width='100%25' height='100%25' fill='url(%23g)'/></svg>" 
          />
          <feComposite 
            in="noise" 
            in2="radialMask" 
            operator="arithmetic" 
            k1="0" 
            k2="0" 
            k3="1" 
            k4="0" 
            result="modulatedNoise" 
          />
          <feGaussianBlur 
            in="modulatedNoise" 
            stdDeviation="0.3" 
            edgeMode="duplicate" 
            result="smoothNoise" 
          />
          
          {/* AI 전용 기본 변위 (중심 영역 유지) */}
          {/* <feDisplacementMap 
            in="SourceGraphic" 
            in2="smoothNoise" 
            scale="14.5" 
            xChannelSelector="R" 
            yChannelSelector="B" 
            result="BASE_DISPLACED" 
          />
           */}
          {/* 
            Chromatic Aberration: RGB 채널 분리로 색수차 효과 생성
            - 무지개 효과 비율 유지하면서 전체 왜곡 강도 증가 (Red=8, Green=7.4, Blue=7)
          */}
          
          {/* Red 채널 변위 적용 (기본 강도) */}
          <feDisplacementMap 
            in="SourceGraphic" 
            in2="smoothNoise" 
            scale="8" 
            xChannelSelector="R" 
            yChannelSelector="B" 
            result="RED_DISPLACED" 
          />
          
          {/* Green 채널 변위 적용 (92% 강도) */}
          <feDisplacementMap 
            in="SourceGraphic" 
            in2="smoothNoise" 
            scale="7.4" 
            xChannelSelector="R" 
            yChannelSelector="B" 
            result="GREEN_DISPLACED" 
          />
          
          {/* Blue 채널 변위 적용 (87% 강도) */}
          <feDisplacementMap 
            in="SourceGraphic" 
            in2="smoothNoise" 
            scale="7" 
            xChannelSelector="R" 
            yChannelSelector="B" 
            result="BLUE_DISPLACED" 
          />
          
          {/* Red 채널 분리 */}
          <feColorMatrix
            in="RED_DISPLACED"
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="RED_CHANNEL"
          />
          
          {/* Green 채널 분리 */}
          <feColorMatrix
            in="GREEN_DISPLACED"
            type="matrix"
            values="0 0 0 0 0
                    0 1 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="GREEN_CHANNEL"
          />
          
          {/* Blue 채널 분리 */}
          <feColorMatrix
            in="BLUE_DISPLACED"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
            result="BLUE_CHANNEL"
          />
          
          {/* Green과 Blue 채널 결합 */}
          <feBlend 
            in="GREEN_CHANNEL" 
            in2="BLUE_CHANNEL" 
            mode="screen" 
            result="GB_COMBINED" 
          />
          
          {/* Red 채널과 결합된 GB 채널 결합 (최종 결과) */}
          <feBlend 
            in="RED_CHANNEL" 
            in2="GB_COMBINED" 
            mode="screen" 
            result="CHROMATIC_COMBINED" 
          />
          
          {/* edgeMask로 테두리에만 색수차 적용 */}
          {/* <feColorMatrix
            in="radialMask"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    1 0 0 0 0"
            result="edgeMask"
          />
          <feComponentTransfer in="edgeMask" result="edgeMaskStrong">
            <feFuncA type="gamma" amplitude="1" exponent="3" offset="0" />
          </feComponentTransfer>
          
          <feComposite 
            in="CHROMATIC_COMBINED" 
            in2="edgeMaskStrong" 
            operator="in" 
            result="EDGE_CHROMA" 
          />
          <feComposite 
            in="BASE_DISPLACED" 
            in2="edgeMaskStrong" 
            operator="out" 
            result="CENTER_BASE" 
          />
          <feComposite 
            in="EDGE_CHROMA" 
            in2="CENTER_BASE" 
            operator="over" 
          /> */}
        </filter>
      </defs>
    </svg>
  );
}

