'use client'

import { useState } from 'react'
import { Sidebar } from './components/Sidebar'

export default function RootLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Sidebar Toggle Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed top-8 left-4 z-50 w-8 h-8 flex items-center justify-center bg-[var(--accent)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
        title={isSidebarOpen ? "Close menu" : "Open menu"}
      >
        {isSidebarOpen ? '×' : '≡'}
      </button>

      {/* Sidebar with transition */}
      <div 
        className={`fixed left-0 top-0 h-full transition-transform duration-300 ease-in-out z-40 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {children}
      </div>

      {/* Overlay when sidebar is open */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity z-30"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  )
} 