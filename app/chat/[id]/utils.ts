import { DatabaseMessage } from '@/lib/types';
import { ExtendedMessage } from './types';
import { createClient } from '@/utils/supabase/client';
import { FileMetadata } from '@/lib/types';

// ================================
// 메타데이터 추출 함수들 (통합버전)
// ================================

// 이미지 메타데이터 추출 함수 (File 객체용)
export const extractImageMetadata = (file: File): Promise<FileMetadata> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const metadata: FileMetadata = {
        fileSize: file.size,
        width: img.naturalWidth,
        height: img.naturalHeight,
        format: file.type.split('/')[1] || 'unknown'
      };
      
      // 이미지 토큰 추정 (OpenAI GPT-4 Vision 기준)
      const baseTokens = 85;
      if (img.naturalWidth <= 512 && img.naturalHeight <= 512) {
        // Low detail mode
        metadata.estimatedTokens = baseTokens;
      } else {
        // High detail mode - 타일 기반 계산
        // 이미지를 최대 2048x2048로 조정
        let width = img.naturalWidth;
        let height = img.naturalHeight;
        
        if (width > 2048 || height > 2048) {
          const ratio = Math.min(2048 / width, 2048 / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }
        
        // 가장 짧은 변이 768px가 되도록 조정
        if (Math.min(width, height) > 768) {
          const ratio = 768 / Math.min(width, height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }
        
        // 512x512 타일로 분할
        const tilesX = Math.ceil(width / 512);
        const tilesY = Math.ceil(height / 512);
        const totalTiles = tilesX * tilesY;
        
        metadata.estimatedTokens = baseTokens + (totalTiles * 170);
      }
      
      resolve(metadata);
    };
    
    img.onerror = () => {
      // 이미지 로드 실패 시 기본 메타데이터
      resolve({
        fileSize: file.size,
        estimatedTokens: 1000 // 기본값
      });
    };
    
    img.src = URL.createObjectURL(file);
  });
};

