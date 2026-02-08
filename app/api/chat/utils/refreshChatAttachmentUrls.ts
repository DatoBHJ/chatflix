import { createClient } from '@/utils/supabase/server';

/** Resolve a fresh signed URL for chat_attachments so the AI SDK can download it (avoids 400 InvalidJWT). */
async function resolveChatAttachmentUrl(url: string, supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  if (!url || !url.includes('/storage/v1/object/sign/') || !url.includes('chat_attachments/')) return url;
  const path = url.split('chat_attachments/')[1]?.split('?')[0];
  if (!path) return url;
  try {
    const { data: signedData, error: signedError } = await supabase.storage
      .from('chat_attachments')
      .createSignedUrl(path, 24 * 60 * 60);
    if (signedError || !signedData?.signedUrl) return url;
    return signedData.signedUrl;
  } catch {
    return url;
  }
}

/**
 * Refresh chat_attachments signed URLs in messages so the AI SDK can download them (avoids 400 InvalidJWT).
 * Call this from API route only (uses next/headers via createClient).
 */
export async function refreshChatAttachmentUrlsInMessages(messages: any[]): Promise<any[]> {
  if (!messages?.length) return messages;
  const supabase = await createClient();

  return Promise.all(
    messages.map(async (msg: any) => {
      let out = msg;

      if (Array.isArray(msg.experimental_attachments) && msg.experimental_attachments.length > 0) {
        const refreshedAttachments = await Promise.all(
          msg.experimental_attachments.map(async (att: any) => {
            if (!att?.url) return att;
            const freshUrl = await resolveChatAttachmentUrl(att.url, supabase);
            return freshUrl !== att.url ? { ...att, url: freshUrl } : att;
          })
        );
        out = { ...out, experimental_attachments: refreshedAttachments };
      }

      if (Array.isArray(out.parts) && out.parts.length > 0) {
        const refreshedParts = await Promise.all(
          out.parts.map(async (part: any) => {
            if (part.type === 'image' && part.image) {
              const imageUrl = await resolveChatAttachmentUrl(part.image, supabase);
              return imageUrl !== part.image ? { ...part, image: imageUrl } : part;
            }
            // Refresh all file parts (images, CSV, code, etc.) so DB-loaded messages have valid URLs
            if (part.type === 'file' && part.url) {
              const fileUrl = await resolveChatAttachmentUrl(part.url, supabase);
              return fileUrl !== part.url ? { ...part, url: fileUrl } : part;
            }
            return part;
          })
        );
        out = { ...out, parts: refreshedParts };
      }

      return out;
    })
  );
}
