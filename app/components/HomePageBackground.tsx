'use client'

import { useMemo } from 'react'
import { useBackgroundImage } from '@/app/hooks/useBackgroundImage'
import { useBackgroundImageBrightness } from '@/app/hooks/useBackgroundImageBrightness'

interface HomePageBackgroundProps {
  user: { id?: string } | null
}

export function HomePageBackground({ user }: HomePageBackgroundProps) {
  const { currentBackground } = useBackgroundImage(user?.id, {
    refreshOnMount: true,
    preload: true,
    useSupabase: false
  })

  const { isVeryDark, isVeryBright, brightness } = useBackgroundImageBrightness(currentBackground)

  const overlayColor = useMemo(() => {
    if (isVeryDark) {
      return 'rgba(255, 255, 255, 0.125)'
    }
    if (isVeryBright || brightness > 100) {
      const opacity = Math.min(0.15 + (brightness - 100) / 155 * 0.2, 0.35)
      return `rgba(0, 0, 0, ${opacity})`
    }
    return undefined
  }, [isVeryDark, isVeryBright, brightness])

  return (
    <>
      <div
        className="full-viewport-fixed w-full bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: currentBackground ? `url("${currentBackground.replace(/"/g, '\\"')}")` : undefined,
          zIndex: 0
        }}
      />
      {overlayColor && (
        <div
          className="full-viewport-fixed w-full pointer-events-none"
          style={{
            backgroundColor: overlayColor,
            zIndex: 0.5
          }}
        />
      )}
    </>
  )
}
