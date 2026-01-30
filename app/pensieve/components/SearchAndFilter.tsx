'use client'

import { Search, Filter } from 'lucide-react'
import { useState } from 'react'

interface SearchAndFilterProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedFolder: string | null
  onFolderChange: (folder: string | null) => void
  folders: string[]
}

export default function SearchAndFilter({
  searchQuery,
  onSearchChange,
  selectedFolder,
  onFolderChange,
  folders
}: SearchAndFilterProps) {
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  return (
    <div className="mb-8 space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--muted)]" />
        <input
          type="text"
          placeholder="Search by prompt or keywords..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-2xl bg-[var(--accent)] border border-[var(--subtle-divider)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]/20 transition-all"
        />
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Folder Filter */}
        <div className="relative">
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] border border-[var(--subtle-divider)] text-[var(--foreground)] hover:bg-[var(--subtle-divider)] transition-colors ${
              selectedFolder ? 'ring-2 ring-[var(--foreground)]/20' : ''
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">
              {selectedFolder ? selectedFolder : 'All Categories'}
            </span>
          </button>

          {showFilterDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowFilterDropdown(false)}
              />
              <div className="absolute top-full left-0 mt-2 w-64 rounded-xl bg-[var(--background)] border border-[var(--subtle-divider)] shadow-lg z-20 max-h-96 overflow-y-auto">
                <button
                  onClick={() => {
                    onFolderChange(null)
                    setShowFilterDropdown(false)
                  }}
                  className={`w-full text-left px-4 py-3 hover:bg-[var(--accent)] transition-colors ${
                    !selectedFolder ? 'bg-[var(--accent)] font-medium' : ''
                  }`}
                >
                  All Categories
                </button>
                {folders.map((folder) => (
                  <button
                    key={folder}
                    onClick={() => {
                      onFolderChange(folder)
                      setShowFilterDropdown(false)
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-[var(--accent)] transition-colors ${
                      selectedFolder === folder ? 'bg-[var(--accent)] font-medium' : ''
                    }`}
                  >
                    {folder}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Active Filters */}
      {(selectedFolder || searchQuery) && (
        <div className="flex flex-wrap items-center gap-2">
          {selectedFolder && (
            <button
              onClick={() => onFolderChange(null)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent)] text-sm text-[var(--foreground)] hover:bg-[var(--subtle-divider)] transition-colors"
            >
              {selectedFolder}
              <span className="text-[var(--muted)]">×</span>
            </button>
          )}
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent)] text-sm text-[var(--foreground)] hover:bg-[var(--subtle-divider)] transition-colors"
            >
              "{searchQuery}"
              <span className="text-[var(--muted)]">×</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

