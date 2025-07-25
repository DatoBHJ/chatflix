import { Metadata } from 'next';
import AdminNavigation from './components/AdminNavigation';
import AdminGuard from './components/AdminGuard';

export const metadata: Metadata = {
  title: 'Admin Dashboard - Model Rate Limits',
  description: 'Administrative dashboard for managing model rate limits',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <div 
        className="min-h-screen pt-[60px]"
        style={{ backgroundColor: 'var(--background)' }}
      >
        <AdminNavigation />
        {children}
      </div>
    </AdminGuard>
  );
} 