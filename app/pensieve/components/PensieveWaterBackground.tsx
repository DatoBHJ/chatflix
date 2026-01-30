'use client'

import { useEffect, useRef, useCallback, memo } from 'react'
import * as THREE from 'three'

interface PensieveWaterBackgroundProps {
  className?: string
  opacity?: number
  interactive?: boolean
}

// Simplex 3D 노이즈 GLSL 구현
// 유기적이고 자연스러운 물결 패턴을 생성하기 위한 3D 노이즈 함수
// Perlin 노이즈보다 계산이 빠르고 부드러운 결과를 제공함
const simplexNoise = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
`

// 버텍스 셰이더 - 단순 패스스루
// 2D 평면을 그리기 위한 간단한 버텍스 셰이더
// UV 좌표를 프래그먼트 셰이더로 전달함
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// 프래그먼트 셰이더 - Pensieve 물 효과 (소용돌이/잉크 스타일)
// 해리포터 Pensieve의 신비로운 물 효과를 구현
// 소용돌이, 도메인 워핑, 마우스 상호작용 등을 통해 유기적인 물 흐름을 시뮬레이션
const fragmentShader = `
  ${simplexNoise}

  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uMouse;
  uniform float uMouseStrength;
  uniform vec2 uMouseVel;
  uniform vec3 uColorDeep;
  uniform vec3 uColorMid;
  uniform vec3 uColorLight;
  uniform vec3 uColorHighlight;

  varying vec2 vUv;

  // 2D 회전 행렬
  // 주어진 각도로 2D 벡터를 회전시키는 행렬을 생성
  mat2 rotate2d(float angle){
    return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  }

  // 프랙탈 브라운 운동 (FBM) - 회전을 포함한 소용돌이 효과
  // 여러 주파수의 노이즈를 합쳐서 자연스러운 물결 패턴 생성
  // 느리고 부드러운 움직임을 위해 시간 계수를 낮춤
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;  // 진폭 (각 옥타브마다 절반으로 감소)
    float frequency = 0.8;  // 낮은 주파수로 더 크고 부드러운 파동 생성
    mat2 rot = rotate2d(0.5);  // 각 옥타브마다 고정된 회전 적용
    
    for(int i = 0; i < 4; i++) {
      // 매우 느린 시간 계수 (0.05)로 부드러운 움직임 구현
      value += amplitude * snoise(vec3(p * frequency, uTime * 0.05));
      p = rot * p * 2.0 + vec2(uTime * 0.02);  // 회전 + 시간 기반 이동
      amplitude *= 0.5;  // 다음 옥타브는 절반 크기
    }
    return value;
  }

  // 도메인 워핑 - 잉크 같은 유체 움직임을 위한 좌표 왜곡
  // FBM을 여러 단계로 중첩하여 좌표 공간을 왜곡시켜 유기적인 흐름 패턴 생성
  // 잉크가 물에 퍼지거나 기억이 섞이는 듯한 느낌을 만듦
  float domainWarp(vec2 p) {
    vec2 q = vec2(
      fbm(p + vec2(0.0, 0.0)),
      fbm(p + vec2(5.2, 1.3))
    );
    
    vec2 r = vec2(
      fbm(p + 4.0 * q + vec2(1.7, 9.2)),
      fbm(p + 4.0 * q + vec2(8.3, 2.8))
    );
    
    return fbm(p + 4.0 * r);
  }

  void main() {
    vec2 uv = vUv;  // 정규화된 UV 좌표 (0~1)
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);  // 화면 비율 보정
    vec2 uvAspect = (uv - 0.5) * aspect;  // 중심을 (0,0)으로 하는 좌표계
    
    float distFromCenter = length(uvAspect);  // 중심으로부터의 거리
    
    // 원형 마스크 (그릇 형태) - 현재는 부드러운 블렌딩을 사용하므로 미사용
    // float bowlMask = smoothstep(0.48, 0.45, distFromCenter);
    
    // 소용돌이/회전 운동 - 매우 느린 회전으로 몽환적인 효과
    float angle = atan(uvAspect.y, uvAspect.x);  // 중심으로부터의 각도
    float radius = length(uvAspect);  // 중심으로부터의 반지름
    
    // 소용돌이 왜곡: 매우 느리고 최면적인 회전
    // 중심에 가까울수록 더 강하게 회전 (1/(radius+0.2))
    float swirlStrength = 1.5;  // 소용돌이 강도
    float swirlAngle = angle + swirlStrength / (radius + 0.2) * sin(uTime * 0.1);
    
    // 회전된 좌표로 변환
    vec2 swirledUV = vec2(cos(swirlAngle), sin(swirlAngle)) * radius;
    
    // 마우스 "손가락 드래그" 상호작용:
    // 손가락 위치에 깊은 움푹 들어간 곳(가라앉는 효과) 생성
    // 좁은 영역이지만 깊게 가라앉는 느낌
    vec2 mouseUV = (uMouse - 0.5) * aspect;  // 마우스 위치를 중심 좌표계로 변환
    vec2 toMouse = uvAspect - mouseUV;  // 현재 픽셀에서 마우스로의 벡터
    float mouseDist = length(toMouse);  // 마우스로부터의 거리
    
    // 영향력을 매우 좁게 유지 (손가락 굵기 정도, 넓지 않음)
    // exp() 함수를 사용하여 국소적인 효과를 만들되, 깊게 느껴지도록 함
    // 30.0은 극도로 높은 감쇠 계수로, 마우스 바로 근처 극소 영역에만 영향을 줌
    float influence = exp(-mouseDist * 20.0) * uMouseStrength;
    
    vec2 pushDir = normalize(toMouse + vec2(1e-4));  // 마우스 방향 (정규화, 0으로 나누기 방지)
    vec2 perp = vec2(-pushDir.y, pushDir.x);  // 수직 방향 (회전 효과용)
    vec2 velAspect = uMouseVel * aspect;  // 마우스 속도를 화면 비율에 맞춤
    float velMag = clamp(length(velAspect) * 10.0, 0.0, 1.0);  // 속도 크기 (0~1로 클램핑)

    // 조회 좌표 변위: 안쪽으로 당겨서 깊이감 생성
    vec2 interactiveUV = swirledUV;
    
    // 좌표를 안쪽으로 당겨서 가라앉는/움푹 들어간 효과 생성
    // pushDir 방향으로 좌표를 당기면 시각적으로 물이 그 방향으로 밀려나는 것처럼 보임
    interactiveUV -= pushDir * influence * 0.05; 
    
    // 움직일 때의 드래그 효과: 마우스 이동 방향으로 물이 끌려감
    interactiveUV -= velAspect * influence * 0.06;
    
    // 강한 회전 효과: 마우스 이동 방향의 수직으로 소용돌이 생성
    // 0.3은 강한 회전 계수로, 마우스를 움직일 때 물이 명확하게 소용돌이치는 효과를 만듦
    interactiveUV += perp * influence * 0.9 * velMag;

    // 잉크/기억 유체 패턴 (기본)
    // 도메인 워핑을 사용하여 유기적인 물 흐름 패턴 생성
    float fluid = domainWarp(interactiveUV * 2.4 - vec2(0.0, uTime * 0.045));

    // 손가락에서 퍼져나가는 부드러운 리플 추가
    // sin 함수로 원형 파동 생성, exp로 거리에 따라 감쇠
    float ripple = sin(mouseDist * 20.0 - uTime * 0.75) * exp(-mouseDist * 5.0) * influence;
    fluid += ripple * 0.03;

    // 핵심: fluid 값에서 매우 강하게 빼서 깊은 움푹 들어간 곳 생성
    // 이렇게 하면 해당 영역이 어두워져서 물이 깊게 가라앉는 것처럼 보임
    // 0.6은 극도로 강한 감소값으로, 손가락이 물을 매우 깊게 누르는 느낌을 만듦
    fluid -= influence * 0.9;

    // 미세한 국소 난류 추가 (손가락 근처에만)
    // 손가락 주변의 물이 살짝 거칠게 움직이는 효과
    float localTurb = snoise(vec3(interactiveUV * 6.0, uTime * 0.6)) * influence;
    fluid += localTurb * 0.18;
    
    // fluid 값에 기반한 색상 혼합
    // 더 밝고 잘 보이도록 조정된 블렌딩
    // fluid 값이 낮으면 어두운 색(Deep), 중간이면 중간 색(Mid), 높으면 밝은 색(Light)
    vec3 color = mix(uColorDeep, uColorMid, smoothstep(0.1, 0.5, fluid));
    color = mix(color, uColorLight, smoothstep(0.4, 0.8, fluid));
    
    // 하이라이트 (반짝이는 기억) - 더 넓은 범위로 밝기 증가
    // 마우스 직접 영향 제거하여 "손가락이 빛나는" 효과 방지
    float highlight = smoothstep(0.75, 1.0, fluid);
    color = mix(color, uColorHighlight, highlight * 0.8);
    
    // 가장자리 조명 제거 - 자연스러운 블렌딩을 위해
    // 내부 그림자 (비네트) - 자연스러운 원형 모양을 위한 부드러운 페이드아웃
    // 더 일찍 (0.5) 시작하지만 매우 점진적으로 페이드
    color *= smoothstep(0.5, 0.2, distFromCenter);
    
    // 전체 밝기 부스트 - 다시 추가됨
    color *= 1.3;
    
    // 그릇 마스크 기반으로 물 효과와 깊은 배경 혼합
    // 더 자연스러운 모양을 위한 부드러운 가장자리
    float softMask = smoothstep(0.5, 0.35, distFromCenter);
    
    // 버리지 않고 깊은 배경 색상과 혼합하여 갤러리를 가림
    vec3 finalColor = mix(uColorDeep, color, softMask);
    
    // 어두운 배경에 매우 미세한 노이즈 추가하여 블렌딩 개선
    float bgNoise = snoise(vec3(uv * 5.0, uTime * 0.05)) * 0.02;
    // 노이즈는 주로 중심 물 영역 밖에 적용
    finalColor += bgNoise * (1.0 - softMask);

    // 최종 출력 - 완전 불투명
    gl_FragColor = vec4(finalColor, 1.0);
  }
