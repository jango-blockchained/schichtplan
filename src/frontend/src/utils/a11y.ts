/* ============================================================================
   ACCESSIBILITY UTILITIES - WCAG 2.1 AA Compliance Helpers
   ============================================================================
   Utilities for creating accessible components and checking compliance
   Version 1.0 | 2025-11-02
   ============================================================================ */

import { A11Y } from '../constants/design'

/**
 * Generate accessible ID for elements
 * Ensures unique IDs across application
 */
let idCounter = 0

export function createAccessibleId(prefix: string = 'a11y'): string {
  return `${prefix}-${++idCounter}`
}

/**
 * Reset ID counter (useful for testing)
 */
export function resetAccessibleId(): void {
  idCounter = 0
}

/**
 * Calculate color contrast ratio (WCAG formula)
 * Returns value between 1 and 21
 *
 * @param foreground - Foreground color in hex or rgb
 * @param background - Background color in hex or rgb
 * @returns Contrast ratio
 *
 * @example
 * const ratio = getContrastRatio('#000000', '#FFFFFF')
 * console.log(ratio) // 21 (maximum contrast)
 */
export function getContrastRatio(foreground: string, background: string): number {
  const fgLum = getLuminance(foreground)
  const bgLum = getLuminance(background)

  const lighter = Math.max(fgLum, bgLum)
  const darker = Math.min(fgLum, bgLum)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Get relative luminance of a color
 * Used for contrast ratio calculation
 */
function getLuminance(color: string): number {
  const rgb = hexToRgb(color)
  if (!rgb) return 0

  const [r, g, b] = [
    rgb.r / 255,
    rgb.g / 255,
    rgb.b / 255,
  ].map((value) => {
    if (value <= 0.03928) {
      return value / 12.92
    }
    return Math.pow((value + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

/**
 * Check if contrast ratio meets WCAG AA standard
 *
 * @param ratio - Contrast ratio
 * @param level - 'AA' (4.5:1 for normal) or 'AAA' (7:1 for normal)
 * @param isLargeText - True for large text (18pt+ or 14pt bold+)
 * @returns True if contrast ratio is acceptable
 *
 * @example
 * if (isContrastCompliant(5, 'AA')) {
 *   // Color combination is accessible
 * }
 */
export function isContrastCompliant(
  ratio: number,
  level: 'AA' | 'AAA' = 'AA',
  isLargeText: boolean = false
): boolean {
  if (level === 'AAA') {
    return isLargeText ? ratio >= 4.5 : ratio >= 7
  }
  // AA level
  return isLargeText ? ratio >= 3 : ratio >= 4.5
}

/**
 * Create accessible label for icon-only buttons
 *
 * @param icon - Icon name or description
 * @param action - Action the button performs
 * @returns Accessible label
 *
 * @example
 * const label = createAccessibleLabel('trash-icon', 'delete item')
 * // Returns: "Delete item"
 */
export function createAccessibleLabel(icon: string, action: string): string {
  return `${action} (${icon})`
}

/**
 * Create ARIA attributes for combobox
 *
 * @param isOpen - Whether dropdown is open
 * @param selectedId - ID of selected item
 * @returns ARIA attributes object
 */
export function createComboboxA11yAttributes(
  isOpen: boolean,
  selectedId?: string
): Record<string, string | boolean> {
  return {
    role: 'combobox',
    'aria-expanded': isOpen,
    'aria-haspopup': 'listbox',
    'aria-controls': isOpen ? 'listbox' : undefined,
    'aria-activedescendant': isOpen && selectedId ? selectedId : undefined,
  } as Record<string, string | boolean>
}

/**
 * Create ARIA attributes for listbox
 *
 * @param listId - ID of the list
 * @returns ARIA attributes object
 */
export function createListboxA11yAttributes(
  listId: string
): Record<string, string> {
  return {
    id: listId,
    role: 'listbox',
  }
}

/**
 * Create ARIA attributes for tab
 *
 * @param isActive - Whether tab is active
 * @param panelId - ID of associated panel
 * @returns ARIA attributes object
 */
export function createTabA11yAttributes(
  isActive: boolean,
  panelId: string
): Record<string, string | boolean> {
  return {
    role: 'tab',
    'aria-selected': isActive,
    'aria-controls': panelId,
  }
}

/**
 * Create ARIA attributes for tab panel
 *
 * @param tabId - ID of associated tab
 * @returns ARIA attributes object
 */
export function createTabPanelA11yAttributes(
  tabId: string
): Record<string, string> {
  return {
    role: 'tabpanel',
    'aria-labelledby': tabId,
  }
}

/**
 * Create ARIA attributes for dialog
 *
 * @param titleId - ID of dialog title
 * @returns ARIA attributes object
 */
export function createDialogA11yAttributes(
  titleId: string
): Record<string, string> {
  return {
    role: 'dialog',
    'aria-labelledby': titleId,
    'aria-modal': 'true',
  }
}

/**
 * Check if value is touch target compatible (44×44px minimum)
 *
 * @param size - Size in pixels
 * @returns True if size meets minimum
 *
 * @example
 * if (isTouchTargetCompatible(44)) {
 *   // Button is large enough for touch
 * }
 */
export function isTouchTargetCompatible(size: number): boolean {
  return size >= A11Y.touchTarget.width && size >= A11Y.touchTarget.height
}

/**
 * Generate focus ring styles
 *
 * @returns CSS string for focus ring
 */
export function getFocusRingStyles(): string {
  const { width, offset, color } = A11Y.focusRing
  return `outline: ${width} solid ${color}; outline-offset: ${offset};`
}

/**
 * Check if text passes WCAG AA contrast requirement
 *
 * @param foreground - Foreground color hex
 * @param background - Background color hex
 * @param isLargeText - Whether text is large (18pt+ or 14pt bold+)
 * @returns True if contrast is sufficient
 */
export function passesWCAGAA(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): boolean {
  const ratio = getContrastRatio(foreground, background)
  return isContrastCompliant(ratio, 'AA', isLargeText)
}

/**
 * Check if text passes WCAG AAA contrast requirement
 *
 * @param foreground - Foreground color hex
 * @param background - Background color hex
 * @param isLargeText - Whether text is large (18pt+ or 14pt bold+)
 * @returns True if contrast is sufficient
 */
export function passesWCAGAAA(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): boolean {
  const ratio = getContrastRatio(foreground, background)
  return isContrastCompliant(ratio, 'AAA', isLargeText)
}

/**
 * Create screen reader only text
 *
 * @param text - Text for screen readers only
 * @returns React JSX props for sr-only element
 */
export function getScreenReaderOnlyProps(): Record<string, string> {
  return {
    className: 'sr-only',
    'aria-hidden': 'false',
  }
}

/**
 * Create visually hidden but accessible text
 *
 * @returns React JSX props
 */
export function getVisuallyHiddenProps(): Record<string, string> {
  return {
    className: 'visually-hidden',
    'aria-hidden': 'false',
  }
}

/**
 * Check if element should be in tab order
 *
 * @param element - DOM element
 * @returns True if element should receive focus
 */
export function isKeyboardFocusable(element: HTMLElement): boolean {
  const tabindex = element.getAttribute('tabindex')
  const isNaturallyFocusable =
    element.tagName.match(/BUTTON|INPUT|TEXTAREA|SELECT|A/)

  if (isNaturallyFocusable && !element.hasAttribute('disabled')) {
    return true
  }

  if (tabindex !== null) {
    const tabindexValue = parseInt(tabindex, 10)
    return tabindexValue >= 0
  }

  return false
}

/**
 * Get recommended ARIA label for loading state
 *
 * @param context - What is loading (e.g., 'data', 'form')
 * @returns ARIA label
 */
export function getLoadingAriaLabel(context: string = 'content'): string {
  return `Loading ${context}...`
}

/**
 * Get recommended ARIA label for error state
 *
 * @param context - What errored (e.g., 'form submission')
 * @returns ARIA label
 */
export function getErrorAriaLabel(context: string = 'Error'): string {
  return `Error: ${context}`
}

/**
 * Get recommended ARIA label for success state
 *
 * @param context - What succeeded (e.g., 'form submission')
 * @returns ARIA label
 */
export function getSuccessAriaLabel(context: string = 'Success'): string {
  return `Success: ${context}`
}

/**
 * Create accessible attributes for required form field
 *
 * @returns ARIA attributes object
 */
export function getRequiredFieldA11yAttributes(): Record<string, string | boolean> {
  return {
    required: true,
    'aria-required': 'true',
  }
}

/**
 * Create accessible attributes for disabled state
 *
 * @param reason - Reason for disabling (optional)
 * @returns ARIA attributes object
 */
export function getDisabledA11yAttributes(
  reason?: string
): Record<string, string | boolean> {
  const attrs: Record<string, string | boolean> = {
    disabled: true,
    'aria-disabled': 'true',
  }

  if (reason) {
    attrs['aria-label'] = reason
  }

  return attrs
}

/**
 * Create accessible attributes for invalid form field
 *
 * @param errorId - ID of error message element
 * @returns ARIA attributes object
 */
export function getInvalidA11yAttributes(
  errorId: string
): Record<string, string | boolean> {
  return {
    'aria-invalid': 'true',
    'aria-describedby': errorId,
  }
}

/**
 * Create live region attributes for screen reader announcements
 * Use with aria-live and aria-atomic regions
 *
 * @param message - Message to announce
 * @param priority - 'polite' or 'assertive'
 * @returns ARIA attributes object
 *
 * @example
 * <div {...getLiveRegionA11yAttributes('Loading...', 'polite')}>
 *   {message}
 * </div>
 */
export function getLiveRegionA11yAttributes(
  priority: 'polite' | 'assertive' = 'polite'
): Record<string, string | boolean> {
  return {
    'aria-live': priority,
    'aria-atomic': 'true',
  }
}

/**
 * Type-safe ARIA roles
 */
export const ARIA_ROLES = {
  button: 'button',
  link: 'link',
  tab: 'tab',
  tablist: 'tablist',
  tabpanel: 'tabpanel',
  combobox: 'combobox',
  listbox: 'listbox',
  option: 'option',
  dialog: 'dialog',
  alertdialog: 'alertdialog',
  alert: 'alert',
  status: 'status',
  navigation: 'navigation',
  main: 'main',
  region: 'region',
  complementary: 'complementary',
  contentinfo: 'contentinfo',
  banner: 'banner',
  search: 'search',
  form: 'form',
  menu: 'menu',
  menuitem: 'menuitem',
  menuitemcheckbox: 'menuitemcheckbox',
  menuitemradio: 'menuitemradio',
} as const
