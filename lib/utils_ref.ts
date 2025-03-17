// // /lib/utils_ref.ts - just for reference
// import { type ClassValue, clsx } from "clsx"
// import { twMerge } from "tailwind-merge"
// import { Globe} from 'lucide-react'

// export function cn(...inputs: ClassValue[]) {
//   return twMerge(clsx(inputs))
// }

// export function generateId(prefix: string): string {
//   return `${prefix}-${Math.random().toString(36).substring(2, 15)}`;
// }

// export function getUserId(): string {
//   if (typeof window === 'undefined') return '';
  
//   let userId = localStorage.getItem('mem0_user_id');
//   if (!userId) {
//     userId = generateId('user');
//     localStorage.setItem('mem0_user_id', userId);
//   }
//   return userId;
// }

// export type SearchGroupId = 'web' |'chat';

// export const searchGroups = [
//   {
//     id: 'web' as const,
//     name: 'Web',
//     description: 'Search across the entire internet',
//     icon: Globe,
//     show: true,
//   },
//   {
//     id: 'chat' as const,
//     name: 'Chat',
//     description: 'Talk to the model directly.',
//     // icon: ChatsCircle,
//     show: true,
//   },
// ] as const;

// export type SearchGroup = typeof searchGroups[number];