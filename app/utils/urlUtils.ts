/**
 * URL 관련 유틸리티 함수들
 */

/**
 * Signed URL이 만료되었는지 확인
 * @param url - 확인할 URL
 * @returns 만료 여부
 */
export const isUrlExpired = (url: string): boolean => {
  try {
    // blob: 또는 data: URL은 만료되지 않음
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      return false;
    }

    const urlObj = new URL(url);

    // Supabase Signed URL의 경우 JWT 토큰에서 만료 시간 추출
    if (url.includes('supabase.co/storage/v1/object/sign/') || url.includes('auth.chatflix.app/storage/v1/object/sign/')) {
      const token = urlObj.searchParams.get('token');
      
      if (token) {
        try {
          // JWT 토큰 디코딩 (간단한 base64 디코딩)
          const payload = JSON.parse(atob(token.split('.')[1]));
          const exp = payload.exp;

          if (exp) {
            const expiryTime = exp * 1000; // 초를 밀리초로 변환
            const now = Date.now();
            return now >= expiryTime;
          }
        } catch (jwtError) {
          // JWT 파싱 실패 시 만료된 것으로 간주
          return true;
        }
      }
    }

    // 일반적인 expires 파라미터 체크
    const expires = urlObj.searchParams.get('expires');
    
    if (expires) {
      const expiryTime = parseInt(expires) * 1000; // 초를 밀리초로 변환
      const now = Date.now();
      return now >= expiryTime;
    }

    // expires 파라미터가 없으면 만료되지 않은 것으로 간주
    return false;
  } catch (error) {
    // URL 파싱 실패 시 만료된 것으로 간주
    return true;
  }
};

/**
 * URL에서 파일 경로 추출
 * @param url - Supabase Storage URL
 * @returns 파일 경로 또는 null
 */
export const extractFilePath = (url: string): string | null => {
  try {
    const buckets = ['chat_attachments', 'generated-images', 'generated-videos', 'saved-gallery'];
    for (const bucket of buckets) {
      if (url.includes(`${bucket}/`)) {
        const pathMatch = url.split(`${bucket}/`)[1];
      if (pathMatch) {
        // 쿼리 파라미터 제거
        return pathMatch.split('?')[0];
        }
      }
    }
    return null;
  } catch (error) {
    console.warn('Failed to extract file path:', error);
    return null;
  }
};

/**
 * URL 갱신이 필요한지 확인
 * @param url - 확인할 URL
 * @returns 갱신 필요 여부
 */
export const needsUrlRefresh = (url: string): boolean => {
  // Supabase Storage URL이 아니면 갱신 불필요
  if (!url.includes('supabase.co/storage/v1/object/sign/') && !url.includes('auth.chatflix.app/storage/v1/object/sign/')) {
    return false;
  }
  
  // 만료되었으면 갱신 필요
  return isUrlExpired(url);
};

/**
 * Supabase Storage Signed URL에서 버킷 이름 추출
 * @param url - Supabase Storage Signed URL
 * @returns 버킷 이름 또는 null
 */
export const extractBucketName = (url: string): string | null => {
  try {
    // Supabase Signed URL 형식: .../storage/v1/object/sign/BUCKET_NAME/PATH?token=...
    if (url.includes('/storage/v1/object/sign/')) {
      const match = url.match(/\/storage\/v1\/object\/sign\/([^\/]+)\//);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  } catch (error) {
    console.warn('Failed to extract bucket name from URL:', error);
    return null;
  }
};
