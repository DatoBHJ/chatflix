'use client'

import { useState, useEffect, useCallback } from 'react';

interface BackgroundBrightnessResult {
  brightness: number; // 0-255 scale (0 = 검은색, 255 = 흰색)
  isLoading: boolean;
  isVeryDark: boolean; // brightness < 30
  isVeryBright: boolean; // brightness > 190
}

const DEFAULT_BRIGHTNESS = 128;

/**
 * Calculate average brightness of entire image
 * Uses Canvas API to sample pixels and calculate average brightness
 */
async function calculateImageBrightness(imageUrl: string): Promise<number> {
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

    // Set canvas size to match image (for performance, we can downsample large images)
    // For very large images, we'll sample at a reduced resolution
    const maxSampleSize = 1000; // Maximum dimension for sampling
    let sampleWidth = img.width;
    let sampleHeight = img.height;
    
    if (sampleWidth > maxSampleSize || sampleHeight > maxSampleSize) {
      const scale = Math.min(maxSampleSize / sampleWidth, maxSampleSize / sampleHeight);
      sampleWidth = Math.floor(sampleWidth * scale);
      sampleHeight = Math.floor(sampleHeight * scale);
    }
    
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;

    // Draw the entire image to canvas (scaled down if needed)
    ctx.drawImage(img, 0, 0, sampleWidth, sampleHeight);

    // Get image data
    const imageData = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
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
    return averageBrightness;

  } catch (error) {
    console.warn('Image brightness calculation failed:', error);
    return DEFAULT_BRIGHTNESS;
  }
}

/**
 * Hook to calculate average brightness of background image
 * Returns brightness value (0-255), loading state, and flags for very dark/bright images
 */
export function useBackgroundImageBrightness(
  imageUrl: string | null | undefined
): BackgroundBrightnessResult {
  const [result, setResult] = useState<BackgroundBrightnessResult>({
    brightness: DEFAULT_BRIGHTNESS,
    isLoading: true,
    isVeryDark: false,
    isVeryBright: false
  });

  const calculateBrightness = useCallback(async () => {
    if (!imageUrl) {
      setResult({
        brightness: DEFAULT_BRIGHTNESS,
        isLoading: false,
        isVeryDark: false,
        isVeryBright: false
      });
      return;
    }

    setResult(prev => ({ ...prev, isLoading: true }));

    try {
      const brightness = await calculateImageBrightness(imageUrl);
      const isVeryDark = brightness < 30; // 원래 30이었음 
      const isVeryBright = brightness > 100; // 조금이라도 흰색이 추출되면 오버레이 적용 (170 → 100으로 대폭 낮춤) 
      // const isVeryBright = brightness > 100; // 조금이라도 흰색이 추출되면 오버레이 적용 (170 → 100으로 대폭 낮춤) 

      setResult({
        brightness,
        isLoading: false,
        isVeryDark,
        isVeryBright
      });
    } catch (error) {
      console.warn('Background image brightness detection failed:', error);
      setResult({
        brightness: DEFAULT_BRIGHTNESS,
        isLoading: false,
        isVeryDark: false,
        isVeryBright: false
      });
    }
  }, [imageUrl]);

  useEffect(() => {
    calculateBrightness();
  }, [calculateBrightness]);

  return result;
}

