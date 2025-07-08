'use client'

import React, { useRef, useEffect, useState } from 'react'

// 색상 관리를 위한 유틸리티 함수
const hexToRgba = (hex: string, alpha: number = 1): string => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// 색상 팔레트 정의
const COLORS = {
  // 다크 모드 색상
  dark: {
    globeGradient: {
      start: '#14325A',
      middle: '#050F28', 
      end: '#000514'
    },
    globeBorder: '#3296FF',
    gridLines: '#3296FF',
    activityPoint: '#32AAFF',
    activityRing: '#32AAFF',
    activityStream: '#32AAFF'
  },
  // 라이트 모드 색상
  light: {
    globeGradient: {
      start: '#FFFFFF',
      middle: '#F5F8FA',
      end: '#EBF0F5'
    },
    globeBorder: '#C8D2DC',
    gridLines: '#DCE1E6',
    activityPoint: '#6496C8',
    activityRing: '#6496C8',
    activityStream: '#6496C8'
  }
} as const

interface GlobalAIActivityBackgroundProps {
  className?: string
}

export function GlobalAIActivityBackground({ className = '' }: GlobalAIActivityBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationId = useRef<number | undefined>(undefined)
  const [isVisible, setIsVisible] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const rotation = useRef(0)
  const mouse = useRef({ x: 0, y: 0, isDown: false })

  // 3D 구 좌표를 2D 화면 좌표로 변환
  const sphereToScreen = (lat: number, lng: number, radius: number, centerX: number, centerY: number, rotationY: number) => {
    // 위도/경도를 라디안으로 변환
    const latRad = (lat * Math.PI) / 180
    const lngRad = ((lng + rotationY) * Math.PI) / 180
    
    // 3D 구 좌표 계산
    const x = radius * Math.cos(latRad) * Math.cos(lngRad)
    const y = radius * Math.sin(latRad)
    const z = radius * Math.cos(latRad) * Math.sin(lngRad)
    
    // 2D 투영 (원근감 제거하여 정확한 구체 표면 유지)
    const screenX = centerX + x
    const screenY = centerY - y
    
    return { 
      x: screenX, 
      y: screenY, 
      z: z,
      visible: z > -radius * 0.1 // 뒷면 컬링을 더 정확하게
    }
  }

  // 데스스타 홀로그램 그리기
  const drawDeathStarHologram = (ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number, rotation: number) => {
    const theme = isDarkMode ? COLORS.dark : COLORS.light;
    
    // 1. 홀로그램 외부 글로우
    ctx.save();
    ctx.shadowBlur = isDarkMode ? 30 : 20;
    ctx.shadowColor = isDarkMode ? hexToRgba(theme.globeBorder, 0.3) : hexToRgba(theme.globeBorder, 0.5);
    
    // 2. 주 구체
    const gradient = ctx.createRadialGradient(centerX - radius / 2, centerY - radius / 2, 0, centerX, centerY, radius);
    if (isDarkMode) {
      gradient.addColorStop(0, hexToRgba(theme.globeGradient.start, 0.8))
      gradient.addColorStop(0.7, hexToRgba(theme.globeGradient.middle, 0.85))
      gradient.addColorStop(1, hexToRgba(theme.globeGradient.end, 0.95))
    } else {
      gradient.addColorStop(0, hexToRgba(theme.globeGradient.start, 0.4))
      gradient.addColorStop(0.5, hexToRgba(theme.globeGradient.middle, 0.3))
      gradient.addColorStop(1, hexToRgba(theme.globeGradient.end, 0.5))
    }
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. 주 구체 외곽선
    ctx.strokeStyle = isDarkMode ? hexToRgba(theme.globeBorder, 0.2) : hexToRgba(theme.globeBorder, 0.4);
    ctx.lineWidth = isDarkMode ? 1 : 0.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // 클리핑 마스크 설정 - 모든 격자선이 구체 내부에만 그려지도록
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();

    // 4. 격자선
    ctx.strokeStyle = isDarkMode ? hexToRgba(theme.gridLines, 0.1) : hexToRgba(theme.gridLines, 0.3);
    ctx.lineWidth = isDarkMode ? 0.5 : 0.3;
    
    // 위도선
    for (let lat = -75; lat <= 75; lat += 15) {
        if (lat === 0) continue; // 적도선은 트렌치로 대체
        ctx.beginPath();
        let firstPoint = true;
        for (let lng = -180; lng <= 180; lng += 2) {
            const p = sphereToScreen(lat, lng, radius, centerX, centerY, rotation);
            if (p.visible) {
                if (firstPoint) {
                    ctx.moveTo(p.x, p.y);
                    firstPoint = false;
                } else {
                    ctx.lineTo(p.x, p.y);
                }
            } else if (!firstPoint) {
                // 보이지 않는 부분에서 선을 끊음
                ctx.stroke();
                ctx.beginPath();
                firstPoint = true;
            }
        }
        ctx.stroke();
    }
    
    // 경도선
    for (let lng = 0; lng < 360; lng += 15) {
        ctx.beginPath();
        let firstPoint = true;
        for (let lat = -90; lat <= 90; lat += 2) {
            const p = sphereToScreen(lat, lng, radius, centerX, centerY, rotation);
            if (p.visible) {
                if (firstPoint) {
                    ctx.moveTo(p.x, p.y);
                    firstPoint = false;
                } else {
                    ctx.lineTo(p.x, p.y);
                }
            } else if (!firstPoint) {
                // 보이지 않는 부분에서 선을 끊음
                ctx.stroke();
                ctx.beginPath();
                firstPoint = true;
            }
        }
        ctx.stroke();
    }
    
    // 5. 적도 트렌치 (더 두껍게)
    ctx.strokeStyle = isDarkMode ? hexToRgba(theme.gridLines, 0.4) : hexToRgba(theme.gridLines, 0.6);
    ctx.lineWidth = isDarkMode ? 1.5 : 1;
    ctx.beginPath();
    let firstTrenchPoint = true;
    for (let lng = -180; lng <= 180; lng += 1) {
        const p = sphereToScreen(0, lng, radius, centerX, centerY, rotation);
        if (p.visible) {
            if (firstTrenchPoint) {
                ctx.moveTo(p.x, p.y);
                firstTrenchPoint = false;
            } else {
                ctx.lineTo(p.x, p.y);
            }
        } else if (!firstTrenchPoint) {
            ctx.stroke();
            ctx.beginPath();
            firstTrenchPoint = true;
        }
    }
    ctx.stroke();

    ctx.restore(); // 클리핑 마스크 해제

    // 6. 슈퍼레이저 접시 (3D 효과 개선)
    const dishLat = 20;
    const dishLng = 45;
    const dishAngularRadius = 15; // 접시의 각도반경 (degrees)
    const dishDepth = radius * 0.08; // 접시가 들어간 깊이

    const dishCenterPoint = sphereToScreen(dishLat, dishLng, radius, centerX, centerY, rotation);

    if (dishCenterPoint.visible) {
        // 접시의 위, 아래, 왼쪽, 오른쪽 점을 구해서 타원의 축과 회전을 계산
        const pTop = sphereToScreen(dishLat + dishAngularRadius, dishLng, radius, centerX, centerY, rotation);
        const pBot = sphereToScreen(dishLat - dishAngularRadius, dishLng, radius, centerX, centerY, rotation);
        // 경도 계산 시 위도에 따른 왜곡 보정
        const lngOffset = dishAngularRadius / Math.cos(dishLat * Math.PI / 180);
        const pLeft = sphereToScreen(dishLat, dishLng - lngOffset, radius, centerX, centerY, rotation);
        const pRight = sphereToScreen(dishLat, dishLng + lngOffset, radius, centerX, centerY, rotation);

        // 타원의 두 반지름 계산
        const radiusX = Math.hypot(pRight.x - pLeft.x, pRight.y - pLeft.y) / 2;
        const radiusY = Math.hypot(pBot.x - pTop.x, pBot.y - pTop.y) / 2;
        
        // 타원의 회전각 계산
        const rotationAngle = Math.atan2(pTop.y - pBot.y, pTop.x - pBot.x) + Math.PI / 2;

        // 접시의 Z 깊이 계산 (구체 표면에서 얼마나 들어갔는지)
        const dishNormalZ = dishCenterPoint.z / radius; // 접시 중심의 법선 벡터 Z 성분

        // 클리핑 마스크 설정 (구체 바깥으로 나가지 않도록)
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.clip();
        
        // 접시 외곽 테두리 (구체 표면과 만나는 부분)
        ctx.strokeStyle = isDarkMode 
            ? hexToRgba(theme.gridLines, 0.6) 
            : hexToRgba(theme.gridLines, 0.8);
        ctx.lineWidth = isDarkMode ? 1.5 : 1;
        ctx.beginPath();
        ctx.ellipse(dishCenterPoint.x, dishCenterPoint.y, radiusX, radiusY, rotationAngle, 0, Math.PI * 2);
        ctx.stroke();

        // 접시 내부 그림자 (움푹 들어간 느낌)
        const shadowGradient = ctx.createRadialGradient(
            dishCenterPoint.x, dishCenterPoint.y, 0,
            dishCenterPoint.x, dishCenterPoint.y, Math.max(radiusX, radiusY)
        );
        
        // 그림자 강도는 접시가 얼마나 정면을 향하는지에 따라 달라짐
        const shadowIntensity = Math.max(0.1, Math.abs(dishNormalZ) * 0.7);
        
        shadowGradient.addColorStop(0, isDarkMode 
            ? hexToRgba('#000000', shadowIntensity * 0.8) 
            : hexToRgba('#000000', shadowIntensity * 0.4));
        shadowGradient.addColorStop(0.7, isDarkMode 
            ? hexToRgba('#000000', shadowIntensity * 0.4) 
            : hexToRgba('#000000', shadowIntensity * 0.2));
        shadowGradient.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = shadowGradient;
        ctx.beginPath();
        ctx.ellipse(dishCenterPoint.x, dishCenterPoint.y, radiusX * 0.95, radiusY * 0.95, rotationAngle, 0, Math.PI * 2);
        ctx.fill();
        
        // 깊이감을 위한 동심원 그리기 (들어간 부분의 층계)
        for (let i = 0.9; i >= 0.2; i -= 0.15) {
            const scale = Math.pow(i, 1.2); // 안으로 갈수록 더 좁아지도록
            const currentRadiusX = radiusX * scale;
            const currentRadiusY = radiusY * scale;
            
            // 깊이에 따른 오프셋 (들어간 느낌을 위해)
            const depthOffset = (1 - i) * dishDepth * dishNormalZ * 0.3;
            const offsetX = dishCenterPoint.x + depthOffset * Math.cos(rotationAngle);
            const offsetY = dishCenterPoint.y + depthOffset * Math.sin(rotationAngle);

            const ringOpacity = (0.6 - i * 0.3) * Math.abs(dishNormalZ);
            ctx.strokeStyle = isDarkMode 
                ? hexToRgba(theme.gridLines, ringOpacity) 
                : hexToRgba(theme.gridLines, ringOpacity * 1.2);
            ctx.lineWidth = isDarkMode ? 0.8 : 0.6;
            
            ctx.beginPath();
            ctx.ellipse(offsetX, offsetY, currentRadiusX, currentRadiusY, rotationAngle, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 중앙의 빛나는 "눈" (가장 깊은 부분)
        const eyeScale = 0.12;
        const eyeRadiusX = radiusX * eyeScale;
        const eyeRadiusY = radiusY * eyeScale;
        
        // 중앙 눈의 위치도 깊이에 따라 오프셋
        const eyeDepthOffset = dishDepth * dishNormalZ * 0.5;
        const eyeX = dishCenterPoint.x + eyeDepthOffset * Math.cos(rotationAngle);
        const eyeY = dishCenterPoint.y + eyeDepthOffset * Math.sin(rotationAngle);
        
        // 눈의 밝기도 각도에 따라 조절
        const eyeBrightness = Math.max(0.3, Math.abs(dishNormalZ));
        
        ctx.fillStyle = isDarkMode 
            ? hexToRgba(theme.activityPoint, eyeBrightness) 
            : hexToRgba(theme.activityPoint, eyeBrightness * 0.8);
        ctx.shadowColor = isDarkMode ? theme.activityPoint : theme.activityPoint;
        ctx.shadowBlur = 8 * eyeBrightness;
        
        ctx.beginPath();
        ctx.ellipse(eyeX, eyeY, eyeRadiusX, eyeRadiusY, rotationAngle, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // 그림자 초기화
        
        ctx.restore(); // 클리핑 마스크 해제
    }
  }

  // AI 활동 포인트 그리기 (Apple 스타일)
  const drawActivityPoints = (ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number, rotation: number, time: number) => {
    // Implementation of drawActivityPoints function
  }

  // 테마 감지
  useEffect(() => {
    const detectTheme = () => {
      const htmlElement = document.documentElement
      const themeAttribute = htmlElement.getAttribute('data-theme')
      
      let isDark = false
      
      if (themeAttribute === 'dark') {
        isDark = true
      } else if (themeAttribute === 'light') {
        isDark = false
      } else if (themeAttribute === 'system' || !themeAttribute) {
        // 시스템 테마를 따름
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      }
      
      setIsDarkMode(isDark)
    }

    detectTheme()

    // 테마 변경 감지
    const observer = new MutationObserver(detectTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    })

    // 시스템 테마 변경 감지 (system 모드일 때만)
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = () => {
      const themeAttribute = document.documentElement.getAttribute('data-theme')
      if (themeAttribute === 'system' || !themeAttribute) {
        detectTheme()
      }
    }
    mediaQuery.addEventListener('change', handleSystemThemeChange)

    return () => {
      observer.disconnect()
      mediaQuery.removeEventListener('change', handleSystemThemeChange)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Canvas 크기 설정
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // 마우스 이벤트
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX
      mouse.current.y = e.clientY
      
             if (mouse.current.isDown) {
         // 마우스 드래그로 지구본 회전
         const deltaX = e.movementX
         rotation.current += deltaX * 0.5
       }
    }

    const handleMouseDown = () => {
      mouse.current.isDown = true
    }

    const handleMouseUp = () => {
      mouse.current.isDown = false
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)

    // 애니메이션 루프
    const animate = (time: number) => {
      if (!canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 홀로그램 글리치 효과
      const glitch = Math.random() > 0.98;
      if (glitch) {
        ctx.save();
        ctx.translate(Math.random() * 2 - 1, Math.random() * 2 - 1);
      }
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.min(canvas.width, canvas.height) * 0.25;
      
      // 자동 회전 (마우스 드래그 중이 아닐 때)
      if (!mouse.current.isDown) {
        rotation.current += 0.15;
      }
       
      // 데스스타 그리기
      drawDeathStarHologram(ctx, centerX, centerY, radius, rotation.current);
      
      if (glitch) {
        ctx.restore();
      }

      // 홀로그램 스캔라인 효과
      ctx.save();
      ctx.globalAlpha = 0.05;
      ctx.strokeStyle = isDarkMode ? COLORS.dark.gridLines : COLORS.light.gridLines;
      ctx.lineWidth = 1;
      for (let y = 0; y < canvas.height; y += 3) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
      }
      ctx.restore();
      
      animationId.current = requestAnimationFrame(animate);
    }

    animate(0)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      if (animationId.current) {
        cancelAnimationFrame(animationId.current)
      }
    }
     }, [isVisible, isDarkMode])

  // 모바일에서는 성능을 위해 비활성화
  useEffect(() => {
    const checkMobile = () => {
      setIsVisible(window.innerWidth > 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  if (!isVisible) return null

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-auto z-0 cursor-grab active:cursor-grabbing ${className}`}
      style={{ 
        background: 'transparent',
        opacity: 1
      }}
    />
  )
} 