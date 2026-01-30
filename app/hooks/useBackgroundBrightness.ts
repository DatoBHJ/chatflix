import { useState, useEffect, useCallback, useRef, RefObject } from 'react';

// Brightness threshold constants
// BRIGHTNESS_THRESHOLD: Maximum brightness value to be considered "dark"
// Values > BRIGHTNESS_THRESHOLD are considered bright (use black text)
// Values <= BRIGHTNESS_THRESHOLD are considered dark (use white text)
export const BRIGHTNESS_THRESHOLD = 190; // Almost white (255) is considered bright, everything else is dark

// DEFAULT_BRIGHTNESS: Default/fallback brightness value (middle of 0-255 scale)
const DEFAULT_BRIGHTNESS = 128;

// BRIGHTNESS_CALC_DEBOUNCE_MS: Debounce time for brightness calculation after position changes
// Lower values = faster response, but may impact performance with many widgets
// Can be adjusted based on performance testing
const BRIGHTNESS_CALC_DEBOUNCE_MS = 50;

// Maximum number of requests in the queue to prevent memory issues
const MAX_QUEUE_SIZE = 10;

// Sequential brightness calculation queue
interface BrightnessCalcRequest {
  widgetId: string;
  calculateFn: () => Promise<void>;
  timestamp: number;
}

const brightnessCalcQueue: BrightnessCalcRequest[] = [];
let isProcessingQueue = false;

/**
 * Add a brightness calculation request to the queue
 * Removes any existing requests for the same widget (keeps only the latest)
 */
function queueBrightnessCalculation(widgetId: string, calculateFn: () => Promise<void>) {
  // Remove any existing requests for this widget
  const existingIndex = brightnessCalcQueue.findIndex(req => req.widgetId === widgetId);
  if (existingIndex !== -1) {
    brightnessCalcQueue.splice(existingIndex, 1);
  }

  // Add new request to the queue
  brightnessCalcQueue.push({
    widgetId,
    calculateFn,
    timestamp: Date.now()
  });

  // Trim queue if it exceeds max size (remove oldest requests)
  if (brightnessCalcQueue.length > MAX_QUEUE_SIZE) {
    brightnessCalcQueue.shift();
  }

  // Start processing if not already processing
  if (!isProcessingQueue) {
    processNextBrightnessCalculation();
  }
}

/**
 * Process the next brightness calculation in the queue
 */
async function processNextBrightnessCalculation() {
  if (brightnessCalcQueue.length === 0) {
    isProcessingQueue = false;
    return;
  }

  isProcessingQueue = true;
  const request = brightnessCalcQueue.shift();

  if (request) {
    try {
      await request.calculateFn();
    } catch (error) {
      console.warn('Brightness calculation failed:', error);
    }
  }

  // Process next request in the queue
  // Use requestAnimationFrame to avoid blocking the UI
  requestAnimationFrame(() => {
    processNextBrightnessCalculation();
  });
}

interface BrightnessResult {
  isDark: boolean;
  brightness: number; // 0-255 scale
  isLoading: boolean;
}

/**
 * Hook to detect background brightness at a specific position
 * Uses Canvas API to sample background image pixels and calculate brightness
 */
export function useBackgroundBrightness(
  imageUrl: string,
  position: { x: number; y: number; width: number; height: number } | null = null
): BrightnessResult {
  const [result, setResult] = useState<BrightnessResult>({
    isDark: false,
    brightness: DEFAULT_BRIGHTNESS,
    isLoading: true
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const calculateBrightness = useCallback(async () => {
    if (!imageUrl || !position) {
      setResult({ isDark: false, brightness: DEFAULT_BRIGHTNESS, isLoading: false });
      return;
    }

    try {
      // Create image element
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageUrl;
      });

      // Create canvas for pixel sampling
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Canvas context not available');
      }

      // Set canvas size to match the sampling area
      canvas.width = position.width;
      canvas.height = position.height;

      // Draw the image portion to canvas
      ctx.drawImage(
        img,
        position.x, position.y, position.width, position.height,
        0, 0, position.width, position.height
      );

      // Get image data
      const imageData = ctx.getImageData(0, 0, position.width, position.height);
      const data = imageData.data;

      // Calculate average brightness using luminance formula
      let totalBrightness = 0;
      const pixelCount = data.length / 4; // RGBA = 4 values per pixel

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Calculate luminance using standard formula
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        totalBrightness += luminance;
      }

      const averageBrightness = totalBrightness / pixelCount;
      const isDark = averageBrightness <= BRIGHTNESS_THRESHOLD; // Threshold for dark/light

      setResult({
        isDark,
        brightness: averageBrightness,
        isLoading: false
      });

    } catch (error) {
      console.warn('Background brightness detection failed:', error);
      // Fallback to medium brightness
      setResult({
        isDark: false,
        brightness: DEFAULT_BRIGHTNESS,
        isLoading: false
      });
    }
  }, [imageUrl, position]);

  useEffect(() => {
    calculateBrightness();
  }, [calculateBrightness]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (canvasRef.current) {
        canvasRef.current = null;
      }
      if (imageRef.current) {
        imageRef.current = null;
      }
    };
  }, []);

  return result;
}

