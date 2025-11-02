/* ============================================================================
   useRetina Hook - DPI Detection & Optimization
   ============================================================================
   Detects display pixel ratio and provides retina optimization utilities
   Version 1.0 | 2025-11-02
   ============================================================================ */

import { useEffect, useState } from 'react'

/**
 * Device pixel ratio classification
 */
export enum DPILevel {
  STANDARD = '1x',
  RETINA = '2x',
  ULTRA_RETINA = '3x',
}

/**
 * Retina display information
 */
export interface RetinaInfo {
  dpr: number // Device pixel ratio
  level: DPILevel // Classification
  isRetina: boolean // True if DPR >= 2
  isUltraRetina: boolean // True if DPR >= 3
  isStandard: boolean // True if DPR < 2
}

/**
 * Hook to detect and optimize for retina displays
 *
 * @returns {RetinaInfo} Information about the display's pixel density
 *
 * @example
 * const { dpr, isRetina, level } = useRetina()
 *
 * if (isRetina) {
 *   // Load higher resolution images
 *   // Adjust font rendering
 *   // Optimize animations
 * }
 */
export function useRetina(): RetinaInfo {
  const [retinaInfo, setRetinaInfo] = useState<RetinaInfo>(() => {
    return getRetinaInfo()
  })

  // Listen for DPR changes
  useEffect(() => {
    const handleDPRChange = () => {
      setRetinaInfo(getRetinaInfo())
    }

    // Create media query list for DPR changes
    // This handles when user changes zoom level or device orientation
    const mediaQueryList = window.matchMedia('(min-resolution: 2dppx)')

    // Modern browsers support addEventListener
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handleDPRChange)

      return () => {
        mediaQueryList.removeEventListener('change', handleDPRChange)
      }
    }
    // Fallback for older browsers
    else if (mediaQueryList.addListener) {
      mediaQueryList.addListener(handleDPRChange)

      return () => {
        mediaQueryList.removeListener(handleDPRChange)
      }
    }
  }, [])

  return retinaInfo
}

/**
 * Get current retina information
 * Separated to allow SSR-safe initialization
 */
function getRetinaInfo(): RetinaInfo {
  // Use window.devicePixelRatio if available (all modern browsers)
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

  // Classify DPR level
  let level: DPILevel
  if (dpr >= 2.5) {
    level = DPILevel.ULTRA_RETINA
  } else if (dpr >= 1.5) {
    level = DPILevel.RETINA
  } else {
    level = DPILevel.STANDARD
  }

  return {
    dpr,
    level,
    isRetina: dpr >= 1.5,
    isUltraRetina: dpr >= 2.5,
    isStandard: dpr < 1.5,
  }
}

/**
 * Get image source for current DPR
 * Useful for srcset-like behavior in JavaScript
 *
 * @param baseUrl - Base URL of the image without extension
 * @param format - File format (default: 'png')
 * @returns URL for current display DPR
 *
 * @example
 * const imageSrc = getRetinaImageUrl('/images/logo', 'png')
 * // Returns: '/images/logo@2x.png' on retina displays
 * // Returns: '/images/logo.png' on standard displays
 */
export function getRetinaImageUrl(
  baseUrl: string,
  format: string = 'png'
): string {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

  if (dpr >= 2) {
    return `${baseUrl}@${Math.round(dpr)}x.${format}`
  }

  return `${baseUrl}.${format}`
}

/**
 * Scale value based on DPR for crisp rendering
 *
 * @param value - Original value
 * @param factor - Scaling factor (default: 1)
 * @returns Scaled value appropriate for current display
 *
 * @example
 * const borderWidth = getScaledValue(1) // Returns 0.5 on 2x display
 */
export function getScaledValue(value: number, factor: number = 1): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  return (value * factor) / dpr
}

/**
 * Check if display supports high DPI rendering
 */
export function supportsRetinaDisplay(): boolean {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  return dpr >= 1.5
}

/**
 * Get CSS class names for retina optimization
 *
 * @returns CSS class name for current DPR level
 *
 * @example
 * <div className={getRetinaCSSClass()}>
 *   Content optimized for display
 * </div>
 */
export function getRetinaCSSClass(): string {
  const info = getRetinaInfo()

  switch (info.level) {
    case DPILevel.ULTRA_RETINA:
      return 'retina-3x'
    case DPILevel.RETINA:
      return 'retina-2x'
    case DPILevel.STANDARD:
    default:
      return 'retina-1x'
  }
}

/**
 * Format DPR for display
 *
 * @returns Human-readable DPR string
 *
 * @example
 * console.log(formatDPR()) // "2x Retina Display"
 */
export function formatDPR(): string {
  const info = getRetinaInfo()

  switch (info.level) {
    case DPILevel.ULTRA_RETINA:
      return `${Math.round(info.dpr)}x Ultra Retina Display`
    case DPILevel.RETINA:
      return `${Math.round(info.dpr)}x Retina Display`
    case DPILevel.STANDARD:
    default:
      return 'Standard Display'
  }
}
