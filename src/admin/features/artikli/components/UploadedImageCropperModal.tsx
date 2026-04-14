'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Cropper from 'cropperjs';
import { Button } from '@/shared/ui/button';
import { IconButton } from '@/shared/ui/icon-button';
import { SaveIcon } from '@/shared/ui/icons/AdminActionIcons';

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
  }, [imageUrl, refreshCropperLayout, refreshPreview]);

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
    selection.movable = true;
    selection.resizable = true;
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
      ? 'border-[#3e67d6] bg-[#e9efff] text-[#2143a8]'
      : 'border-slate-200 bg-white text-slate-700 hover:border-[#9cb8ea] hover:bg-[#f7f9fe]'
  ].join(' ');

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-900/50 p-3">
      <div className="flex h-[min(95vh,1040px)] w-full max-w-[1600px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.22)]">
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#f7f9fe] px-4 py-3">
          <h3 className="text-sm font-semibold tracking-wide text-slate-800">Urejanje slike {slotIndex + 1}</h3>
          <div className="flex items-center gap-2">
            <IconButton
              type="button"
              tone="neutral"
              size="sm"
              className={toolButtonClassName(false)}
              aria-label="Shrani"
              title="Shrani"
              onClick={() => void handleSave()}
              disabled={isSaving}
            >
              <SaveIcon className="h-[15px] w-[15px]" />
            </IconButton>
            <Button type="button" variant="close-x" onClick={onCancel} aria-label="Zapri urejanje slike" title="Zapri">×</Button>
          </div>
        </div>
        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_270px]">
          <section className="relative min-h-0 overflow-hidden bg-gradient-to-b from-[#f4f7ff] to-[#eef3fb]">
            <div className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-2 py-1.5 shadow-sm">
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
              <IconButton type="button" tone="neutral" size="sm" className={toolButtonClassName(false)} aria-label="Prekliči" title="Prekliči" onClick={onCancel}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M9 14 4 9l5-5" />
                  <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
                </svg>
              </IconButton>
            </div>
            <div className="h-full w-full p-5 pt-20">
              <div className="relative h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-inner">
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
          <aside className="flex min-h-0 flex-col border-l border-slate-200 bg-[#f8fbff] p-3">
            <div className="space-y-3">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Alt besedilo</label>
              <input
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#3e67d6]"
                value={altText}
                onChange={(event) => onAltTextChange(event.target.value)}
                placeholder={`Slika ${slotIndex + 1}`}
              />
              <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Predogled slike</label>
              <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt={`Polni predogled slike ${slotIndex + 1}`} className="max-h-full max-w-full object-contain" />
              </div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Predogled prikazne sličice</label>
              <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-2">
                {previewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={previewUrl} alt={previewLabel} className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-slate-500">Priprava predogleda …</span>
                )}
              </div>
            </div>
            <div className="mt-auto border-t border-slate-200 pt-3 text-[11px] text-slate-500">
              Urejanje se shrani z gumbom zgoraj desno.
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