/**
 * Calculate brightness from image at a specific position (async helper function)
 * This is a standalone function that can be used with Promise.all
 */
async function calculateBrightnessFromImage(
  imageUrl: string,
  position: { x: number; y: number; width: number; height: number }
): Promise<BrightnessResult> {
  try {
    // Create image element
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });

    // Calculate actual image display size and scale for bg-cover
    // bg-cover: image covers entire container, maintaining aspect ratio, may be cropped
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const imgAspectRatio = img.width / img.height;
    const viewportAspectRatio = viewportWidth / viewportHeight;
    
    let displayWidth: number;
    let displayHeight: number;
    let offsetX: number;
    let offsetY: number;
    
    // bg-cover logic: image covers the entire container, maintaining aspect ratio
    if (imgAspectRatio > viewportAspectRatio) {
      // Image is wider than viewport - fit height, crop width
      displayHeight = viewportHeight;
      displayWidth = displayHeight * imgAspectRatio;
      offsetX = (viewportWidth - displayWidth) / 2; // Center horizontally
      offsetY = 0;
    } else {
      // Image is taller than viewport - fit width, crop height
      displayWidth = viewportWidth;
      displayHeight = displayWidth / imgAspectRatio;
      offsetX = 0;
      offsetY = (viewportHeight - displayHeight) / 2; // Center vertically
    }
    
    // Calculate scale factor from display size to original image size
    const scaleX = img.width / displayWidth;
    const scaleY = img.height / displayHeight;
    
    // Convert viewport coordinates to original image coordinates
    // position.x/y are viewport coordinates relative to the element
    // We need to convert them to image coordinates
    const imgX = (position.x - offsetX) * scaleX;
    const imgY = (position.y - offsetY) * scaleY;
    const imgWidth = position.width * scaleX;
    const imgHeight = position.height * scaleY;
    
    // Clamp to image bounds
    const clampedX = Math.max(0, Math.min(Math.floor(imgX), img.width - 1));
    const clampedY = Math.max(0, Math.min(Math.floor(imgY), img.height - 1));
    const clampedWidth = Math.max(1, Math.min(Math.ceil(imgWidth), img.width - clampedX));
    const clampedHeight = Math.max(1, Math.min(Math.ceil(imgHeight), img.height - clampedY));

    // Create canvas for pixel sampling
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Canvas context not available');
    }

    // Set canvas size to match the sampling area (in viewport coordinates)
    canvas.width = position.width;
    canvas.height = position.height;

    // Draw the image portion to canvas (using original image coordinates)
    ctx.drawImage(
      img,
      clampedX, clampedY, clampedWidth, clampedHeight,
      0, 0, position.width, position.height
    );

    // Get image data
    const imageData = ctx.getImageData(0, 0, position.width, position.height);
    const data = imageData.data;

    // Calculate average brightness using luminance formula
    let totalBrightness = 0;
    const pixelCount = data.length / 4; // RGBA = 4 values per pixel

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Calculate luminance using standard formula
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      totalBrightness += luminance;
    }

    const averageBrightness = totalBrightness / pixelCount;
    const isDark = averageBrightness <= BRIGHTNESS_THRESHOLD;

    return {
      isDark,
      brightness: averageBrightness,
      isLoading: false
    };

  } catch (error) {
    console.warn('Background brightness detection failed:', error);
    // Fallback to medium brightness
    return {
      isDark: false,
      brightness: DEFAULT_BRIGHTNESS,
      isLoading: false
    };
  }
}

/**
 * Parse RGB color string to RGB values
 * Handles formats: rgb(255, 255, 255), rgba(255, 255, 255, 0.5), #ffffff, #fff
 */
function parseColorToRgb(color: string): { r: number; g: number; b: number } | null {
  if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
    return null;
  }

  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16);
    const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16);
    const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16);
    return { r, g, b };
  }

  // Handle rgb/rgba colors
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10)
    };
  }

  return null;
}

/**
 * Calculate luminance from RGB values
 * Uses standard formula: 0.299 * r + 0.587 * g + 0.114 * b
 */
function calculateLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Find the main background image element (the one with lowest zIndex, typically at the back)
 * Returns the element with background-image style that has the lowest zIndex
 * Also checks computed styles, not just inline styles
 */
