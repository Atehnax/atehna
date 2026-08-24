'use client';

import {
  createPublicMediaUploadPayload,
  getPublicMediaUploadPolicy,
  type PublicMediaUploadContext
} from '@/shared/domain/media/publicMediaUpload';

const HANDLE_UPLOAD_URL = '/api/admin/media';

function createUploadId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

export type UploadedPublicMedia = {
  contentType: string;
  filename: string;
  mediaKind: 'image' | 'video' | 'document';
  pathname: string;
  size: number;
  url: string;
};

export async function uploadAdminPublicMedia(
  file: File,
  context: PublicMediaUploadContext
): Promise<UploadedPublicMedia> {
  if (file.size <= 0) throw new Error('Datoteka je prazna.');

  const payload = createPublicMediaUploadPayload(context, file, createUploadId());
  const policy = getPublicMediaUploadPolicy(payload);
  if (file.size > policy.maximumSizeInBytes) {
    const maximumMegabytes = Math.floor(policy.maximumSizeInBytes / (1024 * 1024));
    throw new Error(`Datoteka je prevelika. Dovoljena velikost je največ ${maximumMegabytes} MB.`);
  }

  const authorizationResponse = await fetch(HANDLE_UPLOAD_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'blob.generate-presigned-url',
      payload: {
        pathname: policy.pathname,
        clientPayload: JSON.stringify(payload),
        multipart: false
      }
    })
  });
  const authorization = (await authorizationResponse.json().catch(() => ({}))) as {
    message?: string;
    presignedUrl?: string;
  };
  if (!authorizationResponse.ok || !authorization.presignedUrl) {
    throw new Error(authorization.message || 'Nalaganja medija ni mogoče začeti.');
  }

  const uploadResponse = await fetch(authorization.presignedUrl, {
    method: 'PUT',
    headers: { 'content-type': policy.contentType },
    body: file
  });
  const blob = (await uploadResponse.json().catch(() => ({}))) as {
    message?: string;
    pathname?: string;
    url?: string;
  };
  if (!uploadResponse.ok || !blob.url || !blob.pathname) {
    throw new Error(blob.message || 'Nalaganje medija ni uspelo.');
  }
  if (blob.pathname !== policy.pathname) {
    throw new Error('Shranjena pot medija se ne ujema z odobreno potjo.');
  }

  return {
    url: blob.url,
    pathname: blob.pathname,
    contentType: policy.contentType,
    filename: policy.filename,
    mediaKind: policy.mediaKind,
    size: file.size
  };
}
