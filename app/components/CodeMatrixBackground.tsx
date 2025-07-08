'use client'

import React, { useRef, useEffect, useState } from 'react'

interface CodeColumn {
  x: number
  y: number
  speed: number
  codes: string[]
  opacity: number[]
  length: number
}

interface CodeMatrixBackgroundProps {
  className?: string
}

// 기본 fallback 코드 스니펫들 (API 실패 시 사용)
const FALLBACK_SNIPPETS = [
  'useState()', 'useEffect()', 'const [state, setState]', 'async/await',
  'Promise.resolve()', 'fetch(api)', 'map(item =>', 'filter(x)',
  'console.log()', 'return (', '}).then(', 'import React', 'export default',
  '=>', '===', '!==', '&&', '||', '??', 'true', 'false', 'null', 'undefined'
]

export function CodeMatrixBackground({ className = '' }: CodeMatrixBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const columns = useRef<CodeColumn[]>([])
  const animationId = useRef<number | undefined>(undefined)
  const [isVisible, setIsVisible] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [codeSnippets, setCodeSnippets] = useState<string[]>(FALLBACK_SNIPPETS)
  const [isLoadingCode, setIsLoadingCode] = useState(true)

  // 테마 감지
  useEffect(() => {
    const detectTheme = () => {
      const htmlElement = document.documentElement
      const isDark = htmlElement.classList.contains('dark') || 
                    htmlElement.getAttribute('data-theme') === 'dark' ||
                    (htmlElement.getAttribute('data-theme') === 'system' && 
                     window.matchMedia('(prefers-color-scheme: dark)').matches) ||
                    (!htmlElement.getAttribute('data-theme') && 
                     window.matchMedia('(prefers-color-scheme: dark)').matches)
      setIsDarkMode(isDark)
    }

    detectTheme()

    // 테마 변경 감지
    const observer = new MutationObserver(detectTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    })

    // 시스템 테마 변경 감지
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', detectTheme)

    return () => {
      observer.disconnect()
      mediaQuery.removeEventListener('change', detectTheme)
    }
  }, [])

  // Load actual project code
  useEffect(() => {
    async function loadProjectCode() {
      try {
        setIsLoadingCode(true)
        const response = await fetch('/api/code-snippets')
        if (response.ok) {
          const data = await response.json()
          if (data.snippets && data.snippets.length > 0) {
            setCodeSnippets(data.snippets)
            console.log(`Loaded ${data.count} code snippets from ${data.source}`)
          }
        }
      } catch (error) {
        console.error('Failed to load project code:', error)
        // Keep using fallback snippets
      } finally {
        setIsLoadingCode(false)
      }
    }

    loadProjectCode()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Create a new column
    const createColumn = (x: number) => {
      const length = Math.floor(Math.random() * 15) + 5 // 5-20 code snippets per column
      const codes: string[] = []
      const opacity: number[] = []
      
      for (let i = 0; i < length; i++) {
        codes.push(codeSnippets[Math.floor(Math.random() * codeSnippets.length)])
        opacity.push(1 - (i / length)) // Fade from top to bottom
      }
      
      const column: CodeColumn = {
        x,
        y: Math.random() * -2000, // Start above screen
        speed: Math.random() * 2 + 1, // 1-3 speed
        codes,
        opacity,
        length
      }
      
      columns.current.push(column)
    }

    // Initialize columns
    const initializeColumns = () => {
      const columnWidth = 120 // Wider columns for code
      const numColumns = Math.ceil(canvas.width / columnWidth)
      
      columns.current = []
      for (let i = 0; i < numColumns; i++) {
        createColumn(i * columnWidth)
      }
    }

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      
      // Reinitialize columns when canvas resizes
      initializeColumns()
    }
    
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Animation loop
    const animate = () => {
      // Create a subtle trail effect by not completely clearing - 테마별 색상
      if (isDarkMode) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
      } else {
        // 라이트 모드: 약간 어두운 배경으로 트레일 효과
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // Update and draw columns
      columns.current = columns.current.filter(column => {
        column.y += column.speed
        
        // Draw the code snippets in this column
        for (let i = 0; i < column.length; i++) {
          const codeY = column.y + (i * 20) // 20px spacing between lines
          
          // Skip if outside screen
          if (codeY < -20 || codeY > canvas.height + 20) continue
          
          // Calculate opacity with trail effect
          let opacity = column.opacity[i]
          
          // Make the first few characters brighter (the "head" of the column)
          if (i < 3) {
            opacity = Math.min(1, opacity + 0.5)
          }
          
          // Matrix color with opacity - 테마별 색상
          if (isDarkMode) {
            // 다크 모드: 기존 매트릭스 그린
            const greenValue = Math.floor(255 * (0.3 + opacity * 0.7))
            ctx.fillStyle = `rgba(0, ${greenValue}, 0, ${opacity})`
            ctx.shadowColor = `rgba(0, ${greenValue}, 0, 0.8)`
          } else {
            // 라이트 모드: 더 진한 다크 그린/블루 조합
            const darkGreen = Math.floor(120 * (0.4 + opacity * 0.6))
            const darkBlue = Math.floor(80 * (0.3 + opacity * 0.5))
            ctx.fillStyle = `rgba(0, ${darkGreen}, ${darkBlue}, ${Math.min(1, opacity + 0.3)})`
            ctx.shadowColor = `rgba(0, ${darkGreen}, ${darkBlue}, ${Math.min(1, opacity + 0.2)})`
          }
          
          // Set font (monospace for code)
          ctx.font = `${12 + Math.random() * 4}px 'Courier New', monospace`
          
          // Add glow effect for brighter characters - 라이트 모드에서 더 강화
          if (opacity > 0.7) {
            ctx.shadowBlur = isDarkMode ? 8 : 12
          } else {
            ctx.shadowBlur = isDarkMode ? 0 : 4
          }
          
          // Draw the code snippet
          ctx.fillText(column.codes[i], column.x, codeY)
        }
        
        // Remove column if it's completely off screen
        if (column.y > canvas.height + (column.length * 20)) {
          // Create a new column to replace it
          setTimeout(() => {
            createColumn(column.x)
          }, Math.random() * 3000 + 1000) // Random delay 1-4 seconds
          return false
        }
        
        return true
      })
      
      // Randomly change some code snippets for dynamic effect
      if (Math.random() < 0.02) { // 2% chance each frame
        columns.current.forEach(column => {
          if (Math.random() < 0.3) { // 30% chance for each column
            const randomIndex = Math.floor(Math.random() * column.codes.length)
            column.codes[randomIndex] = codeSnippets[Math.floor(Math.random() * codeSnippets.length)]
          }
        })
      }
      
      animationId.current = requestAnimationFrame(animate)
    }

    // Mouse interaction - make nearby code brighter
    const handleMouseMove = (e: MouseEvent) => {
      const mouseX = e.clientX
      const mouseY = e.clientY
      
      columns.current.forEach(column => {
        const distance = Math.abs(column.x - mouseX)
        if (distance < 100) {
          // Boost opacity for nearby columns
          for (let i = 0; i < column.opacity.length; i++) {
            const codeY = column.y + (i * 20)
            const yDistance = Math.abs(codeY - mouseY)
            if (yDistance < 50) {
              column.opacity[i] = Math.min(1, column.opacity[i] + 0.3)
            }
          }
        }
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    
    // Start animation
    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('mousemove', handleMouseMove)
      if (animationId.current) {
        cancelAnimationFrame(animationId.current)
      }
    }
  }, [isVisible, codeSnippets, isDarkMode])

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
        background: isDarkMode ? 'transparent' : 'rgba(248, 250, 252, 0.3)', // 라이트 모드에서 약간의 배경
        opacity: isDarkMode ? 0.6 : 0.75, // 라이트 모드에서 더 진하게
        mixBlendMode: isDarkMode ? 'normal' : 'multiply' // 라이트 모드에서 블렌드 모드 사용
      }}
    />
  )
} 