function findMainBackgroundImageElement(): HTMLElement | null {
  // Find all elements with background-image in inline style
  const allElements = document.querySelectorAll('*');
  let backgroundElements: HTMLElement[] = [];
  
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i] as HTMLElement;
    
    // Check inline style
    const inlineBgImage = el.style.backgroundImage;
    if (inlineBgImage && inlineBgImage !== 'none' && inlineBgImage !== '') {
      backgroundElements.push(el);
      continue;
    }
    
    // Also check computed style (for elements with background-image set via CSS)
    const computedStyle = window.getComputedStyle(el);
    const computedBgImage = computedStyle.backgroundImage;
    if (computedBgImage && computedBgImage !== 'none' && computedBgImage !== '') {
      // Only add if it's a URL (not gradient or other)
      if (computedBgImage.includes('url(')) {
        backgroundElements.push(el);
      }
    }
  }
  
  if (backgroundElements.length === 0) {
    return null;
  }
  
  // If only one, return it
  if (backgroundElements.length === 1) {
    return backgroundElements[0];
  }
  
  // Find the element with the lowest zIndex (typically the background layer)
  let lowestZIndex = Infinity;
  let lowestElement: HTMLElement | null = null;
  
  for (const el of backgroundElements) {
    const computedStyle = window.getComputedStyle(el);
    const zIndex = computedStyle.zIndex;
    const zIndexValue = zIndex === 'auto' ? 0 : (isNaN(parseInt(zIndex, 10)) ? 0 : parseInt(zIndex, 10));
    
    // Also check inline style zIndex
    const inlineZIndex = el.style.zIndex;
    const inlineZIndexValue = inlineZIndex && !isNaN(parseInt(inlineZIndex, 10)) ? parseInt(inlineZIndex, 10) : zIndexValue;
    
    // Use the lower of the two
    const finalZIndex = Math.min(zIndexValue, inlineZIndexValue || zIndexValue);
    
    if (finalZIndex < lowestZIndex || (finalZIndex === 0 && lowestZIndex !== 0)) {
      lowestZIndex = finalZIndex;
      lowestElement = el;
    }
  }
  
  return lowestElement || backgroundElements[0];
}

/**
 * Get background image URL from an element (checks both inline and computed styles)
 */
function getBackgroundImageUrl(element: HTMLElement): string | null {
  // First try inline style
  const inlineBgImage = element.style.backgroundImage;
  if (inlineBgImage && inlineBgImage !== 'none' && inlineBgImage !== '') {
    const urlMatch = inlineBgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }
  }
  
  // Then try computed style
  const computedStyle = window.getComputedStyle(element);
  const computedBgImage = computedStyle.backgroundImage;
  if (computedBgImage && computedBgImage !== 'none' && computedBgImage !== '') {
    const urlMatch = computedBgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }
  }
  
  return null;
}

/**
 * Get computed background color directly from an element (without traversing parents)
 * Only checks the element itself, not parent elements
 */
function getComputedBackgroundColorDirectly(element: HTMLElement): string | null {
  const computedStyle = window.getComputedStyle(element);
  // getComputedStyle automatically resolves CSS variables and color-mix to RGB values
  const bgColor = computedStyle.backgroundColor;
  
  // Skip transparent or rgba(0,0,0,0)
  if (bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)') {
    return null;
  }
  
  // Check if it's not fully transparent
  const alphaMatch = bgColor.match(/rgba?\([\d,\s]+,\s*([\d.]+)\)/);
  const alpha = alphaMatch ? parseFloat(alphaMatch[1]) : 1;
  
  if (alpha > 0) {
    const rgb = parseColorToRgb(bgColor);
    if (rgb && (rgb.r !== 0 || rgb.g !== 0 || rgb.b !== 0)) {
      return bgColor;
    }
  }
  
  return null;
}

/**
 * Get computed background color from an element, traversing up the DOM tree if needed
 * Handles transparent backgrounds by finding the actual rendered color
 * 
 * Note: getComputedStyle automatically resolves CSS variables (e.g., var(--background))
 * and color-mix functions to their computed RGB values, so no special handling is needed.
 */
function getComputedBackgroundColor(element: HTMLElement): string | null {
  let currentElement: HTMLElement | null = element;
  
  while (currentElement) {
    const computedStyle = window.getComputedStyle(currentElement);
    // getComputedStyle automatically resolves CSS variables and color-mix to RGB values
    const bgColor = computedStyle.backgroundColor;
    
    // Skip transparent or rgba(0,0,0,0)
    if (bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)') {
      // Move up to parent
      currentElement = currentElement.parentElement;
      
      // Stop at body or html and return their color
      if (currentElement === document.body || currentElement === document.documentElement) {
        const parentStyle = window.getComputedStyle(currentElement);
        return parentStyle.backgroundColor;
      }
      continue;
    }
    
    // Check if it's not fully transparent
    const alphaMatch = bgColor.match(/rgba?\([\d,\s]+,\s*([\d.]+)\)/);
    const alpha = alphaMatch ? parseFloat(alphaMatch[1]) : 1;
    
    if (alpha > 0) {
      const rgb = parseColorToRgb(bgColor);
      if (rgb && (rgb.r !== 0 || rgb.g !== 0 || rgb.b !== 0)) {
        return bgColor;
      }
    }
    
    // Move up to parent
    currentElement = currentElement.parentElement;
    
    // Stop at body or html
    if (currentElement === document.body || currentElement === document.documentElement) {
      const computedStyle = window.getComputedStyle(currentElement);
      return computedStyle.backgroundColor;
    }
  }
  
  return null;
}

