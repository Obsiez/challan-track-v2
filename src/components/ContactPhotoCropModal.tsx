import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import ModalPortal from './ModalPortal';
import LoadingSpinner from './LoadingSpinner';
import { Language } from '../lib/translations';
import { triggerHaptic } from '../lib/haptics';
import { optimizeCustomerPhoto, OptimizedPhotoResult } from '../lib/imageOptimizer';

interface ContactPhotoCropModalProps {
  file: File;
  lang: Language;
  onConfirm: (result: OptimizedPhotoResult) => void;
  onCancel: () => void;
  onError: (err: unknown) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export const ContactPhotoCropModal: React.FC<ContactPhotoCropModalProps> = ({
  file,
  lang,
  onConfirm,
  onCancel,
  onError,
}) => {
  const isBn = lang === 'bn';
  const stageRef = useRef<HTMLDivElement>(null);

  const [objectUrl, setObjectUrl] = useState<string>('');
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [stageSize, setStageSize] = useState<number>(280);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panRef = useRef(pan);
  panRef.current = pan;
  const naturalRef = useRef(naturalSize);
  naturalRef.current = naturalSize;
  const stageSizeRef = useRef(stageSize);
  stageSizeRef.current = stageSize;

  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null);
  const lastDragPointRef = useRef<{ x: number; y: number } | null>(null);

  const hasHistoryRef = useRef(false);
  const ignoringSelfPopRef = useRef(false);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const savingRef = useRef(saving);
  savingRef.current = saving;

