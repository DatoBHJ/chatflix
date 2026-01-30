import React, { useState, useCallback } from 'react'
import { ChevronRight, ChevronDown, ScrollText, AlignLeft } from 'lucide-react'

interface JsonViewerProps {
  data: any
  searchQuery?: string
}

export function JsonViewer({ data, searchQuery = '' }: JsonViewerProps) {
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set())

  const toggleKey = useCallback((keyPath: string) => {
    setCollapsedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(keyPath)) {
        next.delete(keyPath)
      } else {
        next.add(keyPath)
      }
      return next
    })
  }, [])

  const query = searchQuery.toLowerCase()

  const highlightString = useCallback((text: string, keyPath: string): React.ReactNode => {
    if (!query || !text) return text
    const lower = text.toLowerCase()
    if (!lower.includes(query)) return text

    const parts: React.ReactNode[] = []
    let last = 0
    let idx = lower.indexOf(query, last)
    while (idx !== -1) {
      if (idx > last) parts.push(text.substring(last, idx))
      parts.push(
        <mark key={`${keyPath}-${idx}`} className="bg-yellow-400/30 text-yellow-200 rounded px-0.5">
          {text.substring(idx, idx + query.length)}
        </mark>
      )
      last = idx + query.length
      idx = lower.indexOf(query, last)
    }
    if (last < text.length) parts.push(text.substring(last))
    return <>{parts}</>
  }, [query])

  const INDENT_PX = 18

  // ========== JSON VIEW (Classic Code Style) - COMMENTED OUT ==========
  /*
  const [view, setView] = useState<'json' | 'clean'>('clean')

  function JsonLine({
    indent,
    togglePath,
    isCollapsed,
    children
  }: {
    indent: number
    togglePath?: string
    isCollapsed?: boolean
    children: React.ReactNode
  }) {
    return (
      <div
        className="flex items-start leading-[1.75] rounded-md hover:bg-white/5 transition-colors"
        style={{ paddingLeft: indent * INDENT_PX }}
      >
        {togglePath ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              toggleKey(togglePath)
            }}
            className="w-[18px] h-[18px] mt-[2px] flex items-center justify-center text-white/50 hover:text-white transition-colors shrink-0"
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        ) : (
          <span className="w-[18px] shrink-0" />
        )}
        <div className="min-w-0 whitespace-pre-wrap wrap-break-word font-mono text-[13px] sm:text-[14px] text-white/85 px-1.5 py-0.5">
          {children}
        </div>
      </div>
    )
  }

  const renderJsonPrimitive = useCallback((value: any, keyPath: string): React.ReactNode => {
    if (value === null) return <span className="text-white/55">null</span>
    if (typeof value === 'string') {
      return (
        <span className="text-white/70">
          "{highlightString(value, keyPath)}"
        </span>
      )
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return <span className="text-white/70">{String(value)}</span>
    }
    return <span className="text-white/70">{String(value)}</span>
  }, [highlightString])

  const renderJsonNode = useCallback((
    value: any,
    keyPath: string,
    indent: number,
    label: React.ReactNode,
    comma: boolean
  ): React.ReactNode => {
    const commaNode = comma ? <span className="text-white/40">,</span> : null

    if (value === null || typeof value !== 'object') {
      return (
        <JsonLine indent={indent}>
          <>
            {label}
            {renderJsonPrimitive(value, keyPath)}
            {commaNode}
          </>
        </JsonLine>
      )
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return (
          <JsonLine indent={indent}>
            <>
              {label}
              <span className="text-white/55">[]</span>
              {commaNode}
            </>
          </JsonLine>
        )
      }

      const isCollapsed = collapsedKeys.has(keyPath)
      if (isCollapsed) {
        return (
          <JsonLine indent={indent} togglePath={keyPath} isCollapsed>
            <>
              {label}
              <span className="text-white/55">[</span>
              <span className="text-white/40">…</span>
              <span className="text-white/55">]</span>
              {commaNode}
            </>
          </JsonLine>
        )
      }

      return (
        <>
          <JsonLine indent={indent} togglePath={keyPath} isCollapsed={false}>
            <>
              {label}
              <span className="text-white/55">[</span>
            </>
          </JsonLine>
          {value.map((item, idx) => (
            <React.Fragment key={`${keyPath}[${idx}]`}>
              {renderJsonNode(item, `${keyPath}[${idx}]`, indent + 1, null, idx < value.length - 1)}
            </React.Fragment>
          ))}
          <JsonLine indent={indent}>
            <>
              <span className="text-white/55">]</span>
              {commaNode}
            </>
          </JsonLine>
        </>
      )
    }

    const keys = Object.keys(value)
    if (keys.length === 0) {
      return (
        <JsonLine indent={indent}>
          <>
            {label}
            <span className="text-white/55">{'{}'}</span>
            {commaNode}
          </>
        </JsonLine>
      )
    }

    const isCollapsed = collapsedKeys.has(keyPath)
    if (isCollapsed) {
      return (
        <JsonLine indent={indent} togglePath={keyPath} isCollapsed>
          <>
            {label}
            <span className="text-white/55">{'{'}</span>
            <span className="text-white/40">…</span>
            <span className="text-white/55">{'}'}</span>
            {commaNode}
          </>
        </JsonLine>
      )
    }

    return (
      <>
        <JsonLine indent={indent} togglePath={keyPath} isCollapsed={false}>
          <>
            {label}
            <span className="text-white/55">{'{'}</span>
          </>
        </JsonLine>
        {keys.map((k, i) => {
          const childPath = keyPath ? `${keyPath}.${k}` : k
          const childLabel = <span className="text-white/90 font-medium">"{k}"</span>
          return (
            <React.Fragment key={childPath}>
              {renderJsonNode(
                value[k],
                childPath,
                indent + 1,
                <>
                  {childLabel}
                  <span className="text-white/55">: </span>
                </>,
                i < keys.length - 1
              )}
            </React.Fragment>
          )
        })}
        <JsonLine indent={indent}>
          <>
            <span className="text-white/55">{'}'}</span>
            {commaNode}
          </>
        </JsonLine>
      </>
    )
  }, [collapsedKeys, renderJsonPrimitive])
  */

  // ========== CLEAN VIEW (Apple Refined Document Style) ==========
  
  const renderCleanPrimitive = useCallback((value: any, keyPath: string): React.ReactNode => {
    if (value === null) {
      return <span className="text-white/30 italic text-[13px]">null</span>
    }
    if (typeof value === 'string') {
      return (
        <span className="text-white/85 leading-relaxed">
          {highlightString(value, keyPath)}
        </span>
      )
    }
    if (typeof value === 'number') {
      return <span className="text-blue-400 font-medium">{String(value)}</span>
    }
    if (typeof value === 'boolean') {
      return <span className="text-purple-400 font-medium">{String(value)}</span>
    }
    return <span className="text-white/80">{String(value)}</span>
  }, [highlightString])

  const renderCleanNode = useCallback((
    value: any,
    keyPath: string,
    depth: number,
    parentKey?: string,
    isArrayItem: boolean = false,
    index?: number
  ): React.ReactNode => {
    const isCollapsed = collapsedKeys.has(keyPath)

    // 1. Primitive value (Base Case)
    if (value === null || typeof value !== 'object') {
      return (
        <div className="group/item flex items-start gap-4 py-2 px-2 rounded-xl hover:bg-white/3 transition-colors">
          {/* Left rail: label / index */}
          <div className="w-24 sm:w-64 shrink-0 flex items-start justify-end pt-[2px]">
            {isArrayItem && index !== undefined ? (
              <span className="text-white/25 text-[11px] font-mono tabular-nums select-none">
                {String(index + 1).padStart(2, '0')}
              </span>
            ) : parentKey ? (
              <span className="text-white/55 text-[12px] font-semibold tracking-normal text-right select-none leading-tight">
                {parentKey}
              </span>
            ) : (
              <span className="text-white/20 text-[11px] select-none">&nbsp;</span>
            )}
          </div>

          {/* Right rail: value */}
          <div className="flex-1 min-w-0">
            <div className="text-[15px] sm:text-[16px] text-white/90">
              {renderCleanPrimitive(value, keyPath)}
            </div>
          </div>
        </div>
      )
    }

    // 2. Collection (Object or Array)
    const isArray = Array.isArray(value)
    const keys = isArray ? [] : Object.keys(value)
    const isEmpty = isArray ? value.length === 0 : keys.length === 0

    return (
      <div 
        className={`
          relative transition-all duration-300
          ${depth > 0 ? 'mt-2 mb-3 ml-2' : 'space-y-4'}
        `}
      >
        {/* Collection Header */}
        {(parentKey || (isArrayItem && index !== undefined)) && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleKey(keyPath)
            }}
            className={`
              flex items-center gap-3 w-full text-left py-2 px-3 rounded-2xl transition-colors
              bg-white/3 border border-white/6
              ${depth > 0 ? 'hover:bg-white/5' : 'hover:bg-white/4'}
            `}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-white/40 transition-transform duration-200">
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </span>
              
              <div className="flex flex-col">
                {isArrayItem && index !== undefined && !parentKey && (
                  <span className="text-white/20 text-[10px] font-mono font-bold tracking-widest uppercase mb-0.5">
                    Item {index + 1}
                  </span>
                )}
                {parentKey && (
                  <span className="text-white/90 font-semibold text-[13px] tracking-wide">
                    {parentKey}
                  </span>
                )}
              </div>

              {isCollapsed && (
                <span className="ml-auto text-white/35 text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
                  {isArray ? `${value.length} Items` : `${Object.keys(value).length} Properties`}
                </span>
              )}
            </div>
          </button>
        )}

        {/* Collection Content */}
        {!isCollapsed && !isEmpty && (
          <div 
            className={`
              relative space-y-1
              ${depth > 0 || parentKey ? 'ml-3 pl-4 border-l border-white/6' : ''}
            `}
          >
            {isArray ? (
              value.map((item, idx) => (
                <div key={`${keyPath}[${idx}]`}>
                  {renderCleanNode(item, `${keyPath}[${idx}]`, depth + 1, undefined, true, idx)}
                </div>
              ))
            ) : (
              Object.keys(value)
                .filter(k => !k.startsWith('_'))
                .map((k) => (
                  <div key={`${keyPath}.${k}`}>
                    {renderCleanNode(value[k], `${keyPath}.${k}`, depth + 1, k)}
                  </div>
                ))
            )}
          </div>
        )}

        {/* Empty State */}
        {!isCollapsed && (isEmpty || Object.keys(value).filter(k => !k.startsWith('_')).length === 0) && (
          <div className="ml-8 py-2 text-white/20 text-xs italic">
            Empty {isArray ? 'List' : 'Object'}
          </div>
        )}
      </div>
    )
  }, [collapsedKeys, renderCleanPrimitive, toggleKey])

  return (
    <div className="w-full select-text">
      {/* Toggle Button - COMMENTED OUT */}
      {/*
      <div className="absolute -top-4 -right-2 opacity-0 group-hover/viewer:opacity-100 transition-opacity duration-200 z-20">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setView(v => v === 'json' ? 'clean' : 'json')
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/80 backdrop-blur-xl border border-white/10 text-[11px] font-bold uppercase tracking-wider text-white/60 hover:text-white hover:border-white/20 transition-all shadow-2xl"
        >
          {view === 'json' ? <AlignLeft size={12} /> : <ScrollText size={12} />}
          <span>{view === 'json' ? 'Clean View' : 'JSON View'}</span>
        </button>
      </div>
      */}

      {/* Render - Always Clean View */}
      <div className="py-4">
        <div className="space-y-6">
          {renderCleanNode(data, '$', 0)}
        </div>
      </div>

      {/* JSON View Rendering - COMMENTED OUT */}
      {/*
      {view === 'json' 
        ? (
          <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
            {renderJsonNode(data, '$', 0, null, false)}
          </div>
        )
        : (
          <div className="space-y-6">
            {renderCleanNode(data, '$', 0)}
          </div>
        )
      }
      */}
    </div>
  )
}