`

// 공유 WebGL 리소스 타입 정의
// 컴포넌트가 언마운트/재마운트되어도 WebGL 리소스를 재사용하여 성능 최적화
type SharedWaterResources = {
  renderer: THREE.WebGLRenderer  // WebGL 렌더러
  scene: THREE.Scene  // 3D 씬
  camera: THREE.OrthographicCamera  // 2D 효과를 위한 직교 카메라
  material: THREE.ShaderMaterial  // 셰이더 머티리얼
  geometry: THREE.PlaneGeometry  // 전체 화면 평면 지오메트리
  mesh: THREE.Mesh  // 렌더링할 메시
  // 재마운트 시 점프를 방지하기 위한 상태 유지
  globalStartTime: number  // 전역 시작 시간 (시간 연속성 유지)
  lastMousePos: { x: number, y: number }  // 마지막 마우스 위치
  smoothMouse: { x: number, y: number }  // 부드럽게 보간된 마우스 위치
  currentOwnerId: string | null // 현재 캔버스를 점유 중인 인스턴스 ID
}

// 단일 WebGL 파이프라인을 마운트 간에 살아있게 유지하여 셰이더 재컴파일 지연 방지
let sharedWater: SharedWaterResources | null = null
let instanceCount = 0 // 고유 ID 생성을 위한 카운터

const PensieveWaterBackground = memo(function PensieveWaterBackground({
  className = '',
  opacity = 1,
  interactive = false
}: PensieveWaterBackgroundProps) {
  const instanceId = useRef(`water-${++instanceCount}`).current
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  // ... (rest of refs)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null)
  const materialRef = useRef<THREE.ShaderMaterial | null>(null)
  const frameIdRef = useRef<number>(0)
  
  // 로컬 애니메이션 상태를 위한 refs
  const mouseRef = useRef({ x: 0.5, y: 0.5, strength: 0 })  // 현재 마우스 위치와 강도
  const smoothMouseRef = useRef({ x: 0.5, y: 0.5 })  // 부드럽게 보간된 마우스 위치
  const mouseVelRef = useRef({ x: 0, y: 0 })  // 마우스 속도 (초당 픽셀)
  const lastMouseTsRef = useRef<number>(0)  // 마지막 마우스 이벤트 타임스탬프
  const lastMouseMoveRef = useRef<number>(0)  // 마지막 마우스 움직임 시간 (강도 감쇠용)
  const isVisibleRef = useRef(true)  // 화면에 보이는지 여부 (IntersectionObserver용)
  const lastFrameTimeRef = useRef<number>(0)  // 마지막 프레임 시간 (FPS 제한용)
  const targetFPS = 30  // 목표 FPS (성능 최적화)
  const lowPowerFPS = 15 // 타이핑 중 등 저전력 모드 FPS
  const isTypingRef = useRef(false) // 타이핑 중인지 추적
  const isScrollingRef = useRef(false) // 스크롤 중인지 추적
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null) // 타이핑 타임아웃
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null) // 스크롤 타임아웃
  const isContentEditableFocusedRef = useRef(false) // contentEditable 포커스 상태

  // 스크롤 및 키보드 이벤트 핸들러 - 성능 최적화
  useEffect(() => {
    const handleScroll = () => {
      if (!isScrollingRef.current) {
        isScrollingRef.current = true
      }
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      
      // 스크롤이 멈추고 100ms 후에 다시 렌더링 활성화
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false
      }, 100)
    }

    const handleKeyDown = () => {
      isTypingRef.current = true
      
      // 기존 타임아웃 클리어
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      
      // 500ms 동안 키 입력이 없으면 타이핑 중지 상태로 변경
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false
      }, 500)
    }
    
    // contentEditable 포커스 감지
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      if (target && (target.isContentEditable || target.getAttribute('contenteditable') === 'true')) {
        isContentEditableFocusedRef.current = true
      }
    }
    
    const handleBlur = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      if (target && (target.isContentEditable || target.getAttribute('contenteditable') === 'true')) {
        // 약간의 지연 후 포커스 해제 (다른 요소로 포커스 이동 가능성 고려)
        setTimeout(() => {
          const activeElement = document.activeElement as HTMLElement
          if (activeElement && !activeElement.isContentEditable && 
              activeElement.getAttribute('contenteditable') !== 'true') {
            isContentEditableFocusedRef.current = false
          }
        }, 100)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScroll, { passive: true })
    document.addEventListener('focusin', handleFocus)
    document.addEventListener('focusout', handleBlur)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('focusin', handleFocus)
      document.removeEventListener('focusout', handleBlur)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!interactive || !containerRef.current) return
    
    const rect = containerRef.current.getBoundingClientRect()
    // 마우스가 컨테이너 경계 내에 있는지 확인
    if (
      e.clientX < rect.left || 
      e.clientX > rect.right || 
      e.clientY < rect.top || 
      e.clientY > rect.bottom
    ) {
      return
    }
    
    // 마우스 위치를 정규화된 좌표 (0~1)로 변환
    const x = (e.clientX - rect.left) / rect.width
    const y = 1 - (e.clientY - rect.top) / rect.height  // WebGL용 Y축 뒤집기

    // 마우스 속도 추정
    const now = performance.now()
    const lastTs = lastMouseTsRef.current
    const dt = lastTs ? (now - lastTs) / 1000 : 0  // 시간 차이 (초)
    
    // 로컬 refs 업데이트
    if (sharedWater) {
       const dx = x - sharedWater.lastMousePos.x  // X 방향 이동량
       const dy = y - sharedWater.lastMousePos.y  // Y 방향 이동량
       if (dt > 0) {
         // 속도 = 이동량 / 시간 (초당 정규화 좌표 단위)
         mouseVelRef.current.x = dx / dt
         mouseVelRef.current.y = dy / dt
       }
       sharedWater.lastMousePos = { x, y }  // 전역 상태 업데이트
    }
    
    lastMouseTsRef.current = now
    mouseRef.current.x = x
    mouseRef.current.y = y
    mouseRef.current.strength = 1  // 마우스가 움직이면 강도 최대
    lastMouseMoveRef.current = Date.now()  // 마지막 움직임 시간 기록
  }, [interactive])

  // 터치 이동 이벤트 핸들러
  // 모바일 기기에서 터치를 마우스와 동일하게 처리
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!interactive || !containerRef.current || !e.touches[0]) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const touch = e.touches[0]
    
    // 터치가 컨테이너 경계 내에 있는지 확인
    if (
      touch.clientX < rect.left || 
      touch.clientX > rect.right || 
      touch.clientY < rect.top || 
      touch.clientY > rect.bottom
    ) {
      return
    }
    
    // 터치 위치를 정규화된 좌표로 변환
    const x = (touch.clientX - rect.left) / rect.width
    const y = 1 - (touch.clientY - rect.top) / rect.height

    // 터치 속도 추정 (마우스와 동일한 로직)
    const now = performance.now()
    const lastTs = lastMouseTsRef.current
    const dt = lastTs ? (now - lastTs) / 1000 : 0

    // 로컬 refs 업데이트
    if (sharedWater) {
       const dx = x - sharedWater.lastMousePos.x
       const dy = y - sharedWater.lastMousePos.y
       if (dt > 0) {
         mouseVelRef.current.x = dx / dt
         mouseVelRef.current.y = dy / dt
       }
       sharedWater.lastMousePos = { x, y }
    }
    
    lastMouseTsRef.current = now
    mouseRef.current.x = x
    mouseRef.current.y = y
    mouseRef.current.strength = 1
    lastMouseMoveRef.current = Date.now()
  }, [interactive])

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // 공유 WebGL 리소스 생성 또는 재사용
    // 첫 마운트 시에만 생성하고, 이후에는 재사용하여 셰이더 재컴파일 방지
    if (!sharedWater) {
      // 씬 설정 - 3D 공간 생성
      const scene = new THREE.Scene()
      // 직교 카메라 - 2D 효과를 위해 사용 (원근감 없음)
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
      camera.position.z = 1  // 카메라를 앞으로 이동
      
      // WebGL 렌더러 설정
      const renderer = new THREE.WebGLRenderer({
        alpha: true,  // 투명 배경 허용
        antialias: true,  // 안티앨리어싱 활성화
        powerPreference: 'high-performance'  // 고성능 GPU 우선 사용
      })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))  // 픽셀 비율 제한 (성능)
      renderer.setClearColor(0x000000, 0)  // 투명 배경

      // Pensieve 색상 팔레트 - 해리포터 영화에서 추출한 색상
      const deepColor = new THREE.Color('#082026')  // 깊은 청록색 (거의 검정)
      const midColor = new THREE.Color('#165B6B')  // 생생한 청록/시안
      const lightColor = new THREE.Color('#78BCCF')  // 밝은 아이스 블루
      const highlightColor = new THREE.Color('#E0F7FA')  // 순수한 밝은 시안/흰색 하이라이트

      // 셰이더 머티리얼 생성 - 커스텀 셰이더 사용
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: new THREE.Vector2(width, height) },
          uMouse: { value: new THREE.Vector2(0.5, 0.5) },
          uMouseStrength: { value: 0 },
          uMouseVel: { value: new THREE.Vector2(0, 0) },
          uColorDeep: { value: deepColor },
          uColorMid: { value: midColor },
          uColorLight: { value: lightColor },
          uColorHighlight: { value: highlightColor }
        },
        transparent: true,
        depthTest: false,
        depthWrite: false
      })

      // 전체 화면을 덮는 평면 지오메트리 생성 (2x2 단위)
      const geometry = new THREE.PlaneGeometry(2, 2)
      const mesh = new THREE.Mesh(geometry, material)
      scene.add(mesh)

      // 렌더러 크기 설정 및 셰이더 사전 컴파일 (첫 렌더링 지연 방지)
      renderer.setSize(width, height)
      renderer.compile(scene, camera)

      // 공유 리소스 초기화
      sharedWater = { 
        renderer, scene, camera, material, geometry, mesh,
        globalStartTime: Date.now(),  // 전역 시작 시간 기록
        lastMousePos: { x: 0.5, y: 0.5 },  // 마우스 위치 초기화 (중심)
        smoothMouse: { x: 0.5, y: 0.5 },  // 부드러운 마우스 위치 초기화
        currentOwnerId: instanceId // 최초 생성자가 소유권 획득
      }
    }

    const { renderer, scene, camera, material } = sharedWater
    
    // 새로 마운트된 인스턴스가 소유권 강제 획득 (모달 등이 열릴 때)
    sharedWater.currentOwnerId = instanceId

    // 캔버스를 현재 컨테이너에 연결
    renderer.setSize(width, height)
    material.uniforms.uResolution.value.set(width, height)
    if (renderer.domElement.parentElement !== container) {
      container.appendChild(renderer.domElement)
    }

    // refs 할당 (다른 로직에서 사용)
    rendererRef.current = renderer
    sceneRef.current = scene
    cameraRef.current = camera
    materialRef.current = material

    // 재마운트 시 마우스 상태 리셋하여 점프 방지
    // 강도를 0으로 시작하여 위치 점프가 보이지 않게 함
    mouseRef.current.strength = 0 
    mouseVelRef.current = { x: 0, y: 0 }
    // 로컬 마우스 ref를 마지막으로 알려진 전역 위치(또는 중심)와 동기화
    const startPos = sharedWater.lastMousePos
    mouseRef.current.x = startPos.x
    mouseRef.current.y = startPos.y
    
    // 핵심: 부드럽게 보간된 값도 강제로 동기화하여 lerp 거리 제거
    // 이렇게 하면 재마운트 시 "화면을 가로지르는" 효과를 방지함
    sharedWater.smoothMouse = { x: startPos.x, y: startPos.y }
    smoothMouseRef.current = { x: startPos.x, y: startPos.y }
    
    // 속도 유니폼도 즉시 리셋
    material.uniforms.uMouseVel.value.set(0, 0)
    material.uniforms.uMouse.value.set(startPos.x, startPos.y)
    material.uniforms.uMouseStrength.value = 0

    // 애니메이션 루프
    // 매 프레임마다 실행되어 물 효과를 업데이트하고 렌더링
    const animate = (currentTime: number) => {
      frameIdRef.current = requestAnimationFrame(animate)

      // 성능 최적화: 타이핑 중이거나 contentEditable에 포커스가 있으면 매우 낮은 FPS 사용
      // 스크롤 중에는 렌더링을 완전히 중단하여 CPU/GPU 자원을 스크롤에 집중
      if (isScrollingRef.current) return

      const isUserInteracting = isTypingRef.current || isContentEditableFocusedRef.current
      const currentFPS = isUserInteracting ? lowPowerFPS : targetFPS
      const currentInterval = 1000 / currentFPS
      
      const elapsed = currentTime - lastFrameTimeRef.current
      if (elapsed < currentInterval && isVisibleRef.current) return
      lastFrameTimeRef.current = currentTime - (elapsed % currentInterval)

      // 화면에 보이지 않으면 렌더링 스킵 (성능 최적화)
      if (!isVisibleRef.current) return
      
      // opacity가 0이면 렌더링 스킵 (완전히 숨겨진 경우)
      if (opacity <= 0) return

      // 전역 시작 시간 사용하여 연속성 유지
      // 재마운트되어도 시간이 끊기지 않고 계속 흐름
      const timeElapsed = (Date.now() - sharedWater!.globalStartTime) / 1000
      material.uniforms.uTime.value = timeElapsed

      // 부드러운 마우스 위치 + 속도 보간
      // 선형 보간 함수: a와 b 사이를 t 비율로 보간
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t
      const posSmoothing = 0.16  // 위치 보간 계수 (낮을수록 더 부드럽고 느림)
      const velSmoothing = 0.12  // 속도 보간 계수 (낮을수록 더 부드럽고 느림)
      
      // 공유 부드러운 마우스 상태 업데이트
      if (sharedWater && interactive) {
        // 현재 위치에서 목표 위치로 부드럽게 이동
        sharedWater.smoothMouse.x = lerp(sharedWater.smoothMouse.x, mouseRef.current.x, posSmoothing)
        sharedWater.smoothMouse.y = lerp(sharedWater.smoothMouse.y, mouseRef.current.y, posSmoothing)
        
        // 속도도 부드럽게 보간
        const smVelX = lerp((material.uniforms.uMouseVel.value as THREE.Vector2).x, mouseVelRef.current.x, velSmoothing)
        const smVelY = lerp((material.uniforms.uMouseVel.value as THREE.Vector2).y, mouseVelRef.current.y, velSmoothing)

        // 감쇠 로직: 마우스가 멈추면 강도와 속도가 서서히 감소
        const timeSinceMove = Date.now() - lastMouseMoveRef.current
        if (timeSinceMove > 100) {
           // 100ms 후부터 강도가 서서히 감소 (0.98 = 2% 감소)
           mouseRef.current.strength *= 0.98
        }
        if (timeSinceMove > 120) {
           // 120ms 후부터 속도가 서서히 감소 (0.92 = 8% 감소)
           mouseVelRef.current.x *= 0.92
           mouseVelRef.current.y *= 0.92
        }

        // 유니폼 적용: 셰이더에 마우스 상태 전달
        material.uniforms.uMouse.value.set(sharedWater.smoothMouse.x, sharedWater.smoothMouse.y)
        material.uniforms.uMouseStrength.value = mouseRef.current.strength
        material.uniforms.uMouseVel.value.set(smVelX, smVelY)
      }

      // 캔버스 소유권 확인 및 회수
      // 다른 인스턴스(모달 등)가 사용 중이다가 닫혔을 때, 
      // 여전히 살아있는 인스턴스(배경)가 캔버스를 다시 가져옴
      if (sharedWater) {
        if (sharedWater.currentOwnerId === null && isVisibleRef.current) {
          sharedWater.currentOwnerId = instanceId
        }
        
        if (sharedWater.currentOwnerId === instanceId) {
          if (renderer.domElement.parentElement !== container) {
            container.appendChild(renderer.domElement)
          }
        } else {
          // 내가 소유자가 아니면 렌더링 스킵
          return
        }
      }

      // 씬 렌더링
      renderer.render(scene, camera)
    }
    animate(0)

    // 리사이즈 핸들러
    // 창 크기가 변경되면 렌더러와 해상도 유니폼 업데이트
    const handleResize = () => {
      if (!containerRef.current || !renderer || !material) return
      
      const newWidth = containerRef.current.clientWidth
      const newHeight = containerRef.current.clientHeight
      
      renderer.setSize(newWidth, newHeight)
      material.uniforms.uResolution.value.set(newWidth, newHeight)
    }

    // Intersection Observer - 보이지 않을 때 렌더링 일시 중지
    // 탭 전환이나 스크롤로 화면 밖에 있을 때 불필요한 렌더링 방지
    let intersectionObserver: IntersectionObserver | null = null
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            isVisibleRef.current = entry.isIntersecting  // 화면에 보이는지 여부 업데이트
          })
        },
        { threshold: 0, rootMargin: '-10% 0px -10% 0px' }  // 10% 정도 화면에서 벗어나면 즉시 중단
      )
      if (container) {
        intersectionObserver.observe(container)
      }
    }

    // 이벤트 리스너 - pointer-events: none이어도 window에서 이벤트 캐치
    window.addEventListener('resize', handleResize)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchmove', handleTouchMove as EventListener, { passive: true })

    // 정리 함수 - 컴포넌트 언마운트 시 실행
    return () => {
      if (intersectionObserver) {
        intersectionObserver.disconnect()  // Observer 해제
      }
      
      // 소유권 반납
      if (sharedWater && sharedWater.currentOwnerId === instanceId) {
        sharedWater.currentOwnerId = null
      }

      // 이벤트 리스너 제거
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove as EventListener)
      
      // 애니메이션 프레임 취소
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current)
      }
      
      // 캔버스 분리하지만 공유 WebGL 리소스는 살려둠 (재마운트 시 재컴파일 방지)
      const r = rendererRef.current
      if (r && r.domElement.parentElement === container) {
        container.removeChild(r.domElement)
      }
    }
  }, [/* handleMouseMove, handleTouchMove */])

  return (
    <div 
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{ 
        opacity,
        pointerEvents: 'none',
        zIndex: 0,
        position: 'absolute'
      }}
    />
  )
})

export default PensieveWaterBackground

