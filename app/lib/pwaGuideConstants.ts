/**
 * PWA guide image paths and step data.
 * All images live under public/PWA/; filenames may contain spaces.
 */
import type { LucideIcon } from 'lucide-react';
import { Share, Plus, Home, MoreVertical, Download, Check } from 'lucide-react';

const PWA_BASE = '/PWA';

export function pwaImage(filename: string): string {
  return `${PWA_BASE}/${encodeURIComponent(filename)}`;
}

export type Step = {
  icon: LucideIcon;
  title: string;
  description: string;
  image: string;
};

export type BrowserGuide = {
  browser: string;
  steps: Step[];
  resultImage?: string;
  resultText?: string;
};

// iOS - Chrome: 4 steps (last is result, same structure as Safari)
export const iosChromeSteps: Step[] = [
  {
    icon: Share,
    title: 'Tap the Share button',
    description:
      'Open Chrome and go to chatflix.app. Tap the share button in the address bar at the top of your screen.',
    image: pwaImage('iOS Chrome 1.png'),
  },
  {
    icon: Plus,
    title: 'Select "Add to Home Screen"',
    description: 'Select the "Add to Home Screen" option from the share menu.',
    image: pwaImage('iOS Chrome 2.png'),
  },
  {
    icon: Home,
    title: 'Tap "Add"',
    description: 'You can customize the name if you like, then tap "Add" to install the PWA.',
    image: pwaImage('iOS Chrome 3.png'),
  },
  {
    icon: Home,
    title: 'Done',
    description: 'The PWA will appear on your home screen with all your other apps.',
    image: pwaImage('Essay PWA.png'),
  },
];

// iOS - Safari: 4 steps (last is result)
export const iosSafariSteps: Step[] = [
  {
    icon: Share,
    title: 'Tap the Share button',
    description:
      'Open Safari and go to chatflix.app. Tap the share button in the address bar at the bottom of your screen.',
    image: pwaImage('iOS Safari 1.png'),
  },
  {
    icon: Plus,
    title: 'Select "Add to Home Screen"',
    description: 'Select the "Add to Home Screen" option from the share menu.',
    image: pwaImage('iOS Safari 2.png'),
  },
  {
    icon: Home,
    title: 'Tap "Add"',
    description: 'You can customize the name if you like, then tap "Add".',
    image: pwaImage('iOS Safari 3.png'),
  },
  {
    icon: Home,
    title: 'Done',
    description: 'The chatflix.app PWA will appear on your home screen with all your other apps.',
    image: pwaImage('iOS Safari 4.png'),
  },
];

// Android - Chrome: 4 steps (last is result, same structure as iOS)
export const androidChromeSteps: Step[] = [
  {
    icon: MoreVertical,
    title: 'Open the menu',
    description:
      'Open Chrome and go to chatflix.app. Tap the three-dot menu next to the address bar at the top.',
    image: pwaImage('Android Chrome 1.png'),
  },
  {
    icon: Download,
    title: 'Select "Add to Home Screen"',
    description: 'Tap the "Add to Home Screen" option from the menu.',
    image: pwaImage('Android Chrome 2.png'),
  },
  {
    icon: Home,
    title: 'Tap "Install"',
    description: 'Confirm by tapping "Install" in the dialog that appears.',
    image: pwaImage('Android Chrome 3.png'),
  },
  {
    icon: Home,
    title: 'Done',
    description: 'The PWA will appear on your home screen with all your other apps.',
    image: pwaImage('Android Essay PWA.png'),
  },
];

// Desktop - Chrome: 2 steps (main flow)
export const desktopChromeSteps: Step[] = [
  {
    icon: Download,
    title: 'Click the install icon',
    description:
      'Open Chrome and go to chatflix.app. Click the "Install" or install-app icon in the address bar.',
    image: pwaImage('Desktop Chrome 1.png'),
  },
  {
    icon: Plus,
    title: 'Click "Install"',
    description: 'In the dialog that appears, click "Install" to add the app.',
    image: pwaImage('Desktop Chrome 2.png'),
  },
];

// Desktop - Chrome: alternative method (menu), shown as separate step below
export const desktopChromeAlternativeStep: Step = {
  icon: MoreVertical,
  title: 'Or use the menu',
  description:
    'Click the three-dot menu in the top-right corner of Chrome, then select "Cast, save, and share" → "Install page as app...".',
  image: pwaImage('Desktop Chrome 3.png'),
};

// Desktop - Safari: 2 steps
export const desktopSafariSteps: Step[] = [
  {
    icon: Share,
    title: 'Click Share, then "Add to Dock"',
    description:
      'Open Safari and go to chatflix.app. Click the Share button to the right of the address bar and select "Add to Dock".',
    image: pwaImage('Desktop Safari 1.png'),
  },
  {
    icon: Check,
    title: 'Edit name and click "Add"',
    description: 'Edit the name if you like, then click "Add". The PWA will appear in your Dock.',
    image: pwaImage('Desktop Safari 2.png'),
  },
];
