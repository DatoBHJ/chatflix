import { Metadata } from 'next';
import AdminNavigation from './components/AdminNavigation';

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
    <div 
      className="min-h-screen"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <AdminNavigation />
      {children}
    </div>
  );
} 