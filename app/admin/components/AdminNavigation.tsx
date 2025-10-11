'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BarChart, Settings, Sparkles, FileWarning, Database } from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
}

export default function AdminNavigation() {
  const pathname = usePathname();
  
  const navItems: NavItem[] = [
    { name: 'Dashboard', href: '/admin', icon: Home },
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart },
    { name: 'Refine Dashboard', href: '/admin/refine-dashboard', icon: BarChart },
    { name: 'What\'s New', href: '/admin/whats-new', icon: Sparkles },
    { name: 'Problem Reports', href: '/admin/problem-reports', icon: FileWarning },
    { name: 'Memory Viewer', href: '/admin/memory-viewer', icon: Database },
  ];

  return (
    <div className="py-4 px-6 flex border-b" style={{ 
      borderColor: 'var(--border)',
      backgroundColor: 'var(--background)'
    }}>
      <div className="flex space-x-6">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const IconComponent = item.icon;
          
          return (
            <Link 
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-2 text-sm ${isActive ? 'font-semibold' : 'opacity-70 hover:opacity-100'}`}
              style={{ 
                color: 'var(--foreground)',
                transition: 'opacity 0.15s ease-in-out'
              }}
            >
              <IconComponent size={16} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
} 