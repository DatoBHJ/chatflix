'use client'

import React, { useState } from 'react'
import { X, Copy, Check, Image as ImageIcon, Folder } from 'lucide-react'
import { getAdaptiveGlassStyleBlur } from '@/app/lib/adaptiveGlassStyle'

export interface ShareItem {
  id: string
  title: string
  link: string
  type: 'image' | 'project'
}

interface ShareLinksModalProps {
  isOpen: boolean
  onClose: () => void
  items: ShareItem[]
}

export function ShareLinksModal({ isOpen, onClose, items }: ShareLinksModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)

  if (!isOpen) return null

  const handleCopy = async (id: string, link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy link', err)
    }
  }

  const handleCopyAll = async () => {
    const allLinks = items.map(item => item.link).join('\n')
    try {
      await navigator.clipboard.writeText(allLinks)
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 2000)
    } catch (err) {
      console.error('Failed to copy all links', err)
    }
  }

  return (
    <div 
      className="fixed inset-0 z-[100010] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-lg overflow-hidden rounded-[32px] shadow-2xl animate-in zoom-in-95 duration-200"
        style={{
          ...(() => {
            const glassStyle = getAdaptiveGlassStyleBlur()
            const { background, ...restStyle } = glassStyle as any
            return restStyle
          })(),
          backgroundColor: 'rgba(23, 23, 23, 0.85)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-2">
          <h2 className="text-xl font-bold text-white">Share Links</h2>
          <button 
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white transition-colors bg-white/5 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {/* List */}
        <div className="p-6 pt-2 max-h-[60vh] overflow-y-auto space-y-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:display-none">
          {items.map((item) => (
            <div key={item.id} className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-white/80">
                <div className={`w-5 h-5 flex items-center justify-center rounded-md ${item.type === 'project' ? 'bg-blue-500' : 'bg-emerald-500'}`}>
                  {item.type === 'project' ? <Folder size={12} className="text-white" /> : <ImageIcon size={12} className="text-white" />}
                </div>
                <span className="truncate font-medium">{item.title}</span>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-white/5 rounded-2xl group transition-all hover:bg-white/[0.08]">
                <span className="flex-1 text-sm text-white/40 truncate select-all font-mono">
                  {item.link}
                </span>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleCopy(item.id, item.link)}
                    className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-90"
                    title="Copy Link"
                  >
                    {copiedId === item.id ? <Check size={18} className="text-blue-400" /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 pt-2 space-y-6">
          <p className="text-xs text-blue-400/90 font-medium">
            Anyone with these links can view and download the data.
          </p>
          
          <button 
            onClick={handleCopyAll}
            disabled={items.length === 0}
            className="w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-black/20"
          >
            {copiedAll ? (
              <span className="flex items-center justify-center gap-2">
                <Check size={20} /> {items.length === 1 ? 'Link copied!' : 'All links copied!'}
              </span>
            ) : (
              items.length === 1 ? 'Copy Link' : 'Copy All Links'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

