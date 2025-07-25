'use client'
import React, { useRef, useEffect, useState } from 'react';

// 성능을 위해 타입을 더 가볍게 조정
interface Star {
  x: number; y: number; radius: number; baseOpacity: number; twinkleOffset: number;
}
interface ShootingStar {
  x: number; y: number; vx: number; vy: number; life: number;
}

// 상수 정의
const STAR_COUNT = 1000; // 5배 증가 (성능과 밀도의 균형점)
const SHOOTING_STAR_MAX_LIFE = 1.5; // 초
const ROTATION_SPEED = 0.1;

export const StarryNightBackground = () => {
  const [{ width, height }, setDimensions] = useState({ width: 0, height: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // React 상태 대신 ref로 데이터 관리 (리렌더링 방지)
  const starsRef = useRef<Star[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const rotationRef = useRef(0);
  const lastTimeRef = useRef(0);
  const timeToNextShootingStarRef = useRef(0);
  const mountTimeRef = useRef(0); // 마운트 시간 기록

  // 창 크기 변경 감지
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateDimensions = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // 초기 별 데이터 생성
  useEffect(() => {
    if (!width || !height) return;
    
    // 우측 하단에서 가장 먼 점(좌상단)까지의 거리 계산
    const maxDistance = Math.sqrt(width * width + height * height);
    // 어떤 화면에서도 확실히 커버하도록 2배 + 추가 마진
    const safetyMargin = Math.max(width, height) * 0.5; // 추가 안전 마진
    const starFieldRadius = maxDistance * 2 + safetyMargin;
    
    const tempStars: Star[] = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      const random = Math.random();
      let opacity;
      // 밝은 별이 더 많이 보이도록 비율 재조정
      if (random < 0.2) opacity = Math.random() * 0.2 + 0.8; // 20% - 밝은 별 (0.8~1.0)
      else if (random < 0.7) opacity = Math.random() * 0.3 + 0.5; // 50% - 중간 밝기 별 (0.5~0.8)
      else opacity = Math.random() * 0.3 + 0.3; // 30% - 희미한 별 (0.3~0.6)
      
      // 원형 영역 내에 균등하게 분산 배치 (극좌표계 사용)
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.sqrt(Math.random()) * starFieldRadius; // sqrt로 균등 분산
      
      tempStars.push({
        // 우측 하단(width, height)을 중심으로 하는 극좌표계
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        radius: Math.random() * 1.0 + 1.0, // 1.0~2.0 (기존 0.8~1.6에서 증가)
        baseOpacity: opacity,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }
    starsRef.current = tempStars;
    timeToNextShootingStarRef.current = Math.random() * 4000 + 2000;
  }, [width, height]);

  // 메인 애니메이션 루프 (Canvas 렌더링)
  useEffect(() => {
    if (!width || !height) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);

      if (!mountTimeRef.current) {
        mountTimeRef.current = time;
      }
      if (!lastTimeRef.current) {
        lastTimeRef.current = time;
        return;
      }

      const deltaTime = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;
      
      // 0. 페이드 인 효과 계산
      const elapsedTime = (time - mountTimeRef.current) / 1000;
      const fadeInDuration = 10; // 10초
      const finalOpacity = 0.7;
      let currentOpacity = Math.min(finalOpacity, (elapsedTime / fadeInDuration) * finalOpacity);
      
      // 페이드인 완료 후 고정
      if (elapsedTime >= fadeInDuration) {
        currentOpacity = finalOpacity;
      }

      if (containerRef.current) {
        containerRef.current.style.opacity = currentOpacity.toString();
      }

      // 1. 캔버스 초기화
      ctx.clearRect(0, 0, width, height);

      // 2. 캔버스 상태 저장 및 변환 (회전, 우측 하단 기준)
      ctx.save();
      const maxDistance = Math.sqrt(width * width + height * height);
      const safetyMargin = Math.max(width, height) * 0.5;
      const starFieldRadius = maxDistance * 2 + safetyMargin;
      
      // 원점을 우측 하단으로 이동
      ctx.translate(width, height);
      // 회전
      rotationRef.current = (rotationRef.current + ROTATION_SPEED * deltaTime * 10) % 360;
      ctx.rotate(rotationRef.current * Math.PI / 180);

      // 3. 별 그리기 (화면 영역 기반 최적화)
      ctx.fillStyle = 'white';
      const now = time * 0.001;
      
      // 현재 화면에서 보일 수 있는 최대 거리 계산 (성능 최적화)
      const screenDiagonal = Math.sqrt(width * width + height * height);
      const maxVisibleDistance = screenDiagonal * 1.5; // 약간의 여유
      
      let renderedStars = 0;
      starsRef.current.forEach(star => {
        // 거리 기반 컬링: 너무 멀리 있는 별은 렌더링하지 않음
        const distanceFromCenter = Math.sqrt(star.x * star.x + star.y * star.y);
        if (distanceFromCenter > maxVisibleDistance) return;
        
        const twinkle = Math.sin((now + star.twinkleOffset) * 3) * 0.1 + 0.9; // 미묘한 깜빡임: 0.8~1.0 범위
        ctx.globalAlpha = star.baseOpacity * twinkle;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
        renderedStars++;
      });
      ctx.globalAlpha = 1; // Alpha 초기화
      

      // 4. 별똥별 생성
      timeToNextShootingStarRef.current -= deltaTime * 1000;
      if (timeToNextShootingStarRef.current <= 0) {
        if (Math.random() < 0.5) {
          const angle = Math.random() * Math.PI * 2;
          // 별똥별은 보이는 영역 근처에서만 생성 (성능 최적화)
          const distance = Math.sqrt(Math.random()) * maxVisibleDistance * 0.8;
          const speed = Math.random() * 150 + 150;
          const shootingAngle = Math.random() * Math.PI * 2;
          
          shootingStarsRef.current.push({
            // 우측 하단을 중심으로 하는 원형 영역에서 별똥별 생성
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
            vx: Math.cos(shootingAngle) * speed,
            vy: Math.sin(shootingAngle) * speed,
            life: 0,
          });
        }
        timeToNextShootingStarRef.current = Math.random() * 4000 + 2000;
      }
      
      // 5. 별똥별 그리기 및 제거 (거리 기반 최적화)
      shootingStarsRef.current = shootingStarsRef.current.filter(star => {
        star.life += deltaTime;
        if (star.life >= SHOOTING_STAR_MAX_LIFE) return false;

        // 거리 기반 컬링 적용
        const distanceFromCenter = Math.sqrt(star.x * star.x + star.y * star.y);
        if (distanceFromCenter > maxVisibleDistance * 1.2) return false; // 별똥별은 약간 더 관대하게

        star.x += star.vx * deltaTime;
        star.y += star.vy * deltaTime;

        let opacity;
        const fadeInDuration = 0.5;
        const fadeOutDuration = 0.5;
        if (star.life < fadeInDuration) opacity = star.life / fadeInDuration;
        else if (star.life > SHOOTING_STAR_MAX_LIFE - fadeOutDuration) opacity = 1 - (star.life - (SHOOTING_STAR_MAX_LIFE - fadeOutDuration)) / fadeOutDuration;
        else opacity = 1;

        const tailLength = 100;
        const x2 = star.x - star.vx * tailLength / Math.sqrt(star.vx**2 + star.vy**2);
        const y2 = star.y - star.vy * tailLength / Math.sqrt(star.vx**2 + star.vy**2);

        const gradient = ctx.createLinearGradient(star.x, star.y, x2, y2);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(star.x, star.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        return true;
      });

      // 6. 캔버스 상태 복원
      ctx.restore();
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [width, height]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        backgroundColor: 'var(--background)', overflow: 'hidden', zIndex: -1,
        opacity: 0, // 초기 깜빡임 방지를 위해 0으로 시작
      }}
    >
      <div
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'linear-gradient(45deg, rgba(0,0,0,0.05) 0%, transparent 50%, rgba(0,0,0,0.05) 100%)',
          zIndex: 1, pointerEvents: 'none',
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          filter: 'blur(0.5px)',
          width: '100vw',
          height: '100vh'
        }}
      />
    </div>
  );
}; 