/**
 * Calculate brightness from a CSS background color value
 */
function calculateBrightnessFromColor(color: string): { brightness: number; isDark: boolean } | null {
  const rgb = parseColorToRgb(color);
  if (!rgb) {
    return null;
  }
  
  const brightness = calculateLuminance(rgb.r, rgb.g, rgb.b);
  const isDark = brightness <= BRIGHTNESS_THRESHOLD;
  
  return { brightness, isDark };
}

const PAGE_BACKGROUND_CACHE_MS = 250;
let pageBackgroundPresenceCache: { value: boolean; timestamp: number } | null = null;

function isChatRoute(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  try {
    return window.location.pathname.startsWith('/chat');
  } catch {
    return false;
  }
}

function pageHasBackgroundImage(): boolean {
  if (typeof window === 'undefined') return false;
  
  const now = Date.now();
  if (pageBackgroundPresenceCache && now - pageBackgroundPresenceCache.timestamp < PAGE_BACKGROUND_CACHE_MS) {
    return pageBackgroundPresenceCache.value;
  }

  let hasImage = false;
  const backgroundElement = findMainBackgroundImageElement();
  if (backgroundElement) {
    const imageUrl = getBackgroundImageUrl(backgroundElement);
    if (imageUrl) {
      hasImage = true;
    }
  }

  if (!hasImage) {
    const bodyStyle = window.getComputedStyle(document.body);
    const htmlStyle = window.getComputedStyle(document.documentElement);
    const bodyHasImage = bodyStyle.backgroundImage && bodyStyle.backgroundImage !== 'none' && bodyStyle.backgroundImage.includes('url(');
    const htmlHasImage = htmlStyle.backgroundImage && htmlStyle.backgroundImage !== 'none' && htmlStyle.backgroundImage.includes('url(');
    hasImage = Boolean(bodyHasImage || htmlHasImage);
  }

  pageBackgroundPresenceCache = { value: hasImage, timestamp: now };
  return hasImage;
}

function getChatRouteThemeFallback(): BrightnessResult | null {
  if (typeof window === 'undefined') return null;
  if (!isChatRoute()) return null;
  if (pageHasBackgroundImage()) return null;

  const themeAttr = document.documentElement.getAttribute('data-theme') || 'light';
  const systemPrefersDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false;
  const isDarkTheme = themeAttr === 'dark' || (themeAttr === 'system' && systemPrefersDark);
  const brightness = isDarkTheme ? 32 : 224;

  return {
    isDark: isDarkTheme,
    brightness,
    isLoading: false
  };
}

/**
 * Simplified hook for detecting if background is dark at QuickAccessApps position
 * Uses a more efficient approach by sampling a smaller area
 * Falls back to background color detection when no image is available
 */
