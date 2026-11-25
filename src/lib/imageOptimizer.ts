export interface OptimizedPhotoResult {
  dataUrl: string;
  width: number;
  height: number;
  byteSize: number;
}

export interface PhotoCropRect {
  sx: number;
  sy: number;
  sSize: number;
}

const MAX_RAW_PHOTO_BYTES = 12 * 1024 * 1024; // 12 MB
const TARGET_DATAURL_CHARS = 14000; // ~10.5 KB binary payload
const HARD_MAX_DATAURL_CHARS = 24000; // ~18 KB absolute ceiling

export function isSafeCustomerPhotoDataUrl(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  if (val.length === 0 || val.length > 26000) return false;
  return /^data:image\/(webp|jpeg|jpg|png);base64,[A-Za-z0-9+/=]+$/i.test(val);
}

async function loadImageForAvatar(file: File): Promise<{
  source: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => {
          try {
            bitmap.close();
          } catch {}
        },
      };
    } catch {
      // Fallback to HTMLImageElement
    }
  }

  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(url),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('INVALID_IMAGE'));
    };
    img.src = url;
  });
}

/**
 * Crops (custom or centered square) and optimizes a client contact photo into a crisp
 * 128x128 WebP avatar (~3-10 KB) so Firestore documents stay tiny without sacrificing clarity.
 */
export async function optimizeCustomerPhoto(
  file: File,
  cropRect?: PhotoCropRect
): Promise<OptimizedPhotoResult> {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    throw new Error('UNSUPPORTED_TYPE');
  }
  if (file.size <= 0) {
    throw new Error('INVALID_IMAGE');
  }
  if (file.size > MAX_RAW_PHOTO_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }

  const loaded = await loadImageForAvatar(file);
  const canvas = document.createElement('canvas');

  try {
    const srcW = Math.max(1, loaded.width);
    const srcH = Math.max(1, loaded.height);
    const defaultSize = Math.min(srcW, srcH);

    let sx = Math.floor((srcW - defaultSize) / 2);
    let sy = Math.floor((srcH - defaultSize) / 2);
    let cropSize = defaultSize;

    if (cropRect && Number.isFinite(cropRect.sSize) && cropRect.sSize > 0) {
      cropSize = Math.max(1, Math.min(cropRect.sSize, srcW, srcH));
      sx = Math.max(0, Math.min(cropRect.sx, srcW - cropSize));
      sy = Math.max(0, Math.min(cropRect.sy, srcH - cropSize));
    }

    const renderSquare = (
      dim: number,
      mime: string,
      quality: number
    ): { dataUrl: string; w: number; h: number } | null => {
      canvas.width = dim;
      canvas.height = dim;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return null;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, dim, dim);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(loaded.source, sx, sy, cropSize, cropSize, 0, 0, dim, dim);

      const dataUrl = canvas.toDataURL(mime, quality);
      if (!dataUrl || !dataUrl.startsWith(`data:${mime}`)) return null;
      return { dataUrl, w: dim, h: dim };
    };

    const attempts: Array<{ dim: number; mime: string; quality: number }> = [
      { dim: 128, mime: 'image/webp', quality: 0.78 },
      { dim: 128, mime: 'image/webp', quality: 0.68 },
      { dim: 128, mime: 'image/webp', quality: 0.56 },
      { dim: 96, mime: 'image/webp', quality: 0.68 },
      { dim: 96, mime: 'image/webp', quality: 0.52 },
      { dim: 128, mime: 'image/jpeg', quality: 0.72 },
      { dim: 96, mime: 'image/jpeg', quality: 0.62 },
      { dim: 80, mime: 'image/jpeg', quality: 0.54 },
    ];

    let best: { dataUrl: string; w: number; h: number } | null = null;
    for (const attempt of attempts) {
      const res = renderSquare(attempt.dim, attempt.mime, attempt.quality);
      if (!res) continue;
      if (!best || res.dataUrl.length < best.dataUrl.length) {
        best = res;
      }
      if (res.dataUrl.length <= TARGET_DATAURL_CHARS) {
        const base64Part = res.dataUrl.split(',')[1] || '';
        return {
          dataUrl: res.dataUrl,
          width: res.w,
          height: res.h,
          byteSize: Math.round((base64Part.length * 3) / 4),
        };
      }
    }

    if (best && best.dataUrl.length <= HARD_MAX_DATAURL_CHARS) {
      const base64Part = best.dataUrl.split(',')[1] || '';
      return {
        dataUrl: best.dataUrl,
        width: best.w,
        height: best.h,
        byteSize: Math.round((base64Part.length * 3) / 4),
      };
    }

    throw new Error('OUTPUT_TOO_LARGE');
  } finally {
    loaded.cleanup();
    canvas.width = 0;
    canvas.height = 0;
  }
}
