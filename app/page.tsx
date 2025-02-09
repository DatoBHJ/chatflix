'use client'

import { useChat } from 'ai/react'
import { useState } from 'react'
import { IconRefresh, IconStop } from './components/icons'
import { Message } from 'ai'

export default function Page() {
  const [currentModel, setCurrentModel] = useState('deepseek-reasoner')
  const [nextModel, setNextModel] = useState(currentModel)  // 다음 메시지에 사용할 모델

  const { messages, input, handleInputChange, handleSubmit, isLoading, stop, reload, setMessages } = useChat({
    api: '/api/chat',
    body: {
      model: currentModel,
    },
    streamProtocol: 'data',
    initialMessages: [
      {
        id: 'system-1',
        role: 'system',
        content: 'You are a helpful assistant.',
      },
    ],
  })

  const handleStop = (e: React.MouseEvent) => {
    e.preventDefault()
    stop()
  }

  const handleReload = (messageId: string) => async (e: React.MouseEvent) => {
    e.preventDefault()
    
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) return
    
    const previousMessages = messages.slice(0, messageIndex)
    const lastUserMessage = messages
      .slice(0, messageIndex + 1)
      .reverse()
      .find(m => m.role === 'user')
    
    if (lastUserMessage) {
      setMessages(previousMessages)
      await reload({
        body: {
          messages: [...previousMessages, lastUserMessage],
          model: currentModel,
        }
      })
    }
  }

  const handleModelSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentModel(nextModel)
    await handleSubmit(e, {
      body: {
        model: nextModel
      }
    })
  }

  return (
    <main className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full">
          <div className="space-y-6 p-4 pb-32">
            {messages.map((message) => (
              <div key={message.id} className="group">
                <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 ${
                    message.role === 'user' 
                      ? 'bg-[var(--accent)]' 
                      : 'bg-[var(--background)] border border-[var(--accent)]'
                  }`}>
                    {message.parts?.map((part, index) => {
                      if (part.type === 'reasoning') {
                        return (
                          <div key={index} className="bg-[var(--accent)] bg-opacity-30 p-2 mb-2">
                            <div className="text-sm opacity-70">Reasoning:</div>
                            {part.reasoning}
                          </div>
                        );
                      }
                      if (part.type === 'text') {
                        return (
                          <div key={index} className="whitespace-pre-wrap">
                            {part.text}
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
                {message.role === 'assistant' && (
                  <div className="flex justify-start pl-4 mt-1">
                    <button 
                      onClick={handleReload(message.id)}
                      className="text-xs opacity-50 hover:opacity-100 transition-opacity flex items-center gap-1"
                    >
                      <IconRefresh className="w-3 h-3" />
                      <span>Regenerate response</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent pt-6 pb-4">
        <div className="max-w-2xl mx-auto w-full px-4">
          <form onSubmit={handleModelSubmit} className="flex flex-col gap-4">
            {/* 모델 선택 드롭다운 - 입력창 위에 표시 */}
            <div className="flex items-center gap-2">
              <span className="text-xs opacity-70">Using:</span>
              <select
                value={nextModel}
                onChange={(e) => setNextModel(e.target.value)}
                className="text-xs bg-transparent border-none focus:outline-none hover:opacity-100 opacity-70"
              >
                <option value="deepseek-reasoner">DeepSeek Reasoner</option>
                <option value="deepseek-chat">DeepSeek Chat</option>
                <option value="deepseek-ai/DeepSeek-R1">DeepSeek R1 (Together)</option>
                <option value="deepseek-ai/DeepSeek-V3">DeepSeek V3 (Together)</option>
                <option value="DeepSeek r1 distill llama 70b">DeepSeek R1 (Groq)</option>
                <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet</option>
              </select>
            </div>

            <div className="flex gap-2">
              <input
                value={input}
                onChange={handleInputChange}
                placeholder="Type your message..."
                className="yeezy-input flex-1 text-lg"
              />
              {isLoading ? (
                <button 
                  onClick={handleStop} 
                  type="button"
                  className="yeezy-button flex items-center gap-2"
                >
                  <IconStop />
                  <span>Stop</span>
                </button>
              ) : (
                <button 
                  type="submit" 
                  className="yeezy-button"
                  disabled={isLoading}
                >
                  Send
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