export function useQuickAccessBackgroundBrightness(): BrightnessResult {
  const [result, setResult] = useState<BrightnessResult>({
    isDark: false,
    brightness: DEFAULT_BRIGHTNESS,
    isLoading: true
  });

  useEffect(() => {
    const detectBackground = async () => {
      try {
        // First, try to get background image - find the main background element (lowest zIndex)
        const backgroundElement = findMainBackgroundImageElement();
        
        if (backgroundElement) {
          const backgroundImage = backgroundElement.style.backgroundImage;
          const imageUrl = backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/)?.[1];
          
          if (imageUrl) {
            // Sample multiple positions to avoid sampling white elements in the center
            // Sample position - center bottom area where QuickAccessApps typically appears
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            const sampleWidth = Math.min(200, viewportWidth * 0.3);
            const sampleHeight = Math.min(100, viewportHeight * 0.15);
            
            // Sample multiple positions: corners and edges to avoid center white triangle
            const samplePositions = [
              { x: viewportWidth * 0.1, y: viewportHeight * 0.85 }, // Bottom left
              { x: viewportWidth * 0.9 - sampleWidth, y: viewportHeight * 0.85 }, // Bottom right
              { x: (viewportWidth - sampleWidth) / 2, y: viewportHeight * 0.85 }, // Bottom center
              { x: viewportWidth * 0.1, y: viewportHeight * 0.1 }, // Top left
              { x: viewportWidth * 0.9 - sampleWidth, y: viewportHeight * 0.1 }, // Top right
            ];
            
            // Sample all positions and calculate average brightness
            const brightnessResults = await Promise.all(
              samplePositions.map(async (pos) => {
                try {
                  return await calculateBrightnessFromImage(imageUrl, {
                    x: Math.max(0, pos.x),
                    y: Math.max(0, pos.y),
                    width: sampleWidth,
                    height: sampleHeight
                  });
                } catch {
                  return null;
                }
              })
            );
            
            // Filter out failed results and calculate average
            const validResults = brightnessResults.filter((r): r is BrightnessResult => r !== null);
            if (validResults.length > 0) {
              const avgBrightness = validResults.reduce((sum, r) => sum + r.brightness, 0) / validResults.length;
              const isDark = avgBrightness <= BRIGHTNESS_THRESHOLD;
              
              setResult({
                isDark,
                brightness: avgBrightness,
                isLoading: false
              });
              return;
            }
          }
        }

        // No background image found - fall back to background color detection
        // But first, check if there's actually a background image that we might have missed
        // by checking the main container elements (main, body, html)
        const mainElement = document.querySelector('main');
        const mainBgImage = mainElement ? getBackgroundImageUrl(mainElement) : null;
        if (mainBgImage) {
          // Found background image in main element, sample it
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          const sampleWidth = Math.min(200, viewportWidth * 0.3);
          const sampleHeight = Math.min(100, viewportHeight * 0.15);
          
          const samplePositions = [
            { x: viewportWidth * 0.1, y: viewportHeight * 0.85 },
            { x: viewportWidth * 0.9 - sampleWidth, y: viewportHeight * 0.85 },
            { x: viewportWidth * 0.1, y: viewportHeight * 0.1 },
            { x: viewportWidth * 0.9 - sampleWidth, y: viewportHeight * 0.1 },
          ];
          
          const brightnessResults = await Promise.all(
            samplePositions.map(async (pos) => {
              try {
                return await calculateBrightnessFromImage(mainBgImage, {
                  x: Math.max(0, pos.x),
                  y: Math.max(0, pos.y),
                  width: sampleWidth,
                  height: sampleHeight
                });
              } catch {
                return null;
              }
            })
          );
          
          const validResults = brightnessResults.filter((r): r is BrightnessResult => r !== null);
          if (validResults.length > 0) {
            const avgBrightness = validResults.reduce((sum: number, r: BrightnessResult) => sum + r.brightness, 0) / validResults.length;
            const isDark = avgBrightness <= BRIGHTNESS_THRESHOLD;
            
            setResult({
              isDark,
              brightness: avgBrightness,
              isLoading: false
            });
            return;
          }
        }

        // Try to get background color from body or html element
        const bodyColor = getComputedBackgroundColor(document.body);
        const htmlColor = bodyColor || getComputedBackgroundColor(document.documentElement);
        
        if (htmlColor) {
          const brightnessResult = calculateBrightnessFromColor(htmlColor);
          if (brightnessResult) {
            setResult({
              isDark: brightnessResult.isDark,
              brightness: brightnessResult.brightness,
              isLoading: false
            });
            return;
          }
        }

        // Fallback: try to read computed background-color from html element directly (last resort)
        // This handles cases where body might be transparent but html has a background
        const htmlStyle = window.getComputedStyle(document.documentElement);
        const htmlBgColor = htmlStyle.backgroundColor;
        
        if (htmlBgColor && htmlBgColor !== 'transparent' && htmlBgColor !== 'rgba(0, 0, 0, 0)') {
          const brightnessResult = calculateBrightnessFromColor(htmlBgColor);
          if (brightnessResult) {
            setResult({
              isDark: brightnessResult.isDark,
              brightness: brightnessResult.brightness,
              isLoading: false
            });
            return;
          }
        }

        // Final fallback
        setResult({ isDark: false, brightness: DEFAULT_BRIGHTNESS, isLoading: false });
      } catch (error) {
        console.warn('Quick access background detection failed:', error);
        setResult({ isDark: false, brightness: DEFAULT_BRIGHTNESS, isLoading: false });
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(detectBackground, 100);

    // Watch for theme changes to trigger recalculation
    // MutationObserver for data-theme attribute changes
    const themeObserver = new MutationObserver(() => {
      // Small delay to ensure CSS has updated after theme change
      setTimeout(detectBackground, 150);
    });
    
    // Observe document.documentElement for data-theme attribute changes
    if (typeof window !== 'undefined' && document.documentElement) {
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
      });
    }

    // Listen for system theme preference changes
    let mediaQuery: MediaQueryList | null = null;
    if (typeof window !== 'undefined' && window.matchMedia) {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemThemeChange = () => {
        // Small delay to ensure CSS has updated after theme change
        setTimeout(detectBackground, 150);
      };
      mediaQuery.addEventListener('change', handleSystemThemeChange);

      return () => {
        clearTimeout(timer);
        themeObserver.disconnect();
        if (mediaQuery) {
          mediaQuery.removeEventListener('change', handleSystemThemeChange);
        }
      };
    }

    return () => {
      clearTimeout(timer);
      themeObserver.disconnect();
    };
  }, []);

  return result;
}

/**
 * Hook to detect background brightness for a specific DOM element
 * Samples the background at the element's center position
 * @param elementRef - Ref to the DOM element to detect background for
 * @param enabled - Whether brightness detection is enabled (default: true)
 * @param widgetId - Optional unique identifier for the widget (for queue management)
 * @returns BrightnessResult with isDark, brightness, and isLoading state
 */
