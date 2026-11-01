import type { ImageMime, Raster } from '@witness/core';
import { IMAGE_MIME_TYPES, LIMITS } from '@witness/core';

export interface LoadedImage {
  readonly bytes: Uint8Array;
  readonly mime: ImageMime;
  readonly raster: Raster;
  readonly url: string;
}

export class ImageError extends Error {
  override readonly name = 'ImageError';
}

/**
 * Decodes an image file into exact pixels. EXIF orientation is ignored on purpose:
 * the fingerprint describes the stored pixels, the same way every verifier sees them.
 */
export async function loadImage(blob: Blob): Promise<LoadedImage> {
  const mime = blob.type as ImageMime;
  if (!IMAGE_MIME_TYPES.includes(mime)) throw new ImageError('Use a JPEG, PNG or WebP image.');
  if (blob.size > LIMITS.maxImageBytes) throw new ImageError('Images must be under 25 MB.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const bitmap = await createImageBitmap(blob, {
    imageOrientation: 'none',
    colorSpaceConversion: 'none',
  });
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
    if (!ctx) throw new ImageError('This browser cannot read image pixels.');
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height, { colorSpace: 'srgb' }).data;
    return {
      bytes,
      mime,
      raster: { width: bitmap.width, height: bitmap.height, data },
      url: URL.createObjectURL(blob),
    };
  } finally {
    bitmap.close();
  }
}

/** Grabs the current video frame as a JPEG file: the exact bytes that will be sealed. */
export async function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError('This browser cannot capture frames.');
  ctx.drawImage(video, 0, 0);
  return toBlob(canvas, 'image/jpeg', 0.92);
}

/** A small JPEG of the image for public records, kept under the manifest preview limit. */
export async function makePreview(url: string): Promise<Uint8Array> {
  const image = new Image();
  image.src = url;
  await image.decode();
  for (const [side, quality] of [
    [480, 0.72],
    [360, 0.66],
    [280, 0.6],
  ] as const) {
    const scale = Math.min(1, side / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    const bytes = new Uint8Array(await (await toBlob(canvas, 'image/jpeg', quality)).arrayBuffer());
    if (bytes.length <= LIMITS.maxPreviewBytes) return bytes;
  }
  throw new ImageError('Could not make a small enough preview.');
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new ImageError('Encoding failed.'))),
      type,
      quality,
    ),
  );
}

export function downloadBytes(bytes: Uint8Array | string, filename: string, type: string): void {
  const blob = new Blob([typeof bytes === 'string' ? bytes : bytes.slice().buffer], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function base64ToObjectUrl(base64: string, type: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type }));
}