// 이미지 메타데이터 추출 함수 (URL용)
export const extractImageMetadataFromUrl = async (url: string, name: string = ''): Promise<FileMetadata> => {
  return new Promise(async (resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // CORS 이슈 방지
      
      img.onload = () => {
        const metadata: FileMetadata = {
          fileSize: 0, // URL에서는 파일 크기를 정확히 알 수 없음
          width: img.naturalWidth,
          height: img.naturalHeight,
          format: name.split('.').pop() || 'unknown'
        };
        
        // 이미지 토큰 추정 (OpenAI GPT-4 Vision 기준)
        const baseTokens = 85;
        if (img.naturalWidth <= 512 && img.naturalHeight <= 512) {
          metadata.estimatedTokens = baseTokens;
        } else {
          let width = img.naturalWidth;
          let height = img.naturalHeight;
          
          if (width > 2048 || height > 2048) {
            const ratio = Math.min(2048 / width, 2048 / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }
          
          if (Math.min(width, height) > 768) {
            const ratio = 768 / Math.min(width, height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }
          
          const tilesX = Math.ceil(width / 512);
          const tilesY = Math.ceil(height / 512);
          const totalTiles = tilesX * tilesY;
          
          metadata.estimatedTokens = baseTokens + (totalTiles * 170);
        }
        
        console.log('🖼️ [DEBUG] Image metadata extracted:', { name, url: url.substring(0, 50) + '...', metadata });
        resolve(metadata);
      };
      
      img.onerror = () => {
        console.warn('⚠️ [DEBUG] Image load failed for:', name, url.substring(0, 50) + '...');
        resolve({
          fileSize: 0,
          estimatedTokens: 1000 // 기본값
        });
      };
      
      img.src = url;
    } catch (error) {
      console.warn('⚠️ [DEBUG] Image metadata extraction error:', error);
      resolve({
        fileSize: 0,
        estimatedTokens: 1000
      });
    }
  });
};

// PDF 메타데이터 추출 함수 (File 객체용)
export const extractPDFMetadata = async (file: File): Promise<FileMetadata> => {
  try {
    // PDF 파일을 읽어서 간단한 메타데이터 추출
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // PDF 파일에서 페이지 수 추정 (간단한 방법)
    const text = new TextDecoder().decode(uint8Array);
    const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
    const pageCount = pageMatches ? pageMatches.length : 1;
    
    // PDF 내 이미지 존재 여부 체크 (간단한 방법)
    const hasImages = text.includes('/XObject') && text.includes('/Image');
    
    // PDF 토큰 추정 (페이지당 토큰 수 계산)
    let estimatedTokens;
    if (hasImages) {
      estimatedTokens = pageCount * 3000; // 이미지 포함 페이지
    } else {
      estimatedTokens = pageCount * 1500; // 텍스트 위주 페이지
    }
    
    return {
      fileSize: file.size,
      pageCount,
      hasImages,
      estimatedTokens
    };
  } catch (error) {
    console.warn('PDF metadata extraction failed:', error);
    // 실패 시 파일 크기 기반 추정
    const estimatedPages = Math.max(1, Math.floor(file.size / (100 * 1024))); // 100KB per page 추정
    return {
      fileSize: file.size,
      pageCount: estimatedPages,
      hasImages: false,
      estimatedTokens: estimatedPages * 1500
    };
  }
};

// PDF 메타데이터 추출 함수 (URL용)
export const extractPDFMetadataFromUrl = async (url: string, name: string = ''): Promise<FileMetadata> => {
  try {
    console.log('📄 [DEBUG] Extracting PDF metadata from URL:', name, url.substring(0, 50) + '...');
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const text = new TextDecoder().decode(uint8Array);
    
    const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
    const pageCount = pageMatches ? pageMatches.length : 1;
    const hasImages = text.includes('/XObject') && text.includes('/Image');
    
    let estimatedTokens;
    if (hasImages) {
      estimatedTokens = pageCount * 3000;
    } else {
      estimatedTokens = pageCount * 1500;
    }
    
    const metadata = {
      fileSize: arrayBuffer.byteLength,
      pageCount,
      hasImages,
      estimatedTokens
    };
    
    console.log('📄 [DEBUG] PDF metadata extracted:', { name, metadata });
    return metadata;
  } catch (error) {
    console.warn('⚠️ [DEBUG] PDF metadata extraction failed:', name, error);
    const estimatedPages = Math.max(1, Math.floor(Math.random() * 10) + 1); // 추정값
    return {
      fileSize: 0,
      pageCount: estimatedPages,
      hasImages: false,
      estimatedTokens: estimatedPages * 1500
    };
  }
};

// 텍스트/코드 파일 메타데이터 추출 함수 (File 객체용)
export const extractTextMetadata = async (file: File): Promise<FileMetadata> => {
  try {
    const text = await file.text();
    const lines = text.split('\n');
    
    // 토큰 추정 (한국어/영어 혼합 고려)
    const isMainlyKorean = /[\uAC00-\uD7AF]/.test(text) && 
                           (text.match(/[\uAC00-\uD7AF]/g)?.length || 0) / text.length > 0.3;
    
    const estimatedTokens = isMainlyKorean ? 
      Math.ceil(text.length / 1.5) : 
      Math.ceil(text.length / 4);
    
    return {
      fileSize: file.size,
      lineCount: lines.length,
      characterCount: text.length,
      estimatedTokens
    };
  } catch (error) {
    console.warn('Text metadata extraction failed:', error);
    return {
      fileSize: file.size,
      estimatedTokens: Math.ceil(file.size / 4) // 기본 추정
    };
  }
};

// 텍스트/코드 파일 메타데이터 추출 함수 (URL용)
export const extractTextMetadataFromUrl = async (url: string, name: string = ''): Promise<FileMetadata> => {
  try {
    console.log('📝 [DEBUG] Extracting text metadata from URL:', name, url.substring(0, 50) + '...');
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const text = await response.text();
    const lines = text.split('\n');
    
    const isMainlyKorean = /[\uAC00-\uD7AF]/.test(text) && 
                           (text.match(/[\uAC00-\uD7AF]/g)?.length || 0) / text.length > 0.3;
    
    const estimatedTokens = isMainlyKorean ? 
      Math.ceil(text.length / 1.5) : 
      Math.ceil(text.length / 4);
    
    const metadata = {
      fileSize: text.length,
      lineCount: lines.length,
      characterCount: text.length,
      estimatedTokens
    };
    
    console.log('📝 [DEBUG] Text metadata extracted:', { name, metadata });
    return metadata;
  } catch (error) {
    console.warn('⚠️ [DEBUG] Text metadata extraction failed:', name, error);
    return {
      fileSize: 0,
      estimatedTokens: 2000 // 기본값
    };
  }
};

// 기본 파일 메타데이터 (알 수 없는 파일 타입)
export const extractDefaultMetadata = (file: File): FileMetadata => {
  return {
    fileSize: file.size,
    estimatedTokens: 2000 // 기본값
  };
};

// 첨부파일 메타데이터 보완 함수 (URL 기반)
export const enrichAttachmentsWithMetadata = async (attachments: any[] = []): Promise<any[]> => {
  if (!attachments || attachments.length === 0) {
    console.log('🔍 [DEBUG] No attachments to process');
    return attachments;
  }
  
  console.log('🔍 [DEBUG] Processing attachments for metadata:', attachments.length, 'files');
  
  const enrichedAttachments = await Promise.all(
    attachments.map(async (attachment) => {
      // 이미 메타데이터가 있으면 스킵
      if (attachment.metadata) {
        console.log('✅ [DEBUG] Metadata already exists for:', attachment.name);
        return attachment;
      }
      
      const fileName = attachment.name || '';
      const fileType = attachment.fileType || attachment.contentType || '';
      const url = attachment.url;
      
      if (!url) {
        console.warn('⚠️ [DEBUG] No URL for attachment:', fileName);
        return attachment;
      }
      
      console.log('🔄 [DEBUG] Extracting metadata for:', fileName, 'type:', fileType);
      
      let metadata: FileMetadata;
      
      try {
        if (fileType === 'image' || fileType.startsWith('image/') || 
            fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i)) {
          metadata = await extractImageMetadataFromUrl(url, fileName);
        } else if (fileType === 'pdf' || fileType === 'application/pdf' || 
                   fileName.toLowerCase().endsWith('.pdf')) {
          metadata = await extractPDFMetadataFromUrl(url, fileName);
        } else if (fileType === 'code' || fileType.includes('text') || 
                   fileName.match(/\.(js|jsx|ts|tsx|html|css|json|md|py|java|c|cpp|cs|go|rb|php|swift|kt|rs)$/i)) {
          metadata = await extractTextMetadataFromUrl(url, fileName);
        } else {
          metadata = {
            fileSize: 0,
            estimatedTokens: 2000 // 기본값
          };
          console.log('📁 [DEBUG] Default metadata for unknown file type:', fileName);
        }
        
        return {
          ...attachment,
          metadata
        };
      } catch (error) {
        console.error('❌ [DEBUG] Metadata extraction failed for:', fileName, error);
        return {
          ...attachment,
          metadata: {
            fileSize: 0,
            estimatedTokens: 2000
          }
        };
      }
    })
  );
  
  console.log('✅ [DEBUG] Finished processing attachments with metadata');
  return enrichedAttachments;
};

