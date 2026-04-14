'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Cropper from 'cropperjs';
import { Button } from '@/shared/ui/button';

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

  useEffect(() => {
    const host = hostRef.current;
    const sourceImage = imageRef.current;
    if (!host || !sourceImage) return;

    const cropper = new Cropper(sourceImage, {
      container: host,
      template: '<cropper-canvas background>\
  <cropper-image rotatable scalable translatable></cropper-image>\
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

    selection?.addEventListener('change', queuePreviewRefresh);
    void refreshPreview();

    return () => {
      selection?.removeEventListener('change', queuePreviewRefresh);
      cropper.destroy();
      cropperRef.current = null;
    };
  }, [imageUrl, refreshPreview, renderSeed]);

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

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-7xl rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">Urejanje slike {slotIndex + 1}</h3>
          <Button type="button" variant="close-x" onClick={onCancel} aria-label="Zapri urejanje slike" title="Zapri">×</Button>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="relative flex min-h-[62vh] items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-950/5">
            <div ref={hostRef} className="h-full w-full" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={imageRef} src={imageUrl} alt={`Urejanje slike ${slotIndex + 1}`} className="hidden" />
          </div>
          <aside className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">Alt besedilo</label>
              <input
                className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none focus:border-[#3e67d6]"
                value={altText}
                onChange={(event) => onAltTextChange(event.target.value)}
                placeholder={`Slika ${slotIndex + 1}`}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">Predogled izreza</label>
              <div className="flex h-44 w-full items-center justify-center overflow-hidden rounded-md border border-slate-300 bg-white p-2">
                {previewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={previewUrl} alt={previewLabel} className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-slate-500">Priprava predogleda …</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button type="button" variant="ghost" size="toolbar" onClick={() => applyRotate(-90)}>↺ -90°</Button>
              <Button type="button" variant="ghost" size="toolbar" onClick={() => applyRotate(90)}>↻ +90°</Button>
              <Button type="button" variant="ghost" size="toolbar" onClick={flipHorizontal}>Zrcali X</Button>
              <Button type="button" variant="ghost" size="toolbar" onClick={flipVertical}>Zrcali Y</Button>
            </div>
            <div className="mt-auto flex flex-wrap justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="toolbar" onClick={resetEditor}>Ponastavi</Button>
              <Button type="button" variant="ghost" size="toolbar" onClick={onCancel}>Prekliči</Button>
              <Button type="button" variant="primary" size="toolbar" onClick={() => void handleSave()} disabled={isSaving}>{isSaving ? 'Shranjujem…' : 'Shrani'}</Button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
