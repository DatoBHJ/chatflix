'use client'

import React, { useRef, useEffect, useState } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  opacity: number
}

interface InteractiveBackgroundProps {
  className?: string
}

export function InteractiveBackground({ className = '' }: InteractiveBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particles = useRef<Particle[]>([])
  const mouse = useRef({ x: 0, y: 0 })
  const animationId = useRef<number | undefined>(undefined)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Mouse move handler
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX
      mouse.current.y = e.clientY
      
      // Create new particles near mouse
      if (Math.random() < 0.3) {
        createParticle(e.clientX, e.clientY)
      }
    }

    // Create particle
    const createParticle = (x: number, y: number) => {
      const particle: Particle = {
        x: x + (Math.random() - 0.5) * 50,
        y: y + (Math.random() - 0.5) * 50,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        life: 0,
        maxLife: Math.random() * 60 + 30,
        size: Math.random() * 3 + 1,
        opacity: 1
      }
      particles.current.push(particle)
      
      // Limit particle count
      if (particles.current.length > 100) {
        particles.current.shift()
      }
    }

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Update and draw particles
      particles.current = particles.current.filter(particle => {
        particle.life++
        particle.x += particle.vx
        particle.y += particle.vy
        
        // Apply gravity and friction
        particle.vy += 0.02
        particle.vx *= 0.995
        particle.vy *= 0.995
        
        // Fade out over time
        particle.opacity = 1 - (particle.life / particle.maxLife)
        
        // Draw particle
        if (particle.opacity > 0) {
          ctx.save()
          ctx.globalAlpha = particle.opacity * 0.7
          
          // Matrix green color with some variation
          const greenValue = Math.floor(255 * (0.3 + particle.opacity * 0.7))
          ctx.fillStyle = `rgb(0, ${greenValue}, 0)`
          
          // Draw a small glowing circle
          ctx.beginPath()
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
          ctx.fill()
          
          // Add glow effect
          ctx.shadowBlur = 10
          ctx.shadowColor = `rgb(0, ${greenValue}, 0)`
          ctx.beginPath()
          ctx.arc(particle.x, particle.y, particle.size * 0.5, 0, Math.PI * 2)
          ctx.fill()
          
          ctx.restore()
        }
        
        return particle.life < particle.maxLife
      })
      
      // Connect nearby particles with lines
      for (let i = 0; i < particles.current.length; i++) {
        for (let j = i + 1; j < particles.current.length; j++) {
          const p1 = particles.current[i]
          const p2 = particles.current[j]
          const distance = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
          
          if (distance < 80) {
            ctx.save()
            ctx.globalAlpha = (1 - distance / 80) * p1.opacity * p2.opacity * 0.3
            ctx.strokeStyle = '#00ff41'
            ctx.lineWidth = 0.5
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.stroke()
            ctx.restore()
          }
        }
      }
      
      animationId.current = requestAnimationFrame(animate)
    }

    // Start animation
    animate()
    window.addEventListener('mousemove', handleMouseMove)
    
    // Create some initial particles
    for (let i = 0; i < 10; i++) {
      createParticle(
        Math.random() * canvas.width,
        Math.random() * canvas.height
      )
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('mousemove', handleMouseMove)
      if (animationId.current) {
        cancelAnimationFrame(animationId.current)
      }
    }
  }, [isVisible])

  // Hide background on mobile for performance
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
      className={`fixed inset-0 pointer-events-none z-0 ${className}`}
      style={{ 
        background: 'transparent',
        mixBlendMode: 'screen'
      }}
    />
  )
} 