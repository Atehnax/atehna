import { issueSignedToken, presignUrl, put } from '@vercel/blob';
import type { HandleUploadPresignedBody } from '@vercel/blob/client';
import {
  PUBLIC_MEDIA_UPLOAD_TOKEN_TTL_MS,
  getPublicMediaUploadPolicy,
  parsePublicMediaUploadPayload,
  type PublicMediaUploadContext,
  type PublicMediaUploadPolicy
} from '@/shared/domain/media/publicMediaUpload';

type HandlePublicMediaUploadOptions = {
  expectedScope: PublicMediaUploadContext['scope'];
  authorize?: (policy: PublicMediaUploadPolicy) => Promise<void>;
};

function getPublicMediaBlobStoreId(): string {
  const storeId = process.env.PUBLIC_MEDIA_BLOB_STORE_ID?.trim();
  if (!storeId) throw new Error('PUBLIC_MEDIA_BLOB_STORE_ID is not set');
  return storeId;
}

export async function handlePublicMediaUpload(
  body: HandleUploadPresignedBody,
  options: HandlePublicMediaUploadOptions
) {
  if (body.type !== 'blob.generate-presigned-url') {
    throw new Error('Vrsta zahtevka za nalaganje ni veljavna.');
  }

  const { pathname, clientPayload, multipart } = body.payload;
  if (multipart) {
    throw new Error('Večdelno nalaganje za to velikost datoteke ni potrebno.');
  }

  const payload = parsePublicMediaUploadPayload(clientPayload, options.expectedScope);
  const policy = getPublicMediaUploadPolicy(payload);
  if (pathname !== policy.pathname) {
    throw new Error('Ciljna pot medija ni veljavna.');
  }
  await options.authorize?.(policy);

  const validUntil = Date.now() + PUBLIC_MEDIA_UPLOAD_TOKEN_TTL_MS;
  const signedToken = await issueSignedToken({
    storeId: getPublicMediaBlobStoreId(),
    pathname: policy.pathname,
    operations: ['put'],
    allowedContentTypes: policy.allowedContentTypes,
    maximumSizeInBytes: policy.maximumSizeInBytes,
    validUntil
  });

  const { presignedUrl } = await presignUrl(signedToken, {
    access: 'public',
    operation: 'put',
    pathname: policy.pathname,
    allowedContentTypes: policy.allowedContentTypes,
    maximumSizeInBytes: policy.maximumSizeInBytes,
    validUntil,
    addRandomSuffix: false,
    allowOverwrite: false,
    cacheControlMaxAge: policy.cacheControlMaxAge
  });

  return { type: body.type, presignedUrl };
}

export async function uploadPublicMediaFromServer({
  pathname,
  payload,
  contentType,
  maximumSizeInBytes
}: {
  pathname: string;
  payload: Buffer | Uint8Array;
  contentType: string;
  maximumSizeInBytes: number;
}) {
  if (payload.byteLength <= 0 || payload.byteLength > maximumSizeInBytes) {
    throw new Error('Datoteka je prazna ali prevelika.');
  }

  return put(pathname, Buffer.isBuffer(payload) ? payload : Buffer.from(payload), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: false,
    cacheControlMaxAge: 365 * 24 * 60 * 60,
    contentType,
    maximumSizeInBytes,
    storeId: getPublicMediaBlobStoreId()
  });
}