// ================================
// 기존 파일 업로드 및 변환 함수들
// ================================

export const uploadFile = async (file: File) => {
  const supabase = createClient();
  
  try {
    // 간단한 파일명 생성 - 타임스탬프 + 랜덤
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    // 파일 타입 결정
    let fileType: 'image' | 'code' | 'pdf' | 'file' = 'file';
    if (file.type.startsWith('image/')) {
      fileType = 'image';
    } else if (file.type.includes('text') || 
               fileExt === 'js' || fileExt === 'jsx' || fileExt === 'ts' || fileExt === 'tsx' || 
               fileExt === 'html' || fileExt === 'css' || fileExt === 'json' || 
               fileExt === 'md' || fileExt === 'py' || fileExt === 'java' || 
               fileExt === 'c' || fileExt === 'cpp' || fileExt === 'cs' || 
               fileExt === 'go' || fileExt === 'rb' || fileExt === 'php' || 
               fileExt === 'swift' || fileExt === 'kt' || fileExt === 'rs') {
      fileType = 'code';
    } else if (fileExt === 'pdf') {
      fileType = 'pdf';
    }

    // 메타데이터 추출
    let metadata: FileMetadata;
    switch (fileType) {
      case 'image':
        metadata = await extractImageMetadata(file);
        break;
      case 'pdf':
        metadata = await extractPDFMetadata(file);
        break;
      case 'code':
        metadata = await extractTextMetadata(file);
        break;
      default:
        metadata = extractDefaultMetadata(file);
        break;
    }

    // 파일 업로드
    const { data, error } = await supabase.storage
      .from('chat_attachments')
      .upload(filePath, file);

    if (error) {
      throw error;
    }

    // Signed URL 생성
    const { data: signedData, error: signedError } = await supabase.storage
      .from('chat_attachments')
      .createSignedUrl(filePath, 24 * 60 * 60); // 24 hours

    if (signedError || !signedData?.signedUrl) {
      throw new Error('Failed to create signed URL');
    }

    return {
      name: file.name,
      contentType: file.type,
      url: signedData.signedUrl,
      path: filePath,
      fileType,
      metadata
    };

  } catch (error) {
    console.error('Upload error:', error);
    
    // 업로드 실패 시 로컬 URL로 폴백 (전송은 계속 진행)
    const localUrl = URL.createObjectURL(file);
    console.warn('Using local fallback URL for file:', file.name);
    
    const fileExt = file.name.split('.').pop();
    let fileType: 'image' | 'code' | 'pdf' | 'file' = 'file';
    if (file.type.startsWith('image/')) {
      fileType = 'image';
    } else if (file.type.includes('text') || 
               fileExt === 'js' || fileExt === 'jsx' || fileExt === 'ts' || fileExt === 'tsx' || 
               fileExt === 'html' || fileExt === 'css' || fileExt === 'json' || 
               fileExt === 'md' || fileExt === 'py' || fileExt === 'java' || 
               fileExt === 'c' || fileExt === 'cpp' || fileExt === 'cs' || 
               fileExt === 'go' || fileExt === 'rb' || fileExt === 'php' || 
               fileExt === 'swift' || fileExt === 'kt' || fileExt === 'rs') {
      fileType = 'code';
    } else if (fileExt === 'pdf') {
      fileType = 'pdf';
    }
    
    // 폴백 시에도 간단한 메타데이터 제공
    let metadata: FileMetadata;
    if (fileType === 'image') {
      // 이미지는 비동기로 메타데이터 추출
      metadata = await extractImageMetadata(file).catch(() => ({
        fileSize: file.size,
        estimatedTokens: 1000
      }));
    } else {
      metadata = {
        fileSize: file.size,
        estimatedTokens: fileType === 'pdf' ? 5000 : fileType === 'code' ? 3000 : 2000
      };
    }
    
    return {
      name: file.name,
      contentType: file.type,
      url: localUrl,
      path: '', 
      fileType,
      metadata
    };
  }
};

