'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Cropper from 'cropperjs';
import { Button } from '@/shared/ui/button';
import { IconButton } from '@/shared/ui/icon-button';
import { ActionUndoIcon, SaveIcon } from '@/shared/ui/icons/AdminActionIcons';

type UploadedImageCropperModalProps = {
  imageUrl: string;
  slotIndex: number;
  altText: string;
  onAltTextChange: (value: string) => void;
  onCancel: () => void;
  onSave: (result: { blob: Blob; mimeType: string }) => void;
};

export default function UploadedImageCropperModal({
  imageUrl,
  slotIndex,
  altText,
  onAltTextChange,
  onCancel,
  onSave
}: UploadedImageCropperModalProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const cropperRef = useRef<Cropper | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [renderSeed, setRenderSeed] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTool, setActiveTool] = useState<'crop' | 'transform'>('crop');

  const cleanupPreviewUrl = useCallback(() => {
    if (!previewUrlRef.current) return;
    URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
  }, []);

  const refreshPreview = useCallback(async () => {
    const cropper = cropperRef.current;
    const selection = cropper?.getCropperSelection();
    if (!selection) return;
    const previewCanvas = await selection.$toCanvas();
    const previewBlob = await new Promise<Blob | null>((resolve) => previewCanvas.toBlob(resolve, 'image/webp', 0.9));
    if (!previewBlob) return;
    const nextPreviewUrl = URL.createObjectURL(previewBlob);
    cleanupPreviewUrl();
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
  }, [cleanupPreviewUrl]);

  const refreshCropperLayout = useCallback(() => {
    const cropperImage = cropperRef.current?.getCropperImage();
    const cropperSelection = cropperRef.current?.getCropperSelection();
    if (!cropperImage || !cropperSelection) return;
    cropperImage.$center('contain');
    cropperSelection.$center();
    cropperSelection.$render();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const sourceImage = imageRef.current;
    if (!host || !sourceImage) return;

    const cropper = new Cropper(sourceImage, {
      container: host,
      template: '<cropper-canvas background style="width:100%;height:100%;display:block;">\
  <cropper-image rotatable scalable translatable initial-center-size="contain"></cropper-image>\
  <cropper-shade hidden></cropper-shade>\
  <cropper-handle action="select" plain></cropper-handle>\
  <cropper-selection initial-coverage="0.65" movable resizable>\
    <cropper-grid role="grid" bordered covered></cropper-grid>\
    <cropper-crosshair centered></cropper-crosshair>\
    <cropper-handle action="move" theme-color="rgba(255, 255, 255, 0.35)"></cropper-handle>\
    <cropper-handle action="n-resize"></cropper-handle>\
    <cropper-handle action="e-resize"></cropper-handle>\
    <cropper-handle action="s-resize"></cropper-handle>\
    <cropper-handle action="w-resize"></cropper-handle>\
    <cropper-handle action="ne-resize"></cropper-handle>\
    <cropper-handle action="nw-resize"></cropper-handle>\
    <cropper-handle action="se-resize"></cropper-handle>\
    <cropper-handle action="sw-resize"></cropper-handle>\
  </cropper-selection>\
</cropper-canvas>'
    });

    cropperRef.current = cropper;
    const selection = cropper.getCropperSelection();
    const queuePreviewRefresh = () => {
      void refreshPreview();
    };
    const forceLayoutRefresh = () => {
      refreshCropperLayout();
      void refreshPreview();
    };

    selection?.addEventListener('change', queuePreviewRefresh);
    const resizeObserver = new ResizeObserver(() => {
      forceLayoutRefresh();
    });
    resizeObserver.observe(host);
    void cropper.getCropperImage()?.$ready(() => {
      forceLayoutRefresh();
    });
    requestAnimationFrame(() => {
      forceLayoutRefresh();
    });

    return () => {
      resizeObserver.disconnect();
      selection?.removeEventListener('change', queuePreviewRefresh);
      cropper.destroy();
      cropperRef.current = null;
    };
  }, [imageUrl, refreshCropperLayout, refreshPreview, renderSeed]);

  useEffect(() => () => {
    cleanupPreviewUrl();
  }, [cleanupPreviewUrl]);

  const applyRotate = useCallback((degrees: number) => {
    const cropperImage = cropperRef.current?.getCropperImage();
    if (!cropperImage) return;
    cropperImage.$rotate(`${degrees}deg`);
    void refreshPreview();
  }, [refreshPreview]);

  const flipHorizontal = useCallback(() => {
    const cropperImage = cropperRef.current?.getCropperImage();
    if (!cropperImage) return;
    cropperImage.$scale(-1, 1);
    void refreshPreview();
  }, [refreshPreview]);

  const flipVertical = useCallback(() => {
    const cropperImage = cropperRef.current?.getCropperImage();
    if (!cropperImage) return;
    cropperImage.$scale(1, -1);
    void refreshPreview();
  }, [refreshPreview]);

  const resetEditor = useCallback(() => {
    setRenderSeed((current) => current + 1);
  }, []);

  const handleSave = useCallback(async () => {
    const cropper = cropperRef.current;
    const selection = cropper?.getCropperSelection();
    if (!selection) return;
    setIsSaving(true);
    try {
      const canvas = await selection.$toCanvas();
      const imageType = imageUrl.endsWith('.png') ? 'image/png' : 'image/jpeg';
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, imageType, 0.92));
      if (!blob) return;
      onSave({ blob, mimeType: imageType });
    } finally {
      setIsSaving(false);
    }
  }, [imageUrl, onSave]);

  const previewLabel = useMemo(() => `Predogled izreza za sliko ${slotIndex + 1}`, [slotIndex]);

  const activateCropTool = useCallback(() => {
    const cropperCanvas = cropperRef.current?.getCropperCanvas();
    const selection = cropperRef.current?.getCropperSelection();
    if (!cropperCanvas || !selection) return;
    cropperCanvas.$setAction('select');
    selection.hidden = false;
    selection.$render();
    setActiveTool('crop');
  }, []);

  const runTransformAction = useCallback((action: () => void) => {
    action();
    setActiveTool('transform');
  }, []);

  const toolButtonClassName = (isActive: boolean) => [
    '!h-9 !w-9 rounded-lg border transition',
    isActive
      ? 'border-blue-400/80 bg-blue-500/20 text-white'
      : 'border-white/15 bg-white/5 text-slate-100 hover:border-white/30 hover:bg-white/10'
  ].join(' ');

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-[#030712]/85 p-3 backdrop-blur-sm">
      <div className="flex h-[min(95vh,1040px)] w-full max-w-[1600px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a1020] shadow-[0_30px_120px_rgba(2,6,23,0.75)]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="text-sm font-semibold tracking-wide text-slate-100">Urejanje slike {slotIndex + 1}</h3>
          <Button type="button" variant="close-x" onClick={onCancel} aria-label="Zapri urejanje slike" title="Zapri">×</Button>
        </div>
        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_270px]">
          <section className="relative min-h-0 overflow-hidden bg-[radial-gradient(circle_at_50%_12%,rgba(59,130,246,0.24),rgba(10,16,32,0.98)_60%)]">
            <div className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-white/15 bg-[#0b1224]/80 px-2 py-1.5 backdrop-blur">
              <IconButton
                type="button"
                tone="neutral"
                size="sm"
                className={toolButtonClassName(activeTool === 'crop')}
                aria-label="Vključi izrez"
                title="Vključi izrez"
                onClick={activateCropTool}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 2v14a2 2 0 0 0 2 2h14" />
                  <path d="M18 22V8a2 2 0 0 0-2-2H2" />
                </svg>
              </IconButton>
              <IconButton type="button" tone="neutral" size="sm" className={toolButtonClassName(false)} aria-label="Zavrti levo" title="Zavrti levo" onClick={() => runTransformAction(() => applyRotate(-90))}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 9V7a2 2 0 0 0-2-2h-6" />
                  <path d="m15 2-3 3 3 3" />
                  <path d="M20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
                </svg>
              </IconButton>
              <IconButton type="button" tone="neutral" size="sm" className={toolButtonClassName(false)} aria-label="Zavrti desno" title="Zavrti desno" onClick={() => runTransformAction(() => applyRotate(90))}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 5H6a2 2 0 0 0-2 2v3" />
                  <path d="m9 8 3-3-3-3" />
                  <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                </svg>
              </IconButton>
              <IconButton type="button" tone="neutral" size="sm" className={toolButtonClassName(false)} aria-label="Zrcali vodoravno" title="Zrcali vodoravno" onClick={() => runTransformAction(flipHorizontal)}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m3 7 5 5-5 5V7" />
                  <path d="m21 7-5 5 5 5V7" />
                  <path d="M12 20v2" />
                  <path d="M12 14v2" />
                  <path d="M12 8v2" />
                  <path d="M12 2v2" />
                </svg>
              </IconButton>
              <IconButton type="button" tone="neutral" size="sm" className={toolButtonClassName(false)} aria-label="Zrcali navpično" title="Zrcali navpično" onClick={() => runTransformAction(flipVertical)}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m7 3 5 5 5-5H7" />
                  <path d="m7 21 5-5 5 5H7" />
                  <path d="M2 12h2" />
                  <path d="M8 12h2" />
                  <path d="M14 12h2" />
                  <path d="M20 12h2" />
                </svg>
              </IconButton>
            </div>
            <div className="h-full w-full p-5 pt-20">
              <div className="relative h-full overflow-hidden rounded-xl border border-white/10 bg-black/25 shadow-inner">
                <div ref={hostRef} className="h-full w-full [&>cropper-canvas]:!block [&>cropper-canvas]:!h-full [&>cropper-canvas]:!w-full" />
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={imageUrl}
              alt={`Urejanje slike ${slotIndex + 1}`}
              className="pointer-events-none absolute left-0 top-0 h-full w-full opacity-0"
            />
          </section>
          <aside className="flex min-h-0 flex-col border-l border-white/10 bg-[#0f172a]/80 p-3">
            <div className="space-y-3">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Alt besedilo</label>
              <input
                className="h-9 w-full rounded-lg border border-white/15 bg-white/5 px-2.5 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-400/70"
                value={altText}
                onChange={(event) => onAltTextChange(event.target.value)}
                placeholder={`Slika ${slotIndex + 1}`}
              />
              <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Predogled</label>
              <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/30 p-2">
                {previewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={previewUrl} alt={previewLabel} className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-slate-500">Priprava predogleda …</span>
                )}
              </div>
            </div>
            <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-white/10 pt-3">
              <Button type="button" variant="ghost" size="toolbar" onClick={resetEditor}>
                <ActionUndoIcon className="h-[14px] w-[14px]" />
                Ponastavi
              </Button>
              <Button type="button" variant="ghost" size="toolbar" onClick={onCancel}>Prekliči</Button>
              <Button type="button" variant="primary" size="toolbar" onClick={() => void handleSave()} disabled={isSaving}>
                <SaveIcon className="h-[14px] w-[14px]" />
                {isSaving ? 'Shranjujem…' : 'Shrani'}
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
