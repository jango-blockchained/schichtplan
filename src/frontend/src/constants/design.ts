/* ============================================================================
   DESIGN SYSTEM CONSTANTS - Design Tokens & Configuration
   ============================================================================
   Centralized design token values matching CSS variables
   Version 1.0 | 2025-11-02
   ============================================================================ */

/**
 * COLOR TOKENS
 */
export const COLOR = {
  // Primary Brand Colors
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
  },
  // Semantic Colors - Success
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#145231',
  },
  // Semantic Colors - Warning
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  // Semantic Colors - Destructive
  destructive: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
  // Semantic Colors - Info
  info: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },
  // Neutral Colors - Professional Grays
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0a0a0a',
  },
  // Semantic Aliases
  background: '#ffffff',
  surface: '#f9fafb',
  'surface-secondary': '#f3f4f6',
  border: '#e5e7eb',
  'border-subtle': '#f3f4f6',
  'text-primary': '#111827',
  'text-secondary': '#4b5563',
  'text-tertiary': '#9ca3af',
  'text-disabled': '#d1d5db',
  'text-inverse': '#ffffff',
  'text-success': '#047857',
  'text-warning': '#b45309',
  'text-destructive': '#b91c1c',
  'text-info': '#0369a1',
} as const

/**
 * SPACING SCALE - 4px Grid System
 */
export const SPACING = {
  0: '0px',
  1: '2px',
  2: '4px',
  3: '6px',
  4: '8px',
  5: '10px',
  6: '12px',
  7: '14px',
  8: '16px',
  10: '20px',
  12: '24px',
  14: '28px',
  16: '32px',
  20: '40px',
  24: '48px',
  28: '56px',
  32: '64px',
  36: '72px',
  40: '80px',
  44: '88px',
  48: '96px',
} as const

/**
 * Shorthand Spacing
 */
export const SPACE = {
  xs: '8px',
  sm: '16px',
  base: '24px',
  md: '32px',
  lg: '48px',
  xl: '64px',
  '2xl': '96px',
} as const

/**
 * TYPOGRAPHY SCALE
 */
export const TYPOGRAPHY = {
  fontSize: {
    xs: '11px',
    sm: '12px',
    base: '14px',
    lg: '16px',
    xl: '18px',
    '2xl': '20px',
    '3xl': '24px',
    '4xl': '28px',
    '5xl': '32px',
    '6xl': '36px',
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  letterSpacing: {
    tight: '-0.01em',
    normal: '0',
    wide: '0.025em',
  },
} as const

/**
 * SHADOWS
 */
export const SHADOW = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inset: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
  'inset-sm': 'inset 0 1px 2px 0 rgba(0, 0, 0, 0.1)',
  focus: '0 0 0 3px rgba(59, 130, 246, 0.1)',
  'focus-ring':
    '0 0 0 2px rgba(255, 255, 255, 1), 0 0 0 4px rgba(37, 99, 235, 1)',
} as const

/**
 * BORDER RADIUS
 */
export const RADIUS = {
  none: '0px',
  xs: '2px',
  sm: '4px',
  base: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '20px',
  full: '9999px',
} as const

/**
 * ANIMATION DURATIONS - Milliseconds
 */
export const DURATION = {
  instant: '0ms',
  fastest: '50ms',
  fast: '100ms',
  normal: '150ms',
  slow: '200ms',
  slower: '300ms',
} as const

/**
 * EASING FUNCTIONS
 */
export const EASING = {
  'ease-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
  'ease-in': 'cubic-bezier(0.4, 1, 0.4, 1)',
  'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
  linear: 'linear',
} as const

/**
 * Z-INDEX SCALE
 */
export const ZINDEX = {
  auto: 'auto',
  hide: -1,
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  'modal-backdrop': 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
} as const

/**
 * BREAKPOINTS - Responsive Design
 */
export const BREAKPOINT = {
  xs: '0px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const

/**
 * MEDIA QUERIES
 */
export const MEDIA = {
  sm: `@media (min-width: ${BREAKPOINT.sm})`,
  md: `@media (min-width: ${BREAKPOINT.md})`,
  lg: `@media (min-width: ${BREAKPOINT.lg})`,
  xl: `@media (min-width: ${BREAKPOINT.xl})`,
  '2xl': `@media (min-width: ${BREAKPOINT['2xl']})`,
} as const

/**
 * TOUCH TARGETS - Minimum 44×44px for accessibility
 */
export const TOUCH_TARGET = {
  min: '44px',
  minSize: 44,
} as const

/**
 * TEXT STYLES - Predefined combinations
 */
export const TEXT = {
  h1: {
    fontSize: TYPOGRAPHY.fontSize['6xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    lineHeight: TYPOGRAPHY.lineHeight.tight,
  },
  h2: {
    fontSize: TYPOGRAPHY.fontSize['5xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    lineHeight: TYPOGRAPHY.lineHeight.tight,
  },
  h3: {
    fontSize: TYPOGRAPHY.fontSize['4xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    lineHeight: TYPOGRAPHY.lineHeight.tight,
  },
  h4: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    lineHeight: TYPOGRAPHY.lineHeight.normal,
  },
  h5: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    lineHeight: TYPOGRAPHY.lineHeight.normal,
  },
  h6: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    lineHeight: TYPOGRAPHY.lineHeight.normal,
  },
  body: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.normal,
    lineHeight: TYPOGRAPHY.lineHeight.normal,
  },
  'body-small': {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.normal,
    lineHeight: TYPOGRAPHY.lineHeight.normal,
  },
  caption: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.normal,
    lineHeight: TYPOGRAPHY.lineHeight.tight,
  },
} as const

/**
 * TRANSITIONS
 */
export const TRANSITION = {
  base: `color ${DURATION.normal} ${EASING['ease-out']}, background-color ${DURATION.normal} ${EASING['ease-out']}, border-color ${DURATION.normal} ${EASING['ease-out']}`,
  colors: `color ${DURATION.fast} ${EASING['ease-out']}, background-color ${DURATION.fast} ${EASING['ease-out']}, border-color ${DURATION.fast} ${EASING['ease-out']}, box-shadow ${DURATION.fast} ${EASING['ease-out']}`,
  all: `all ${DURATION.normal} ${EASING['ease-out']}`,
  opacity: `opacity ${DURATION.normal} ${EASING['ease-out']}`,
  transform: `transform ${DURATION.normal} ${EASING['ease-out']}`,
} as const

/**
 * ACCESSIBILITY - WCAG 2.1 AA Compliance
 */
export const A11Y = {
  // Minimum color contrast ratios
  contrastRatio: {
    normal: 4.5, // For body text
    large: 3, // For large text (18pt+ or 14pt bold+)
    ui: 3, // For UI components
  },
  // Focus indicator specs
  focusRing: {
    width: '2px',
    offset: '2px',
    color: COLOR.primary[600],
  },
  // Touch target minimum
  touchTarget: {
    width: 44,
    height: 44,
  },
} as const

/**
 * Type-safe spacing multiplier
 * Use for dynamic spacing calculations
 */
export const SPACE_UNIT = 4 // pixels

/**
 * Get spacing value by unit count
 */
export function getSpacing(units: number): string {
  return `${units * SPACE_UNIT}px`
}

/**
 * Get breakpoint query
 */
export function getMediaQuery(breakpoint: keyof typeof BREAKPOINT): string {
  return `@media (min-width: ${BREAKPOINT[breakpoint]})`
}

/**
 * Get text style
 */
export function getTextStyle(
  style: keyof typeof TEXT
): Record<string, string | number> {
  return TEXT[style] as Record<string, string | number>
}
