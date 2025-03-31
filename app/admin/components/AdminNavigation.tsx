'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  name: string;
  href: string;
}

export default function AdminNavigation() {
  const pathname = usePathname();
  
  const navItems: NavItem[] = [
    { name: 'Model Management', href: '/admin' },
    // { name: 'User Insights', href: '/admin/insights' },
    { name: 'Analytics', href: '/admin/analytics' },
    { name: 'Home', href: '/' },
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