import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { isUrlExpired, extractFilePath, extractBucketName } from '../utils/urlUtils';

interface UseUrlRefreshOptions {
  url: string;
  enabled?: boolean;
}

/**
 * URL 자동 갱신 훅
 * Signed URL이 만료되면 자동으로 새 URL을 생성
 */
interface ExtendedOptions extends UseUrlRefreshOptions {
  messageId?: string;
  chatId?: string;
  userId?: string;
}

export const useUrlRefresh = ({ url, enabled = true, messageId, chatId, userId }: ExtendedOptions) => {
  const [refreshedUrl, setRefreshedUrl] = useState(url);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [dbRefreshTriggered, setDbRefreshTriggered] = useState(false);

  // URL 갱신 함수
  const refreshUrl = useCallback(async () => {
    if (!enabled || !url) {
      return url;
    }

    // Supabase Storage URL이 아니면 갱신 불필요
    if (!url.includes('supabase.co/storage/v1/object/sign/') && !url.includes('auth.chatflix.app/storage/v1/object/sign/')) {
      return url;
    }

    // 이미 만료되지 않았으면 갱신 불필요
    if (!isUrlExpired(url)) {
      return url;
    }
    
    setIsRefreshing(true);
    setRefreshError(null);
    
    try {
      const filePath = extractFilePath(url);
      const bucketName = extractBucketName(url);
      
      if (!filePath || !bucketName) {
        throw new Error('Failed to extract file path or bucket name from URL');
      }
      
      const supabase = createClient();
      const { data: signedData, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, 24 * 60 * 60); // 24시간
      
      if (error) {
        throw error;
      }
      
      if (signedData?.signedUrl) {
        setRefreshedUrl(signedData.signedUrl);
        
        // 데이터베이스의 URL도 갱신 (백그라운드에서 실행 - chat_attachments인 경우에만 기존 API 호출)
        if (bucketName === 'chat_attachments' && messageId && chatId && userId && !dbRefreshTriggered) {
          setDbRefreshTriggered(true);
          
          fetch('/api/chat/refresh-attachment-urls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageId, chatId, userId })
          })
            .then(res => res.json())
            .catch(() => {
              // 조용히 실패 처리
            });
        }
        
        return signedData.signedUrl;
      } else {
        throw new Error('Failed to create signed URL');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setRefreshError(errorMessage);
      return url; // 실패 시 원본 URL 반환
    } finally {
      setIsRefreshing(false);
    }
  }, [url, enabled, messageId, chatId, userId, dbRefreshTriggered]);

  // URL이 변경되면 갱신된 URL 업데이트
  useEffect(() => {
    setRefreshedUrl(url);
  }, [url]);

  // 컴포넌트 마운트 시 자동 갱신 체크
  useEffect(() => {
    if (enabled && url) {
      const expired = isUrlExpired(url);
      if (expired) {
        refreshUrl();
      }
    }
  }, [enabled, url, refreshUrl]);

  return {
    refreshedUrl,
    isRefreshing,
    refreshError,
    refreshUrl
  };
};