// Keep backward compatibility
export const uploadImage = uploadFile;

export const convertMessage = (msg: DatabaseMessage): ExtendedMessage => {
  const baseMessage: any = {
    id: msg.id,
    content: msg.content,
    role: msg.role as 'user' | 'assistant' | 'system',
    createdAt: new Date(msg.created_at),
    model: msg.model,
    tool_results: msg.tool_results,
    annotations: msg.annotations || []
  };

  // Add experimental_attachments if they exist
  if (msg.experimental_attachments && msg.experimental_attachments.length > 0) {
    baseMessage.experimental_attachments = msg.experimental_attachments;
  }



  // Handle reasoning parts if present
  if (msg.role === 'assistant' && msg.reasoning) {
    return {
      ...baseMessage,
      parts: [
        {
          type: 'reasoning' as const,
          reasoning: msg.reasoning,
          details: [{ type: 'text', text: msg.reasoning }]
        },
        { type: 'text' as const, text: msg.content }
      ]
    };
  }

  return baseMessage;
};

export const deleteChat = async (chatId: string) => {
  const supabase = createClient();

  try {
    // 1. Delete all messages for this chat
    const { error: deleteMessagesError } = await supabase
      .from('messages')
      .delete()
      .eq('chat_session_id', chatId);

    if (deleteMessagesError) {
      console.error('Error deleting messages:', deleteMessagesError);
      throw deleteMessagesError;
    }

    // 2. Delete the chat session
    const { error: deleteChatError } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', chatId);

    if (deleteChatError) {
      console.error('Error deleting chat session:', deleteChatError);
      throw deleteChatError;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteChat:', error);
    throw error;
  }
}; 