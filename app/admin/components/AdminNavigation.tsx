'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BarChart, Settings, Sparkles, FileWarning } from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
}

export default function AdminNavigation() {
  const pathname = usePathname();
  
  const navItems: NavItem[] = [
    { name: 'Dashboard', href: '/admin', icon: Home },
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart },
    { name: 'What\'s New', href: '/admin/whats-new', icon: Sparkles },
    { name: 'Problem Reports', href: '/admin/problem-reports', icon: FileWarning },
  ];

  return (
    <div className="py-4 px-6 flex border-b" style={{ 
      borderColor: 'var(--border)',
      backgroundColor: 'var(--background)'
    }}>
      <div className="flex space-x-6">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          
          return (
            <Link 
              key={item.href}
              href={item.href}
              className={`text-sm ${isActive ? 'font-semibold' : 'opacity-70 hover:opacity-100'}`}
              style={{ 
                color: 'var(--foreground)',
                transition: 'opacity 0.15s ease-in-out'
              }}
            >
              {item.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
} 