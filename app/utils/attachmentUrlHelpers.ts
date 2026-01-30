import { Attachment } from '@/lib/types';
import { createClient } from '@/utils/supabase/client';
import { extractFilePath, isUrlExpired } from './urlUtils';

const CHAT_ATTACHMENTS_BUCKET = 'chat_attachments';
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

interface EnsureFreshOptions {
  /**
   * Always refresh URLs even if they appear valid.
   */
  force?: boolean;
  /**
   * Number of seconds the refreshed signed URL should remain valid.
   */
  ttlSeconds?: number;
}

/**
 * Ensure every attachment has a fresh signed URL before use.
 * Falls back silently when a refresh cannot be performed.
 */
export const ensureFreshAttachmentUrls = async (
  attachments: Attachment[] = [],
  options: EnsureFreshOptions = {}
): Promise<Attachment[]> => {
  if (!attachments.length) {
    return attachments;
  }

  const { force = false, ttlSeconds = DEFAULT_TTL_SECONDS } = options;
  const supabase = createClient();

  const refreshedAttachments = await Promise.all(
    attachments.map(async (attachment) => {
      if (!attachment?.url) {
        return attachment;
      }

      // Non-Supabase URLs or blob/data URLs don't need refreshing.
      if (!attachment.url.includes(`${CHAT_ATTACHMENTS_BUCKET}/`)) {
        return attachment;
      }

      const needsRefresh = force || isUrlExpired(attachment.url);
      if (!needsRefresh) {
        return attachment;
      }

      const attachmentPath = attachment.path || extractFilePath(attachment.url);
      if (!attachmentPath) {
        return attachment;
      }

      try {
        const { data, error } = await supabase.storage
          .from(CHAT_ATTACHMENTS_BUCKET)
          .createSignedUrl(attachmentPath, ttlSeconds);

        if (error || !data?.signedUrl) {
          console.error('[ensureFreshAttachmentUrls] Failed to refresh URL', {
            error,
            attachmentPath,
          });
          return attachment;
        }

        return {
          ...attachment,
          url: data.signedUrl,
          path: attachmentPath,
        };
      } catch (error) {
        console.error('[ensureFreshAttachmentUrls] Unexpected error', {
          error,
          attachmentPath,
        });
        return attachment;
      }
    })
  );

  return refreshedAttachments;
};

