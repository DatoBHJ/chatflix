'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import ImageViewer from './ImageViewer'
import { usePhotoActions } from './usePhotoActions'
import { DEFAULT_BACKGROUNDS } from '../constants/backgrounds'

interface PhotoOverviewSectionProps {
  user: any;
  onBackgroundChange: (backgroundUrl: string, backgroundType: 'default' | 'custom', backgroundId?: string) => void;
}

export default function PhotoOverviewSection({ user, onBackgroundChange }: PhotoOverviewSectionProps) {
  const [isDark, setIsDark] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  
  // ImageViewer state
  const [viewerImages, setViewerImages] = useState<{ src: string; alt: string; id?: string }[]>([])
  const [viewerIndex, setViewerIndex] = useState(0)
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [canSetAsBackground, setCanSetAsBackground] = useState(false)

  // Convert viewer images to the format expected by usePhotoActions
  const convertedImages = viewerImages.map(img => ({
    id: img.id || '',
    url: img.src,
    name: img.alt
  }))

  // Photo actions hook
  const {
    isSettingBackground,
    isSuccess,
    viewerDeletingId,
    handleViewerSetBackground,
    handleViewerDelete
  } = usePhotoActions({
    user,
    images: convertedImages,
    onBackgroundChange,
    handleDeleteBackground: async () => {}, // Showcase images cannot be deleted
    setIsViewerOpen
  })

  // Detect theme changes
  useEffect(() => {
    const detectTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme')
      if (theme === 'dark') {
        setIsDark(true)
      } else if (theme === 'light') {
        setIsDark(false)
      } else {
        // System theme
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        setIsDark(systemDark)
      }
    }

    // Initial detection
    detectTheme()

    // Listen for theme changes
    const observer = new MutationObserver(detectTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    })

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleMediaChange = () => detectTheme()
    mediaQuery.addEventListener('change', handleMediaChange)

    return () => {
      observer.disconnect()
      mediaQuery.removeEventListener('change', handleMediaChange)
    }
  }, [])

  // Touch handling for mobile swipe
  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    
    const maxIndex = DEFAULT_BACKGROUNDS.length - 1
    if (isLeftSwipe && currentImageIndex < maxIndex) {
      setCurrentImageIndex(prev => prev + 1)
    }
    if (isRightSwipe && currentImageIndex > 0) {
      setCurrentImageIndex(prev => prev - 1)
    }
  }

  // Image data - use all default backgrounds directly
  const images = DEFAULT_BACKGROUNDS.map(bg => ({ 
    src: bg.url, 
    alt: bg.name, 
    id: bg.id 
  }))

  // Image click handler
  const handleImageClick = (
    imageIndex: number, 
    imageSet: { src: string; alt: string; id?: string }[], 
    allowWallpaperSetting: boolean = false
  ) => {
    setViewerImages(imageSet)
    setViewerIndex(imageIndex)
    setCanSetAsBackground(allowWallpaperSetting)
    setIsViewerOpen(true)
  }

  return (
    <>
      <div className="max-w-5xl mx-auto">
        {/* Hero Section */}
        <div className="mt-8 sm:mt-12 md:mt-16 lg:mt-20">
        <h1 className="text-[clamp(3rem,10vw,4.5rem)] font-semibold tracking-tight leading-none text-[var(--foreground)] mb-12 sm:mb-12 text-center">
          Discover. Create.<br />Save forever.
        </h1>
        <p className="text-[clamp(1.25rem,5vw,1.5rem)] leading-normal text-[var(--foreground)] max-w-3xl text-center mx-auto">
          Photos brings together everything visual in Chatflix. Search the web for inspiration, create beautiful images instantly, and save everything that resonates with you. All organized in one beautiful gallery.
        </p>
        
        {/* Hero Image Gallery - Search → Edit → Generate */}
        <div className="relative -mx-8 sm:-mx-8 md:-mx-40 lg:-mx-48">
          {/* Mobile: Single Image View with Swipe */}
          <div className="sm:hidden relative">
            <div 
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {/* Search Image */}
              <div className="w-full flex-shrink-0">
                <div 
                  className="aspect-[4/3] relative cursor-pointer group"
                  onClick={() => {
                    const heroImages = [
                      { src: isDark ? "/wallpaper/save-search-dark.png" : "/wallpaper/save-search-light.png", alt: "Search for inspiration" },
                      { src: isDark ? "/wallpaper/save-edit-dark.png" : "/wallpaper/save-edit-light.png", alt: "Edit to perfection" },
                      { src: isDark ? "/wallpaper/save-generate-dark.png" : "/wallpaper/save-generate-light.png", alt: "Generate variations" }
                    ]
                    handleImageClick(0, heroImages, false)
                  }}
                >
                  <Image
                    src={isDark ? "/wallpaper/save-search-dark.png" : "/wallpaper/save-search-light.png"}
                    alt="Search for inspiration"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </div>
              
              {/* Edit Image */}
              <div className="w-full flex-shrink-0">
                <div 
                  className="aspect-[4/3] relative cursor-pointer group"
                  onClick={() => {
                    const heroImages = [
                      { src: isDark ? "/wallpaper/save-search-dark.png" : "/wallpaper/save-search-light.png", alt: "Search for inspiration" },
                      { src: isDark ? "/wallpaper/save-edit-dark.png" : "/wallpaper/save-edit-light.png", alt: "Edit to perfection" },
                      { src: isDark ? "/wallpaper/save-generate-dark.png" : "/wallpaper/save-generate-light.png", alt: "Generate variations" }
                    ]
                    handleImageClick(1, heroImages, false)
                  }}
                >
                  <Image
                    src={isDark ? "/wallpaper/save-edit-dark.png" : "/wallpaper/save-edit-light.png"}
                    alt="Edit to perfection"
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
              
              {/* Generate Image */}
              <div className="w-full flex-shrink-0">
                <div 
                  className="aspect-[4/3] relative cursor-pointer group"
                  onClick={() => {
                    const heroImages = [
                      { src: isDark ? "/wallpaper/save-search-dark.png" : "/wallpaper/save-search-light.png", alt: "Search for inspiration" },
                      { src: isDark ? "/wallpaper/save-edit-dark.png" : "/wallpaper/save-edit-light.png", alt: "Edit to perfection" },
                      { src: isDark ? "/wallpaper/save-generate-dark.png" : "/wallpaper/save-generate-light.png", alt: "Generate variations" }
                    ]
                    handleImageClick(2, heroImages, false)
                  }}
                >
                  <Image
                    src={isDark ? "/wallpaper/save-generate-dark.png" : "/wallpaper/save-generate-light.png"}
                    alt="Generate variations"
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Desktop: Large Image Display */}
          <div className="hidden sm:block">
            <div 
              className="aspect-[16/10] relative cursor-pointer group"
              onClick={() => {
                const heroImages = [
                  { src: isDark ? "/wallpaper/save-search-dark.png" : "/wallpaper/save-search-light.png", alt: "Search for inspiration" },
                  { src: isDark ? "/wallpaper/save-edit-dark.png" : "/wallpaper/save-edit-light.png", alt: "Edit to perfection" },
                  { src: isDark ? "/wallpaper/save-generate-dark.png" : "/wallpaper/save-generate-light.png", alt: "Generate variations" }
                ]
                handleImageClick(currentImageIndex, heroImages, false)
              }}
            >
              {currentImageIndex === 0 && (
                <Image
                  src={isDark ? "/wallpaper/save-search-dark.png" : "/wallpaper/save-search-light.png"}
                  alt="Search for inspiration"
                  fill
                  className="object-contain"
                  priority
                />
              )}
              {currentImageIndex === 1 && (
                <Image
                  src={isDark ? "/wallpaper/save-edit-dark.png" : "/wallpaper/save-edit-light.png"}
                  alt="Edit to perfection"
                  fill
                  className="object-contain"
                />
              )}
              {currentImageIndex === 2 && (
                <Image
                  src={isDark ? "/wallpaper/save-generate-dark.png" : "/wallpaper/save-generate-light.png"}
                  alt="Generate variations"
                  fill
                  className="object-contain"
                />
              )}
            </div>
          </div>
          
          {/* Navigation Dots - Below Images */}
          <div className="flex justify-center gap-3 mt-6">
            {[0, 1, 2].map((index) => (
              <button
                key={index}
                onClick={() => setCurrentImageIndex(index)}
                className={`h-3 rounded-full transition-all cursor-pointer ${
                  index === currentImageIndex 
                    ? 'w-12 bg-[var(--foreground)]' 
                    : 'w-3 bg-[var(--muted)] hover:bg-[var(--foreground)]'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* Visual Showcase Section - Search → Edit → Remix */}
      <div className="mt-28 sm:mt-32 md:mt-40 lg:mt-48">
        <h1 className="text-[clamp(3rem,10vw,4.5rem)] font-semibold tracking-tight leading-none text-[var(--foreground)] mb-12 sm:mb-12 text-center">
          Make it<span className="sm:hidden"><br /></span> yours.
        </h1>
        <p className="text-[clamp(1.25rem,5vw,1.5rem)] leading-normal text-[var(--foreground)] max-w-3xl mb-16 sm:mb-20 text-center mx-auto">
          Find inspiration. Edit to your style. Create variations. Keep them all.
        </p>
        
        {/* Image Story Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl">
          {/* Search Step */}
          <div className="relative">
            {/* Message Bubble */}
            <div className="flex justify-end mb-4 h-[100px] items-end">
              <div className="imessage-send-bubble multi-line max-w-[280px]">
                Search for a cool Times Square night street view wallpaper
              </div>
            </div>
            
            <div 
              className="relative rounded-3xl overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform duration-300"
              onClick={() => {
                const gridImages = [
                  { src: "/wallpaper/new-york-searched.png", alt: "Search for inspiration" },
                  { src: "/wallpaper/new-york-edited.png", alt: "Edit to perfection" },
                  { src: "/wallpaper/new-york-generated.png", alt: "Remix" }
                ]
                handleImageClick(0, gridImages, false)
              }}
            >
              <div className="aspect-[4/3] relative">
                <Image
                  src="/wallpaper/new-york-searched.png"
                  alt="Search for inspiration"
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <h3 className="text-2xl font-semibold text-white mb-2">
                    Find anything
                  </h3>
                  <p className="text-white/90 text-sm">
                    Search the web for inspiration
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Edit Step */}
          <div className="relative">
            {/* Message Bubble */}
            <div className="flex justify-end mb-4 h-[100px] items-end">
              <div className="imessage-send-bubble multi-line max-w-[280px]">
                Replace every billboard in the image with the word "Chatflix" 
              </div>
            </div>
            
            <div 
              className="relative rounded-3xl overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform duration-300"
              onClick={() => {
                const gridImages = [
                  { src: "/wallpaper/new-york-searched.png", alt: "Search for inspiration" },
                  { src: "/wallpaper/new-york-edited.png", alt: "Edit to perfection" },
                  { src: "/wallpaper/new-york-generated.png", alt: "Remix" }
                ]
                handleImageClick(1, gridImages, false)
              }}
            >
              <div className="aspect-[4/3] relative">
                <Image
                  src="/wallpaper/new-york-edited.png"
                  alt="Edit to perfection"
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <h3 className="text-2xl font-semibold text-white mb-2">
                    Make it yours
                  </h3>
                  <p className="text-white/90 text-sm">
                    Edit and refine to perfection
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Generate Step */}
          <div className="relative">
            {/* Message Bubble */}
            <div className="flex justify-end mb-4 h-[100px] items-end">
              <div className="imessage-send-bubble multi-line max-w-[280px]">
              Can you generate a similar one with the same style?
              </div>
            </div>
            
            <div 
              className="relative rounded-3xl overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform duration-300"
              onClick={() => {
                const gridImages = [
                  { src: "/wallpaper/new-york-searched.png", alt: "Search for inspiration" },
                  { src: "/wallpaper/new-york-edited.png", alt: "Edit to perfection" },
                  { src: "/wallpaper/new-york-generated.png", alt: "Remix" }
                ]
                handleImageClick(2, gridImages, false)
              }}
            >
              <div className="aspect-[4/3] relative">
                <Image
                  src="/wallpaper/new-york-generated.png"
                  alt="Remix"
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <h3 className="text-2xl font-semibold text-white mb-2">
                    Remix
                  </h3>
                  <p className="text-white/90 text-sm">
                    Create inspired variations
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Save Feature Section - MAIN FOCUS */}
      <div className="mt-28 sm:mt-32 md:mt-40 lg:mt-48">
        {/* Mobile Layout - Vertical */}
        <div className="sm:hidden">
          <h1 className="text-[clamp(3rem,10vw,4.5rem)] font-semibold tracking-tight leading-none text-[var(--foreground)] mb-12 text-center">
            One tap.<br />Saved forever.
          </h1>
          <p className="text-[clamp(1.25rem,5vw,1.5rem)] leading-normal text-[var(--foreground)] max-w-3xl mb-0 sm:mb-16 text-center mx-auto">
            Save any image from Chatflix to your gallery. One tap keeps it all. Forever yours.
          </p>
          
          {/* Save Feature Demo */}
          <div 
            className="relative rounded-3xl overflow-hidden cursor-pointer group"
            onClick={() => {
              const saveImages = [
                { src: isDark ? "/wallpaper/save-dark.png" : "/wallpaper/save-light.png", alt: "Save images to gallery" }
              ]
              handleImageClick(0, saveImages, false)
            }}
          >
            <div className="relative w-full h-[600px]">
              <Image
                src={isDark ? "/wallpaper/save-dark.png" : "/wallpaper/save-light.png"}
                alt="Save images to gallery"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
        </div>

        {/* Desktop Layout - Horizontal */}
        <div className="hidden sm:flex sm:items-center sm:gap-12 lg:gap-16">
          {/* Image - Left Side */}
          <div className="flex-1">
            <div 
              className="relative rounded-3xl overflow-hidden cursor-pointer group"
              onClick={() => {
                const saveImages = [
                  { src: isDark ? "/wallpaper/save-dark.png" : "/wallpaper/save-light.png", alt: "Save images to gallery" }
                ]
                handleImageClick(0, saveImages, false)
              }}
            >
              <div className="relative w-full h-[500px]">
                <Image
                  src={isDark ? "/wallpaper/save-dark.png" : "/wallpaper/save-light.png"}
                  alt="Save images to gallery"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          </div>
          
          {/* Text - Right Side */}
          <div className="flex-1">
            <h1 className="text-[clamp(3rem,10vw,4.5rem)] font-semibold tracking-tight leading-none text-[var(--foreground)] mb-12">
              One tap. Saved forever.
            </h1>
            <p className="text-[clamp(1.25rem,5vw,1.5rem)] leading-normal text-[var(--foreground)] max-w-3xl">
              Save any image from Chatflix to your gallery. One tap keeps it all. Forever yours.
            </p>
          </div>
        </div>
      </div>
      
      {/* Wallpaper Setting Section */}
      <div className="mt-16 sm:mt-32 md:mt-40 lg:mt-48">
        <h1 className="text-[clamp(3rem,10vw,4.5rem)] font-semibold tracking-tight leading-none text-[var(--foreground)] mb-20 sm:mb-24 text-center">
          Set a wallpaper.
        </h1>
        
        <div className="max-w-3xl mb-8 sm:mb-12">
            <h2 className="text-[clamp(1.75rem,5vw,2.25rem)] font-semibold text-[var(--foreground)] mb-3">
              Watch your space come alive.
            </h2>
          <p className="text-[clamp(1rem,3.5vw,1.125rem)] leading-relaxed text-[var(--foreground)]">
            A streamlined experience lets you transform your saved images into stunning Chatflix wallpapers. Simply tap any image to open it and select "Set as Wallpaper" from the viewer. Or tap Select to choose an image, then tap "Set as Wallpaper" at the bottom toolbar. It only takes a moment to make Chatflix truly yours.
          </p>
        </div>
        
        {/* Wallpaper Setting Demo */}
        <div 
          className="relative rounded-3xl overflow-hidden cursor-pointer group hover:scale-[1.02] transition-transform duration-300"
          onClick={() => {
            const wallpaperImages = [
              { src: isDark ? "/wallpaper/set-wallpaper-dark.png" : "/wallpaper/set-wallpaper-light.png", alt: "Set as wallpaper" }
            ]
            handleImageClick(0, wallpaperImages, false)
          }}
        >
          <div className="aspect-[16/10] relative">
            <Image
              src={isDark ? "/wallpaper/set-wallpaper-dark.png" : "/wallpaper/set-wallpaper-light.png"}
              alt="Set as wallpaper"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>
      </div>
      
      {/* Full-Size Image Gallery Showcase */}
      <div className="mt-16 sm:mt-32 md:mt-40 lg:mt-48">
        <h2 className="text-[clamp(2rem,6vw,3rem)] font-semibold tracking-tight leading-tight text-[var(--foreground)] mb-6 sm:mb-8 text-center">
        Use these. Or create your own.
        </h2>
        <p className="text-[clamp(1rem,3.5vw,1.125rem)] leading-relaxed text-[var(--foreground)] max-w-3xl mx-auto mb-12 sm:mb-16 text-center">
          These stunning wallpapers were created using Chatflix's AI image generation. Start a chat and ask for any style you want, from minimalist landscapes to abstract art, then set your favorite as your Chatflix background.
        </p>
        
        <div className="relative -mx-8 sm:-mx-8 md:-mx-40 lg:-mx-48">
          {/* Mobile: Single Image View with Swipe */}
          <div className="sm:hidden relative">
            <div 
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {images.map((image, index) => (
                <div key={index} className="w-full flex-shrink-0">
                  <div 
                    className="aspect-[4/3] relative rounded-3xl overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer group"
                    onClick={() => handleImageClick(index, images, true)}
                  >
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      className="object-cover"
                      priority={index === 0}
                    />
                    {/* Tag Overlay */}
                    <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full">
                      Generated with Chatflix
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Desktop: Large Image Display */}
          <div className="hidden sm:block">
            <div 
              className="aspect-[16/10] relative rounded-3xl overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer group"
              onClick={() => handleImageClick(currentImageIndex, images, true)}
            >
              <Image
                src={images[currentImageIndex].src}
                alt={images[currentImageIndex].alt}
                fill
                className="object-cover"
                priority
              />
              {/* Tag Overlay */}
              <div className="absolute bottom-6 right-6 bg-black/60 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-full">
                Generated with Chatflix
              </div>
            </div>
          </div>
          
          {/* Navigation Dots - Below Images */}
          <div className="flex justify-center gap-3 mt-6">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentImageIndex(index)}
                className={`h-3 rounded-full transition-all cursor-pointer ${
                  index === currentImageIndex 
                    ? 'w-12 bg-[var(--foreground)]' 
                    : 'w-3 bg-[var(--muted)] hover:bg-[var(--foreground)]'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
      </div>

      {/* Gallery Collections Section */}
      <div className="mt-28 sm:mt-32 md:mt-40 lg:mt-48">
        <h1 className="text-[clamp(3rem,10vw,4.5rem)] font-semibold tracking-tight leading-none text-[var(--foreground)] mb-12 text-center">
          Your gallery.<br />Always there. Always yours.
        </h1>
        <p className="text-[clamp(1.25rem,5vw,1.5rem)] leading-normal text-[var(--foreground)] max-w-3xl mb-16 sm:mb-20 text-center mx-auto">
          Everything visual, organized in three collections.
        </p>
        
        {/* Two Collection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Saved */}
          <div className="group w-full max-w-sm">
            <div className="mb-6 h-48 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-3xl flex items-center justify-center">
              <div className="text-6xl">💾</div>
            </div>
            <h3 className="text-[clamp(1.5rem,4vw,1.75rem)] font-semibold text-[var(--foreground)] mb-3">
              Saved
            </h3>
            <p className="text-[clamp(1rem,3.5vw,1.125rem)] leading-relaxed text-[var(--foreground)] mb-4">
              Save any image you discover in Chatflix. From search results to AI creations, keep everything that inspires you.
            </p>
            <a href="/photo/saved" className="text-[var(--foreground)] hover:opacity-70 transition-opacity inline-flex items-center gap-2">
              View Saved →
            </a>
          </div>
          
          {/* Uploaded */}
          <div className="group w-full max-w-sm">
            <div className="mb-6 h-48 bg-gradient-to-br from-green-500/10 to-teal-500/10 rounded-3xl flex items-center justify-center">
              <div className="text-6xl">📸</div>
            </div>
            <h3 className="text-[clamp(1.5rem,4vw,1.75rem)] font-semibold text-[var(--foreground)] mb-3">
              Uploaded
            </h3>
            <p className="text-[clamp(1rem,3.5vw,1.125rem)] leading-relaxed text-[var(--foreground)] mb-4">
              Images you upload in Messages or Pensieve are automatically saved here.
            </p>
            <a href="/photo/uploads" className="text-[var(--foreground)] hover:opacity-70 transition-opacity inline-flex items-center gap-2">
              View Uploaded →
            </a>
          </div>
          
        </div>
      </div>

      {/* Contact Footer */}
      <div className="mt-28 mb-8 text-center">
        <p className="text-sm text-[var(--muted)]">
          If you have any questions,<br className="sm:hidden" /> contact us at <a href="mailto:sply@chatflix.app" className="hover:text-[var(--foreground)] transition-colors">sply@chatflix.app</a>
        </p>
      </div>

      {/* ImageViewer Modal */}
      <ImageViewer
        images={viewerImages}
        currentIndex={viewerIndex}
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        user={user}
        isMobile={false}
        onSetAsBackground={canSetAsBackground ? handleViewerSetBackground : undefined}
        isSettingBackground={isSettingBackground}
        isSuccess={isSuccess}
      />
    </>
  )
}
