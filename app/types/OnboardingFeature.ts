/**
 * Onboarding Feature Types
 */

export type OnboardingLocation = 
  | 'quick-access' 
  | 'header' 
  | 'sidebar' 
  | 'settings'
  | 'chat'
  | 'memory'
  | 'photo';

export type OnboardingDisplayType = 
  | 'badge'      // Badge display
  | 'tooltip'    // Tooltip display
  | 'highlight'  // Highlight display
  | 'pulse';     // Pulse animation

export interface OnboardingFeature {
  /**
   * Unique feature key (e.g., 'quick_access_new_app_2024')
   * Key stored in database
   */
  key: string;

  /**
   * Display location
   */
  location: OnboardingLocation;

  /**
   * Display type
   */
  displayType: OnboardingDisplayType;

  /**
   * Display content - title
   */
  title: string;

  /**
   * Display content - description
   */
  description: string;

  /**
   * Selector for target element (optional)
   * Used to target specific UI elements
   */
  selector?: string;

  /**
   * Text to display on badge (used when displayType is 'badge')
   * Default: 'NEW'
   */
  badgeText?: string;

  /**
   * Badge color (optional)
   * Default: blue-500
   */
  badgeColor?: string;

  /**
   * Edit instruction (optional)
   * Instructions for editing displayed in tooltip
   * Example: "Right-click or long-press to enter edit mode"
   */
  editInstruction?: string;

  /**
   * Tooltip display position (optional)
   * Used when displayType is 'tooltip'
   * Default: 'top'
   */
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  /**
   * Onboarding step/order (optional)
   * Specify order when there are multiple onboarding steps
   * Lower numbers are displayed first
   */
  step?: number;

  /**
   * Condition for feature activation (optional)
   * Example: a specific app ID must exist
   */
  condition?: (context?: any) => boolean;
}