export function useElementBackgroundBrightness(
  elementRef: RefObject<HTMLElement | null>, 
  enabled: boolean = true,
  widgetId?: string
): BrightnessResult {
  // 초기값을 동적으로 설정: 배경 이미지가 있는지 빠르게 확인
  // 배경 이미지가 없으면 theme 기반으로 초기값 설정
  const getInitialDarkState = (): boolean => {
    if (typeof window === 'undefined') return true;
    
    // Check if there's a background image - if so, ALWAYS assume dark (conservative for images)
    const bgElement = findMainBackgroundImageElement();
    if (bgElement) {
      const bgImage = getBackgroundImageUrl(bgElement);
      if (bgImage) return true;
    }

    // Check body/html background image as well
    const bodyStyle = window.getComputedStyle(document.body);
    if (bodyStyle.backgroundImage && bodyStyle.backgroundImage !== 'none' && bodyStyle.backgroundImage.includes('url(')) {
      return true;
    }
    
    // Default to dark when no explicit background image is detected
    return true;
  };
  
  const [result, setResult] = useState<BrightnessResult>({
    isDark: getInitialDarkState(),
    brightness: DEFAULT_BRIGHTNESS,
    isLoading: true
  });

  // Generate a unique ID if widgetId is not provided
  const uniqueIdRef = useRef(widgetId || `widget-${Math.random().toString(36).substring(2, 11)}`);

  const updateResult = (newResult: BrightnessResult, force = false) => {
    setResult(prev => {
      if (!force && !prev.isLoading) {
        // Preserve the last known brightness once loading has completed
        return prev;
      }
      return newResult;
    });
  };

  const applyFallbackResult = (force = false, allowThemeFallback = true) => {
    if (allowThemeFallback) {
      const themeFallback = getChatRouteThemeFallback();
      if (themeFallback) {
        updateResult(themeFallback, force);
        return;
      }
    }

    updateResult({ isDark: false, brightness: DEFAULT_BRIGHTNESS, isLoading: false }, force);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    console.log('[useElementBackgroundBrightness] State updated:', {
      widgetId: uniqueIdRef.current,
      isDark: result.isDark,
      brightness: result.brightness,
      isLoading: result.isLoading,
    });
  }, [result.isDark, result.brightness, result.isLoading]);

  useEffect(() => {
    // Always enable position detection, but queue calculations
    // This ensures brightness is calculated whenever the widget stops moving,
    // regardless of edit mode, dragging, or resizing state

    // Debounce timer for position/size change detection
    let debounceTimer: NodeJS.Timeout | null = null;
    let lastRect: DOMRect | null = null;
    let positionCheckRafId: number | null = null;

    const detectBackground = async () => {
      let sampledBackgroundImage = false;
      try {
        // Wait for element to be available
        if (!elementRef.current) {
          applyFallbackResult(false);
          return;
        }

        const element = elementRef.current;
        const rect = element.getBoundingClientRect();
        
        // Skip if element is not visible or has zero size
        if (rect.width === 0 || rect.height === 0) {
          applyFallbackResult(false);
          return;
        }
        
        // Check if element is actually visible (not just opacity-0)
        const computedStyle = window.getComputedStyle(element);
        if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
          applyFallbackResult(false);
          return;
        }

        // Removed color-based fallback to avoid transparent glass surfaces overriding actual background brightness

        // SECOND: Check if element has its own background image
        const elementBgImage = getBackgroundImageUrl(element);
        if (elementBgImage) {
          sampledBackgroundImage = true;
          // Element has its own background image, sample it
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const sampleWidth = Math.min(100, rect.width * 0.5);
          const sampleHeight = Math.min(100, rect.height * 0.5);
          
          const samplePositions: Array<{ x: number; y: number }> = [
            { x: rect.left, y: rect.top },
            { x: rect.right - sampleWidth, y: rect.top },
            { x: rect.left, y: rect.bottom - sampleHeight },
            { x: rect.right - sampleWidth, y: rect.bottom - sampleHeight },
            { x: centerX - sampleWidth / 2, y: centerY - sampleHeight / 2 },
          ];
          
          const brightnessResults = await Promise.all(
            samplePositions.map(async (pos) => {
              try {
                return await calculateBrightnessFromImage(elementBgImage, {
                  x: Math.max(0, pos.x),
                  y: Math.max(0, pos.y),
                  width: sampleWidth,
                  height: sampleHeight
                });
              } catch {
                return null;
              }
            })
          );
          
          const validResults = brightnessResults.filter((r): r is BrightnessResult => r !== null);
          if (validResults.length > 0) {
            const avgBrightness = validResults.reduce((sum, r) => sum + r.brightness, 0) / validResults.length;
            const isDark = avgBrightness <= BRIGHTNESS_THRESHOLD;
            
            updateResult({
              isDark,
              brightness: avgBrightness,
              isLoading: false
            });
            return;
          }
        }

        // THIRD: Try to get background image from main background element (lowest zIndex)
        const backgroundElement = findMainBackgroundImageElement();
        
        if (backgroundElement) {
          const imageUrl = getBackgroundImageUrl(backgroundElement);
          
          if (imageUrl) {
            sampledBackgroundImage = true;
            // Sample multiple positions around the element to avoid sampling white elements in the center
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const sampleWidth = Math.min(100, rect.width * 0.5);
            const sampleHeight = Math.min(100, rect.height * 0.5);
            
            // Calculate element position relative to viewport
            const elementLeft = rect.left;
            const elementTop = rect.top;
            const elementRight = rect.right;
            const elementBottom = rect.bottom;
            
            // Sample multiple positions: corners and edges relative to the element
            const samplePositions: Array<{ x: number; y: number }> = [
              { x: elementLeft, y: elementTop }, // Top left corner
              { x: elementRight - sampleWidth, y: elementTop }, // Top right corner
              { x: elementLeft, y: elementBottom - sampleHeight }, // Bottom left corner
              { x: elementRight - sampleWidth, y: elementBottom - sampleHeight }, // Bottom right corner
              { x: centerX - sampleWidth / 2, y: centerY - sampleHeight / 2 }, // Center
            ];
            
            // Sample all positions and calculate average brightness
            const brightnessResults = await Promise.all(
              samplePositions.map(async (pos) => {
                try {
                  return await calculateBrightnessFromImage(imageUrl, {
                    x: Math.max(0, pos.x),
                    y: Math.max(0, pos.y),
                    width: sampleWidth,
                    height: sampleHeight
                  });
                } catch {
                  return null;
                }
              })
            );
            
            // Filter out failed results and calculate average
            const validResults = brightnessResults.filter((r): r is BrightnessResult => r !== null);
            if (validResults.length > 0) {
              const avgBrightness = validResults.reduce((sum, r) => sum + r.brightness, 0) / validResults.length;
              const isDark = avgBrightness <= BRIGHTNESS_THRESHOLD;
              
            updateResult({
                isDark,
                brightness: avgBrightness,
              isLoading: false
              });
              return;
            }
          }
        }

        // FOURTH: Check if there's a background image in parent elements
        let checkElement: HTMLElement | null = element.parentElement;
        while (checkElement && checkElement !== document.body && checkElement !== document.documentElement) {
          const parentBgImage = getBackgroundImageUrl(checkElement);
          if (parentBgImage) {
            sampledBackgroundImage = true;
            // Found background image in parent, sample at element's position
            const sampleWidth = Math.min(100, rect.width * 0.5);
            const sampleHeight = Math.min(100, rect.height * 0.5);
            
            const samplePositions: Array<{ x: number; y: number }> = [
              { x: rect.left, y: rect.top },
              { x: rect.right - sampleWidth, y: rect.top },
              { x: rect.left, y: rect.bottom - sampleHeight },
              { x: rect.right - sampleWidth, y: rect.bottom - sampleHeight },
            ];
            
            const brightnessResults = await Promise.all(
              samplePositions.map(async (pos) => {
                try {
                  return await calculateBrightnessFromImage(parentBgImage, {
                    x: Math.max(0, pos.x),
                    y: Math.max(0, pos.y),
                    width: sampleWidth,
                    height: sampleHeight
                  });
                } catch {
                  return null;
                }
              })
            );
            
            const validResults = brightnessResults.filter((r): r is BrightnessResult => r !== null);
            if (validResults.length > 0) {
              const avgBrightness = validResults.reduce((sum, r) => sum + r.brightness, 0) / validResults.length;
              const isDark = avgBrightness <= BRIGHTNESS_THRESHOLD;
              
            updateResult({
                isDark,
                brightness: avgBrightness,
              isLoading: false
              });
              return;
            }
          }
          checkElement = checkElement.parentElement;
        }

        // Removed parent color fallback to ensure only real background sampling is used

        // Final fallback
        const allowThemeFallback = !sampledBackgroundImage;
        applyFallbackResult(true, allowThemeFallback);
      } catch (error) {
        console.warn('Element background detection failed:', error);
        const allowThemeFallback = !sampledBackgroundImage;
        applyFallbackResult(true, allowThemeFallback);
      }
    };

    // Wait for layout stabilization and animation completion
    // For modals with CSS transitions, we need to wait for:
    // 1. Layout stabilization (multiple requestAnimationFrame calls)
    // 2. Animation completion (400ms for duration-400 + 100ms buffer = 500ms)
    let rafId: number | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const waitForLayoutAndAnimation = () => {
      // Use multiple requestAnimationFrame calls to ensure layout is stable
      // This ensures the browser has completed layout calculations
      let rafCount = 0;
      const maxRafCalls = 3; // 3-4 frames should be enough for layout stabilization

      const scheduleNextRaf = () => {
        rafId = requestAnimationFrame(() => {
          rafCount++;
          if (rafCount < maxRafCalls) {
            scheduleNextRaf();
          } else {
            // Layout is stable, now wait for animation completion
            // For buttons without animation, use minimal delay (100ms)
            // For modals with animation, use longer delay (500ms)
            // Detect if element has animation by checking transition property
            const element = elementRef.current;
            const hasAnimation = element && window.getComputedStyle(element).transitionDuration !== '0s';
            const delay = hasAnimation ? 500 : 100;
            timeoutId = setTimeout(detectBackground, delay);
          }
        });
      };

      scheduleNextRaf();
    };

    waitForLayoutAndAnimation();

    // Set up ResizeObserver after layout is stable
    // Use a timeout to ensure element is mounted
    let resizeObserverTimeoutId: NodeJS.Timeout | null = null;
    resizeObserverTimeoutId = setTimeout(() => {
      setupResizeObserver();
    }, 600); // After initial layout and animation

    // Watch for theme changes to trigger recalculation
    // MutationObserver for data-theme attribute changes
    const themeObserver = new MutationObserver(() => {
      // Use double requestAnimationFrame to ensure CSS has updated after theme change
      // First RAF: waits for browser to process style changes
      // Second RAF: ensures we sample after the frame is painted
      requestAnimationFrame(() => {
        requestAnimationFrame(detectBackground);
      });
    });
    
    // Observe document.documentElement for data-theme attribute changes
    if (typeof window !== 'undefined' && document.documentElement) {
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
      });
    }

    // Listen for system theme preference changes
    let mediaQuery: MediaQueryList | null = null;
    let handleSystemThemeChange: ((e: MediaQueryListEvent) => void) | null = null;
    if (typeof window !== 'undefined' && window.matchMedia) {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      handleSystemThemeChange = () => {
        // Use double requestAnimationFrame to ensure CSS has updated after theme change
        // First RAF: waits for browser to process style changes
        // Second RAF: ensures we sample after the frame is painted
        requestAnimationFrame(() => {
          requestAnimationFrame(detectBackground);
        });
      };
      mediaQuery.addEventListener('change', handleSystemThemeChange);
    }

    // Listen for background image changes via custom event
    // This allows components to notify when background image changes
    const handleBackgroundChange = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(detectBackground);
      });
    };
    
    window.addEventListener('backgroundImageChanged', handleBackgroundChange);


    // Debounced function to trigger background detection after position/size changes
    // Now uses the queue system to prevent multiple widgets from calculating simultaneously
    const debouncedDetectBackground = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        if (elementRef.current) {
          // Queue the calculation instead of running it directly
          queueBrightnessCalculation(uniqueIdRef.current, detectBackground);
        }
      }, BRIGHTNESS_CALC_DEBOUNCE_MS);
    };

    // ResizeObserver to detect size changes
    // Set up after initial layout is complete
    // Always enabled to detect position changes even during drag/resize
    let resizeObserver: ResizeObserver | null = null;
    const setupResizeObserver = () => {
      if (typeof window !== 'undefined' && window.ResizeObserver && elementRef.current) {
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        resizeObserver = new ResizeObserver(() => {
          debouncedDetectBackground();
        });
        resizeObserver.observe(elementRef.current);
      }
    };

    // Position change detection using requestAnimationFrame
    // Always enabled to detect position changes even during drag/resize
    const checkPositionChange = () => {
      if (!elementRef.current) {
        return;
      }

      const currentRect = elementRef.current.getBoundingClientRect();
      
      // Check if position or size has changed
      if (lastRect) {
        const hasChanged = 
          Math.abs(currentRect.left - lastRect.left) > 1 ||
          Math.abs(currentRect.top - lastRect.top) > 1 ||
          Math.abs(currentRect.width - lastRect.width) > 1 ||
          Math.abs(currentRect.height - lastRect.height) > 1;
        
        if (hasChanged) {
          lastRect = currentRect;
          debouncedDetectBackground();
        } else {
          lastRect = currentRect;
        }
      } else {
        lastRect = currentRect;
      }

      // Continue checking position changes
      positionCheckRafId = requestAnimationFrame(checkPositionChange);
    };

    // Start position change detection after initial layout
    // Always start position detection regardless of enabled state
    // Wait a bit before starting position detection to avoid interfering with initial render
    setTimeout(() => {
      if (elementRef.current) {
        lastRect = elementRef.current.getBoundingClientRect();
        positionCheckRafId = requestAnimationFrame(checkPositionChange);
      }
    }, 1000); // Start after 1 second to let initial layout settle

    // Single cleanup function for all timers, RAF, and observers
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
      }
      if (positionCheckRafId !== null) {
        cancelAnimationFrame(positionCheckRafId);
      }
      if (resizeObserverTimeoutId !== null) {
        clearTimeout(resizeObserverTimeoutId);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      themeObserver.disconnect();
      if (mediaQuery && handleSystemThemeChange) {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
      }
      window.removeEventListener('backgroundImageChanged', handleBackgroundChange);
    };
  }, [elementRef]); // Removed 'enabled' from dependencies as we always detect position

  return result;
}