  // Create & revoke object URL safely
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Keep viewport crop size measured accurately across mobile & desktop widths
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const side = el.clientWidth;
      if (side > 0) setStageSize(side);
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure, { passive: true });
    return () => window.removeEventListener('resize', measure);
  }, []);

  const popCropHistory = useCallback(() => {
    if (hasHistoryRef.current && window.history.state?.photoCropper) {
      hasHistoryRef.current = false;
      ignoringSelfPopRef.current = true;
      window.history.back();
      window.setTimeout(() => {
        ignoringSelfPopRef.current = false;
      }, 450);
    } else {
      hasHistoryRef.current = false;
    }
  }, []);

  const handleCloseCancel = useCallback(() => {
    if (savingRef.current) return;
    popCropHistory();
    onCancelRef.current();
  }, [popCropHistory]);

  // Browser / Android Back gesture support
  useEffect(() => {
    try {
      window.history.pushState({ ...window.history.state, photoCropper: true }, '');
      hasHistoryRef.current = true;
    } catch {}

    const onPopState = (e: PopStateEvent) => {
      if (ignoringSelfPopRef.current) {
        ignoringSelfPopRef.current = false;
        return;
      }
      if (hasHistoryRef.current && !e.state?.photoCropper) {
        hasHistoryRef.current = false;
        onCancelRef.current();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !savingRef.current) {
        e.preventDefault();
        handleCloseCancel();
      }
    };

    window.addEventListener('popstate', onPopState);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('keydown', onKeyDown);
      if (hasHistoryRef.current && window.history.state?.photoCropper) {
        hasHistoryRef.current = false;
        ignoringSelfPopRef.current = true;
        window.history.back();
        window.setTimeout(() => {
          ignoringSelfPopRef.current = false;
        }, 450);
      }
    };
  }, [handleCloseCancel]);

  const clampPan = useCallback((nextX: number, nextY: number, z: number) => {
    const nat = naturalRef.current;
    const view = stageSizeRef.current;
    if (!nat || view <= 0) return { x: 0, y: 0 };
    const baseScale = view / Math.min(nat.w, nat.h);
    const dispW = nat.w * baseScale * z;
    const dispH = nat.h * baseScale * z;
    const maxX = Math.max(0, (dispW - view) / 2);
    const maxY = Math.max(0, (dispH - view) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, nextX)),
      y: Math.max(-maxY, Math.min(maxY, nextY)),
    };
  }, []);

  const applyZoom = useCallback(
    (nextZoomRaw: number) => {
      const nextZ = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoomRaw));
      const ratio = zoomRef.current > 0 ? nextZ / zoomRef.current : 1;
      const clamped = clampPan(panRef.current.x * ratio, panRef.current.y * ratio, nextZ);
      setZoom(nextZ);
      setPan(clamped);
    },
    [clampPan]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!naturalSize || saving) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1) {
      lastDragPointRef.current = { x: e.clientX, y: e.clientY };
      pinchStartRef.current = null;
      setIsDragging(true);
    } else if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      pinchStartRef.current = { dist: Math.max(1, dist), zoom: zoomRef.current };
      lastDragPointRef.current = null;
      setIsDragging(true);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId) || !naturalSize || saving) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchStartRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const scaleFactor = dist / pinchStartRef.current.dist;
      applyZoom(pinchStartRef.current.zoom * scaleFactor);
      return;
    }

    if (pointersRef.current.size === 1 && lastDragPointRef.current) {
      const dx = e.clientX - lastDragPointRef.current.x;
      const dy = e.clientY - lastDragPointRef.current.y;
      lastDragPointRef.current = { x: e.clientX, y: e.clientY };
      setPan((prev) => clampPan(prev.x + dx, prev.y + dy, zoomRef.current));
    }
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    if (pointersRef.current.size === 1) {
      const remaining = Array.from(pointersRef.current.values())[0];
      lastDragPointRef.current = { x: remaining.x, y: remaining.y };
      pinchStartRef.current = null;
    } else if (pointersRef.current.size === 0) {
      lastDragPointRef.current = null;
      pinchStartRef.current = null;
      setIsDragging(false);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!naturalSize || saving) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.0022;
    applyZoom(zoomRef.current + delta);
  };

  const handleConfirm = async () => {
    if (!naturalSize || saving) return;
    setSaving(true);
    try {
      const baseScale = stageSize / Math.min(naturalSize.w, naturalSize.h);
      const totalScale = baseScale * zoom;
      const dispW = naturalSize.w * totalScale;
      const dispH = naturalSize.h * totalScale;
      const imgLeft = stageSize / 2 + pan.x - dispW / 2;
      const imgTop = stageSize / 2 + pan.y - dispH / 2;

      const sSize = stageSize / totalScale;
      const sx = -imgLeft / totalScale;
      const sy = -imgTop / totalScale;

      const optimized = await optimizeCustomerPhoto(file, { sx, sy, sSize });
      triggerHaptic('single');
      popCropHistory();
      onConfirm(optimized);
    } catch (err) {
      triggerHaptic('double');
      popCropHistory();
      onError(err);
    } finally {
      setSaving(false);
    }
  };

  const baseScale = naturalSize ? stageSize / Math.min(naturalSize.w, naturalSize.h) : 1;
  const dispW = naturalSize ? naturalSize.w * baseScale * zoom : stageSize;
  const dispH = naturalSize ? naturalSize.h * baseScale * zoom : stageSize;
  const isModified = zoom > 1.01 || Math.abs(pan.x) > 1 || Math.abs(pan.y) > 1;

  return (
    <ModalPortal lockScroll={true}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isBn ? 'ছবি ক্রপ করুন' : 'Move and Scale Photo'}
        className="fixed inset-0 z-[150] bg-black/88 backdrop-blur-2xl flex flex-col justify-between p-4 sm:p-6 select-none overflow-hidden overscroll-none animate-backdrop-blur"
      >
        {/* Top Apple-style Action Bar */}
        <div className="max-w-lg w-full mx-auto flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            disabled={saving}
            onClick={handleCloseCancel}
            className="h-9 px-3.5 rounded-full bg-white/10 hover:bg-white/18 text-white/90 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50 touch-press"
          >
            <X className="w-3.5 h-3.5 stroke-[1.8]" />
            <span>{isBn ? 'বাতিল' : 'Cancel'}</span>
          </button>

          <h3 className="font-display text-sm sm:text-base font-bold text-white tracking-tight">
            {isBn ? 'ছবি ঠিক করুন' : 'Move and Scale'}
          </h3>

          <button
            type="button"
            disabled={!naturalSize || saving}
            onClick={handleConfirm}
            className="h-9 px-4 rounded-full bg-white hover:bg-slate-100 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 shadow-sm touch-press"
          >
            {saving ? (
              <LoadingSpinner size="xs" />
            ) : (
              <>
                <Check className="w-3.5 h-3.5 stroke-[2.2]" />
                <span>{isBn ? 'পছন্দ করুন' : 'Choose'}</span>
              </>
            )}
          </button>
        </div>

        {/* Center Circular Interactive Cropper */}
        <div className="flex-1 flex items-center justify-center py-4">
          <div
            ref={stageRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUpOrCancel}
            onPointerCancel={handlePointerUpOrCancel}
            onWheel={handleWheel}
            className="relative w-[min(76vw,304px)] h-[min(76vw,304px)] rounded-3xl overflow-hidden bg-zinc-950 touch-none cursor-grab active:cursor-grabbing ring-1 ring-white/15 shadow-[0_24px_70px_rgba(0,0,0,0.75)]"
          >
            {objectUrl && (
              <img
                src={objectUrl}
                alt=""
                draggable={false}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setNaturalSize({
                    w: img.naturalWidth || img.width || 1,
                    h: img.naturalHeight || img.height || 1,
                  });
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: `${dispW}px`,
                  height: `${dispH}px`,
                  maxWidth: 'none',
                  maxHeight: 'none',
                  transform: `translate3d(calc(-50% + ${pan.x.toFixed(2)}px), calc(-50% + ${pan.y.toFixed(2)}px), 0)`,
                  willChange: 'transform',
                }}
                className="pointer-events-none select-none"
              />
            )}

            {/* Rule-of-thirds guides while dragging */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${
                isDragging ? 'opacity-45' : 'opacity-0'
              }`}
            >
              <div className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
              <div className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
              <div className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
              <div className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
            </div>

            {/* Circular Apple-style Viewfinder Aperture Mask */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full ring-[1.5px] ring-white/85"
              style={{
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.58)',
              }}
            />
          </div>
        </div>

        {/* Bottom Zoom & Reset Controls */}
        <div className="max-w-xs w-full mx-auto pb-[max(0.5rem,env(safe-area-inset-bottom))] space-y-2.5">
          <div className="px-4 py-3 rounded-2xl bg-white/[0.08] border border-white/12 backdrop-blur-xl flex items-center gap-3">
            <button
              type="button"
              onClick={() => applyZoom(zoom - 0.25)}
              disabled={zoom <= MIN_ZOOM || saving}
              aria-label={isBn ? 'জুম আউট' : 'Zoom out'}
              className="text-white/70 hover:text-white disabled:opacity-35 cursor-pointer transition-colors"
            >
              <ZoomOut className="w-4 h-4 stroke-[1.75]" />
            </button>

            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              disabled={!naturalSize || saving}
              onChange={(e) => applyZoom(parseFloat(e.target.value))}
              aria-label={isBn ? 'জুম স্লাইডার' : 'Zoom slider'}
              className="flex-1 h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-white"
            />

            <button
              type="button"
              onClick={() => applyZoom(zoom + 0.25)}
              disabled={zoom >= MAX_ZOOM || saving}
              aria-label={isBn ? 'জুম ইন' : 'Zoom in'}
              className="text-white/70 hover:text-white disabled:opacity-35 cursor-pointer transition-colors"
            >
              <ZoomIn className="w-4 h-4 stroke-[1.75]" />
            </button>

            <button
              type="button"
              disabled={!isModified || saving}
              onClick={() => {
                triggerHaptic('tick');
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              aria-label={isBn ? 'রিসেট' : 'Reset'}
              title={isBn ? 'রিসেট করুন' : 'Reset'}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 stroke-[1.75]" />
            </button>
          </div>

          <p className="text-center text-[11px] font-medium text-white/60">
            {isBn ? 'সরিয়ে মুখ মাঝখানে আনুন · স্লাইড করে জুম করুন' : 'Drag to frame the photo · Pinch or slide to zoom'}
          </p>
        </div>
      </div>
    </ModalPortal>
  );
};

export default ContactPhotoCropModal;
