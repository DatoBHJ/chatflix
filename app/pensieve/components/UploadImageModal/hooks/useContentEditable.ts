import { useState, useCallback, useRef } from 'react'
import { normalizeJsonPrompt } from '../utils/normalizeJson'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function useContentEditable() {
  const [insertedImages, setInsertedImages] = useState<Map<string, { blobUrl: string; base64: string; file: File }>>(new Map())
  const [editInsertedImages, setEditInsertedImages] = useState<Map<string, { blobUrl: string; base64: string; file: File }>>(new Map())
  const contentEditableRef = useRef<HTMLDivElement>(null)
  const editContentEditableRef = useRef<HTMLDivElement>(null)

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const insertImageIntoContentEditable = useCallback(async (file: File, isEdit: boolean = false) => {
    if (!ALLOWED_TYPES.includes(file.type)) return { error: '지원하지 않는 파일 형식입니다.' }
    if (file.size > MAX_SIZE) return { error: '파일 크기가 10MB를 초과합니다.' }

    const targetRef = isEdit ? editContentEditableRef : contentEditableRef
    if (!targetRef.current) return { error: '입력 영역을 찾을 수 없습니다.' }

    try {
      const blobUrl = URL.createObjectURL(file)
      const base64 = await fileToBase64(file)
      const imageId = `img_${Date.now()}_${Math.random().toString(36).slice(2)}`
      
      const setter = isEdit ? setEditInsertedImages : setInsertedImages
      setter(prev => {
        const next = new Map(prev)
        next.set(imageId, { blobUrl, base64, file })
        return next
      })

      const container = document.createElement('div')
      container.style.display = isEdit ? 'inline-block' : 'block'
      container.style.position = 'relative'
      container.style.width = isEdit ? 'auto' : '100%'
      container.style.margin = isEdit ? '0 4px' : '16px 0'
      container.style.borderRadius = isEdit ? '6px' : '12px'
      container.style.overflow = 'hidden'
      container.contentEditable = 'false'
      
      const img = document.createElement('img')
      img.src = blobUrl
      img.setAttribute('data-image-id', imageId)
      img.style.width = isEdit ? 'auto' : '100%'
      img.style.height = isEdit ? '48px' : 'auto'
      img.style.display = 'block'
      img.style.borderRadius = isEdit ? '6px' : '12px'
      img.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1)'
      
      container.appendChild(img)
      
      const selection = window.getSelection()
      
      // Helper function to create a new line element (Notion style)
      const createNewLine = () => {
        if (isEdit) {
          // For edit mode, use <br> for inline
          const br = document.createElement('br')
          return br
        } else {
          // For initial mode, use a div block for new line
          const newLineDiv = document.createElement('div')
          newLineDiv.style.minHeight = '1.625em'
          return newLineDiv
        }
      }
      
      // Helper function to set cursor after a node
      const setCursorAfter = (node: Node, sel: Selection) => {
        const range = document.createRange()
        if (node.nextSibling) {
          // If there's a next sibling, set cursor before it
          range.setStartBefore(node.nextSibling)
          range.collapse(true)
        } else {
          // If no next sibling, set cursor after the node
          range.setStartAfter(node)
          range.collapse(true)
        }
        sel.removeAllRanges()
        sel.addRange(range)
      }
      
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        if (targetRef.current.contains(range.commonAncestorContainer)) {
          // Insert at cursor position
          range.deleteContents()
          range.insertNode(container)
          
          // Create and insert new line element after the image
          const newLine = createNewLine()
          range.setStartAfter(container)
          range.insertNode(newLine)
          
          // Move cursor to the new line (after the new line element)
          setCursorAfter(newLine, selection)
        } else {
          // Append to end
          targetRef.current.appendChild(container)
          
          // Add new line element after the image
          const newLine = createNewLine()
          targetRef.current.appendChild(newLine)
          
          // Set cursor after the new line
          if (selection) {
            setCursorAfter(newLine, selection)
          }
        }
      } else {
        // No selection, append to end
        targetRef.current.appendChild(container)
        
        // Add new line element after the image
        const newLine = createNewLine()
        targetRef.current.appendChild(newLine)
        
        // Set cursor after the new line
        if (selection) {
          setCursorAfter(newLine, selection)
        }
      }

      // Ensure contentEditable remains focused
      targetRef.current.focus()
      
      // Trigger input event to update state
      const inputEvent = new Event('input', { bubbles: true })
      targetRef.current.dispatchEvent(inputEvent)

      return { success: true, imageId, blobUrl }
    } catch (error) {
      console.error('Failed to insert image:', error)
      return { error: '이미지 삽입에 실패했습니다.' }
    }
  }, [])

  const extractContentFromEditable = useCallback((isEdit: boolean = false) => {
    const targetRef = isEdit ? editContentEditableRef : contentEditableRef
    const imagesMap = isEdit ? editInsertedImages : insertedImages
    
    if (!targetRef.current) return { text: '', images: [], metadata: [] }

    const images: string[] = []
    const metadata: Array<{ blobUrl: string; base64: string; order: number; imageId?: string }> = []
    let text = ''

    const walker = document.createTreeWalker(
      targetRef.current,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT
          if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'IMG') return NodeFilter.FILTER_ACCEPT
          return NodeFilter.FILTER_SKIP
        }
      }
    )

    let node
    while (node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || ''
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const img = node as HTMLImageElement
        const imageId = img.getAttribute('data-image-id')
        if (imageId && imagesMap.has(imageId)) {
          const imageData = imagesMap.get(imageId)!
          images.push(imageData.base64)
          // 편집 모드에서는 부모 슬라이드가 [image 1]이므로 추가 이미지는 [image 2]부터 시작
          // 일반 모드에서는 첫 이미지가 [image 1]부터 시작
          const order = isEdit ? images.length + 1 : images.length
          metadata.push({ blobUrl: imageData.blobUrl, base64: imageData.base64, order, imageId })
          text += ` [image ${order}] `
        }
      }
    }

    // Normalize the text to clean up JSON if detected
    const normalizedText = normalizeJsonPrompt(text.trim())
    return { text: normalizedText, images, metadata }
  }, [insertedImages, editInsertedImages])

  return {
    insertedImages,
    setInsertedImages,
    editInsertedImages,
    setEditInsertedImages,
    contentEditableRef,
    editContentEditableRef,
    insertImageIntoContentEditable,
    extractContentFromEditable
  }
}

