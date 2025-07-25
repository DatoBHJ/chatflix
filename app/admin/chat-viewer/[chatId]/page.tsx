'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, User, Bot, FileText, Download, Eye } from 'lucide-react'

interface Attachment {
  name: string
  url: string
  contentType: string
}

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  created_at: string
  model?: string
  experimental_attachments?: Attachment[]
}

interface ChatSession {
  id: string
  title?: string
  created_at: string
  user_id: string
}

export default function AdminChatViewerPage() {
  const params = useParams()
  const chatId = params.chatId as string
  const [messages, setMessages] = useState<Message[]>([])
  const [chatSession, setChatSession] = useState<ChatSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const renderAttachment = (attachment: Attachment) => {
    const isImage = attachment.contentType?.startsWith('image/')
    const isText = attachment.contentType?.includes('text') || 
                   (attachment.name && /\.(js|jsx|ts|tsx|html|css|json|md|py|java|c|cpp|cs|go|rb|php|swift|kt|rs|txt)$/i.test(attachment.name))
    
    if (isImage) {
      return (
        <div key={attachment.url} className="mt-2">
          <div className="relative inline-block">
            <Image
              src={attachment.url}
              alt={attachment.name}
              width={300}
              height={200}
              className="rounded-lg object-cover max-w-xs"
              style={{ maxHeight: '200px', width: 'auto' }}
            />
            <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
              {attachment.name}
            </div>
          </div>
        </div>
      )
    }
    
    return (
      <div key={attachment.url} className="mt-2">
        <div className="flex items-center gap-2 p-3 bg-[var(--muted)]/10 rounded-lg border border-[var(--accent)] max-w-xs">
          <FileText size={16} className="text-[var(--muted)]" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{attachment.name}</p>
            <p className="text-xs text-[var(--muted)]">{attachment.contentType}</p>
          </div>
          <div className="flex gap-1">
            {isText && (
              <a
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:bg-[var(--accent)] rounded transition-colors"
                title="View file"
              >
                <Eye size={14} />
              </a>
            )}
            <a
              href={attachment.url}
              download={attachment.name}
              className="p-1 hover:bg-[var(--accent)] rounded transition-colors"
              title="Download file"
            >
              <Download size={14} />
            </a>
          </div>
        </div>
      </div>
    )
  }

  useEffect(() => {
    async function loadChatData() {
      if (!chatId) return

      try {
        setIsLoading(true)
        
        // Fetch chat session and messages via API (using service role)
        const [sessionResponse, messagesResponse] = await Promise.all([
          fetch(`/api/admin/chat-viewer/${chatId}/session`),
          fetch(`/api/admin/chat-viewer/${chatId}/messages`)
        ])

        if (!sessionResponse.ok || !messagesResponse.ok) {
          throw new Error('Failed to load chat data')
        }

        const sessionData = await sessionResponse.json()
        const messagesData = await messagesResponse.json()

        setChatSession(sessionData)
        setMessages(messagesData)
      } catch (err: any) {
        setError(err.message || 'Failed to load chat')
      } finally {
        setIsLoading(false)
      }
    }

    loadChatData()
  }, [chatId])

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading chat...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-red-500">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link 
          href="/admin/problem-reports" 
          className="inline-flex items-center gap-2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Problem Reports
        </Link>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Chat Session Info */}
        <div className="bg-[var(--accent)] p-4 rounded-lg mb-6">
          <h1 className="text-xl font-semibold mb-2">
            {chatSession?.title || 'Untitled Chat'}
          </h1>
          <div className="text-sm text-[var(--muted)] space-y-1">
            <p>Chat ID: {chatId}</p>
            <p>User ID: {chatSession?.user_id}</p>
            <p>Created: {chatSession?.created_at && formatDistanceToNow(new Date(chatSession.created_at), { addSuffix: true })}</p>
            <p>Total Messages: {messages.length}</p>
            <p>Attachments: {messages.reduce((total, msg) => total + (msg.experimental_attachments?.length || 0), 0)}</p>
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-[var(--muted)]">
              No messages in this chat.
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 p-4 rounded-lg ${
                  message.role === 'user' 
                    ? 'bg-blue-500/10' 
                    : 'bg-[var(--accent)]'
                }`}
              >
                <div className="flex-shrink-0">
                  {message.role === 'user' ? (
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <User size={16} className="text-white" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <Bot size={16} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm">
                      {message.role === 'user' ? 'User' : 'Assistant'}
                    </span>
                    {message.model && (
                      <span className="text-xs bg-[var(--muted)]/20 px-2 py-0.5 rounded">
                        {message.model}
                      </span>
                    )}
                    <span className="text-xs text-[var(--muted)]">
                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm">
                      {message.content}
                    </pre>
                  </div>
                  
                  {/* Attachments */}
                  {message.experimental_attachments && message.experimental_attachments.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-[var(--muted)] mb-2 font-medium">
                        Attachments ({message.experimental_attachments.length})
                      </p>
                      <div className="space-y-2">
                        {message.experimental_attachments.map(renderAttachment)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
} 