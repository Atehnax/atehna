'use client';

import Image from 'next/image';
import {
  ChevronLeft,
  ChevronRight,
  Search
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent
} from 'react';
import ImagePreviewDialog from '@/shared/ui/image-preview-dialog/ImagePreviewDialog';
import { useProductAppearance } from '@/commercial/components/ProductAppearanceProvider';
import { resolveGalleryZoomOrigin } from '@/commercial/components/storefront/productGalleryZoom';
import {
  isProductDimensionDiagram as isDimensionDiagram,
  resolveProductGallerySelection
} from '@/commercial/components/storefront/productGalleryMedia';
import type { StorefrontProductMedia } from '@/commercial/features/products/storefrontProduct';
import type { ProductCanvasDevice } from '@/shared/domain/style/productAppearance';
import styles from './ProductGalleryReference.module.css';

export { resolveGalleryZoomOrigin } from '@/commercial/components/storefront/productGalleryZoom';

type ProductGalleryProps = {
  media: StorefrontProductMedia[];
  productName: string;
  className?: string;
  presentation?: 'reference';
  footer?: ReactNode;
  previewDevice?: ProductCanvasDevice;
  canvasWrapper?: (
    elementId: string,
    label: string,
    children: ReactNode,
    className?: string
  ) => ReactNode;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

const mediaControlClassName =
  'storefront-gallery-control inline-grid place-items-center p-0';

const mediaControlVisualClassName =
  'storefront-gallery-control-visual inline-grid place-items-center rounded-full';

const toYoutubeEmbed = (url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') {
      return `https://www.youtube-nocookie.com/embed/${parsed.pathname.slice(1)}`;
    }
    if (parsed.hostname.endsWith('youtube.com')) {
      const videoId = parsed.searchParams.get('v');
      if (videoId) return `https://www.youtube-nocookie.com/embed/${videoId}`;
      if (parsed.pathname.startsWith('/embed/')) {
        return `https://www.youtube-nocookie.com${parsed.pathname}`;
      }
    }
  } catch {
    return null;
  }
  return null;
};

function MediaViewer({
  media,
  productName,
  priority = false,
  zoomOnHover = false,
  hoverZoomActive = false,
  onImageLoad
}: {
  media: StorefrontProductMedia;
  productName: string;
  priority?: boolean;
  zoomOnHover?: boolean;
  hoverZoomActive?: boolean;
  onImageLoad?: (width: number, height: number) => void;
}) {
  if (media.kind === 'document') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center">
        <span
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-[var(--site-radius-md)] border border-[color:var(--site-border-color)] bg-[color:var(--site-color-surface)] text-sm font-bold text-[color:var(--site-color-primary)]"
        >
          PDF
        </span>
        <p className="font-semibold text-[color:var(--site-color-text)]">
          {media.filename || media.altText}
        </p>
        <a
          href={media.url}
          target="_blank"
          rel="noreferrer"
          className="site-button site-button--secondary inline-flex items-center justify-center"
        >
          Odpri dokument
        </a>
      </div>
    );
  }

  if (media.kind === 'video') {
    const youtubeEmbed = toYoutubeEmbed(media.url);
    if (youtubeEmbed) {
      return (
        <iframe
          src={youtubeEmbed}
          title={media.altText || `${productName} – video`}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }
    return (
      <video
        src={media.url}
        controls
        className="h-full w-full object-contain"
        aria-label={media.altText || `${productName} – video`}
      />
    );
  }

  return (
    <Image
      src={media.url}
      alt={media.altText || productName}
      fill
      priority={priority}
      sizes="(min-width: 1024px) 42vw, 100vw"
      className={classNames(
        'storefront-product-gallery-image',
        zoomOnHover &&
          'will-change-transform transition-transform motion-reduce:transition-none',
        zoomOnHover && hoverZoomActive
          ? 'duration-200 ease-out'
          : zoomOnHover
            ? 'duration-[360ms] ease-[cubic-bezier(0.4,0,0.2,1)]'
            : null
      )}
      style={{
        objectFit: 'contain',
        ...(zoomOnHover ? {
          transform: hoverZoomActive ? 'scale(2)' : 'scale(1)',
          transformOrigin:
            'var(--storefront-gallery-zoom-x, 50%) var(--storefront-gallery-zoom-y, 50%)'
        } : {})
      }}
      data-storefront-gallery-hover-zoom={zoomOnHover || undefined}
      data-hover-zoom-active={hoverZoomActive || undefined}
      onLoad={(event) => {
        onImageLoad?.(
          event.currentTarget.naturalWidth,
          event.currentTarget.naturalHeight
        );
      }}
    />
  );
}

export default function ProductGallery({
  media,
  productName,
  className,
  presentation,
  footer,
  previewDevice,
  canvasWrapper
}: ProductGalleryProps) {
  const appearance = useProductAppearance();
  const wrapCanvasElement = canvasWrapper ?? (
    (
      _elementId: string,
      _label: string,
      children: ReactNode,
      wrapperClassName?: string
    ) => wrapperClassName
      ? <div key={_elementId} className={wrapperClassName}>{children}</div>
      : children
  );
  const galleryMedia = useMemo(
    () =>
      media.filter(
        (entry) =>
          (entry.role === 'gallery' &&
            (entry.kind === 'image' ||
              (entry.kind === 'video' &&
                appearance.gallery.showVideoThumbnails))) ||
          (entry.kind === 'document' &&
            appearance.gallery.showDocumentThumbnails)
      ),
    [
      appearance.gallery.showDocumentThumbnails,
      appearance.gallery.showVideoThumbnails,
      media
    ]
  );
  const [selectedMedia, setSelectedMedia] = useState<StorefrontProductMedia | null>(
    () => galleryMedia[0] ?? null
  );
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [isHoverZoomActive, setIsHoverZoomActive] = useState(false);
  const [selectedImageAspectRatio, setSelectedImageAspectRatio] = useState(4 / 3);
  const mainImageSurfaceRef = useRef<HTMLDivElement>(null);
  const hoverZoomAnimationFrameRef = useRef<number | null>(null);
  const selected = resolveProductGallerySelection(galleryMedia, selectedMedia);
  const selectedIndex = Math.max(
    0,
    galleryMedia.findIndex((entry) => entry.id === selected?.id)
  );

  useEffect(() => {
    if (selected !== selectedMedia) setSelectedMedia(selected);
  }, [selected, selectedMedia]);

  const openZoom = useCallback(() => {
    setIsHoverZoomActive(false);
    setIsZoomOpen(true);
  }, []);

  const closeZoom = useCallback(() => setIsZoomOpen(false), []);

  useEffect(() => () => {
    if (hoverZoomAnimationFrameRef.current !== null) {
      cancelAnimationFrame(hoverZoomAnimationFrameRef.current);
    }
  }, []);

  const selectRelative = (offset: number) => {
    if (galleryMedia.length < 2) return;
    const nextIndex =
      (selectedIndex + offset + galleryMedia.length) % galleryMedia.length;
    setSelectedMedia(galleryMedia[nextIndex]);
  };

  const thumbnailCountAllowsDisplay =
    galleryMedia.length > 1 ||
    !appearance.gallery.hideThumbnailsWhenSingle;
  const thumbnailDesktopPosition = thumbnailCountAllowsDisplay
    ? appearance.gallery.thumbnailPositionDesktop
    : 'hidden';
  const thumbnailMobilePosition = thumbnailCountAllowsDisplay
    ? appearance.gallery.thumbnailPositionMobile
    : 'hidden';
  const previewThumbnailPosition = previewDevice
    ? previewDevice === 'desktop'
      ? thumbnailDesktopPosition
      : thumbnailMobilePosition
    : undefined;
  const showThumbnailStrip = previewThumbnailPosition
    ? previewThumbnailPosition !== 'hidden'
    : thumbnailDesktopPosition !== 'hidden' ||
      thumbnailMobilePosition !== 'hidden';
  const canZoom =
    selected?.kind === 'image' && appearance.gallery.zoomMode !== 'none';
  const resetHoverZoom = useCallback(() => {
    if (hoverZoomAnimationFrameRef.current !== null) {
      cancelAnimationFrame(hoverZoomAnimationFrameRef.current);
      hoverZoomAnimationFrameRef.current = null;
    }
    setIsHoverZoomActive(false);
  }, []);
  const updateHoverZoom = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!canZoom || event.pointerType !== 'mouse') return;
      const bounds = event.currentTarget.getBoundingClientRect();
      const origin = resolveGalleryZoomOrigin({
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
        clientX: event.clientX,
        clientY: event.clientY
      });
      if (hoverZoomAnimationFrameRef.current !== null) {
        cancelAnimationFrame(hoverZoomAnimationFrameRef.current);
      }
      hoverZoomAnimationFrameRef.current = requestAnimationFrame(() => {
        mainImageSurfaceRef.current?.style.setProperty(
          '--storefront-gallery-zoom-x',
          `${origin.xPercent}%`
        );
        mainImageSurfaceRef.current?.style.setProperty(
          '--storefront-gallery-zoom-y',
          `${origin.yPercent}%`
        );
        setIsHoverZoomActive(true);
        hoverZoomAnimationFrameRef.current = null;
      });
    },
    [canZoom]
  );

  useEffect(() => {
    resetHoverZoom();
    setSelectedImageAspectRatio(4 / 3);
  }, [resetHoverZoom, selected?.id]);

  if (!selected) {
    return (
      <div
        className={classNames(
          'site-panel flex items-center justify-center bg-white',
          className
        )}
        style={{ aspectRatio: 1 }}
      >
        <div className="px-6 text-center text-sm text-[color:var(--site-color-text-muted)]">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="mx-auto mb-3 h-10 w-10 opacity-50"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="m5 17 5-5 3 3 2-2 4 4M8 9h.01" />
          </svg>
          Slika izdelka še ni objavljena.
        </div>
      </div>
    );
  }

  const renderMediaControl = (
    elementId: string,
    label: string,
    control: string,
    positionClassName: string,
    icon: ReactNode,
    onClick: () => void
  ) => (
    <div className={`absolute z-20 ${positionClassName}`}>
      {wrapCanvasElement(
        elementId,
        label,
        <button
          type="button"
          onClick={onClick}
          data-gallery-control={control}
          aria-label={label}
          className="inline-grid h-full w-full place-items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--site-field-focus)]"
        >
          <span aria-hidden="true" className={mediaControlVisualClassName}>{icon}</span>
        </button>,
        mediaControlClassName
      )}
    </div>
  );

  const thumbnails = (
    <div
      className="storefront-gallery-thumbnail-list"
      aria-label="Slike izdelka"
    >
      {galleryMedia
        .slice(0, appearance.gallery.visibleThumbnailCount)
        .map((entry, index) => (
          wrapCanvasElement(
            `product-gallery-thumbnail-${index + 1}`,
            `Sličica ${index + 1}`,
          <button
            key={entry.id}
            type="button"
            onClick={() => setSelectedMedia(entry)}
            className={`storefront-gallery-thumbnail site-radius-sm relative shrink-0 overflow-hidden border bg-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--site-field-focus)] ${
              selected.id === entry.id
                ? 'border-[color:var(--site-color-primary)]'
                : 'border-[color:var(--site-border-color)] hover:border-[color:var(--site-color-primary)]'
            }`}
            style={{
              width: 'var(--product-gallery-thumbnail-size, 72px)',
              height: 'var(--product-gallery-thumbnail-size, 72px)'
            }}
            aria-label={`Prikaži ${
              entry.kind === 'video'
                ? 'video'
                : entry.kind === 'document'
                  ? 'dokument'
                  : 'sliko'
            } ${index + 1}`}
            aria-pressed={selected.id === entry.id}
          >
            {entry.kind === 'image' ? (
              <Image
                src={entry.url}
                alt=""
                fill
                sizes="96px"
                className="object-contain"
              />
            ) : entry.kind === 'video' ? (
              <span className="flex h-full w-full items-center justify-center text-[color:var(--site-color-primary)]">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="currentColor"
                >
                  <path d="m9 7 8 5-8 5V7Z" />
                </svg>
              </span>
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-[color:var(--site-color-primary)]">
                PDF
              </span>
            )}
          </button>,
            'storefront-gallery-thumbnail-item inline-flex shrink-0'
          )
        ))}
    </div>
  );

  return (
    <>
      <section
        className={classNames(
          'storefront-product-gallery',
          presentation === 'reference' && styles.gallery,
          className
        )}
        data-gallery-presentation={presentation}
        data-gallery-device={previewDevice}
        data-gallery-has-caption={footer ? 'true' : undefined}
        data-thumbnail-position-desktop={thumbnailDesktopPosition}
        data-thumbnail-position-mobile={thumbnailMobilePosition}
        data-thumbnail-position-preview={previewThumbnailPosition}
        data-thumbnail-count={galleryMedia.length}
        aria-label={`Galerija: ${productName}`}
        onKeyDown={(event) => {
          if (!appearance.gallery.keyboardNavigation) return;
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            selectRelative(-1);
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            selectRelative(1);
          }
        }}
      >
        {showThumbnailStrip
          ? wrapCanvasElement(
              'product-gallery-thumbnails',
              'Sličice galerije',
              thumbnails,
              'storefront-gallery-thumbnails min-w-0'
            )
          : null}

        {wrapCanvasElement(
          'product-gallery-main',
          'Glavna slika galerije',
          <div className="h-full min-w-0">
          <div
            ref={mainImageSurfaceRef}
            className="site-panel group relative min-h-px overflow-hidden bg-white"
            data-storefront-gallery-main-image
            style={{ aspectRatio: 1 }}
          >
            <MediaViewer
              media={selected}
              productName={productName}
              priority
              zoomOnHover={canZoom}
              hoverZoomActive={isHoverZoomActive}
              onImageLoad={(width, height) => {
                if (width > 0 && height > 0) {
                  setSelectedImageAspectRatio(width / height);
                }
              }}
            />

            {canZoom ? (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.currentTarget.focus({ preventScroll: true });
                    openZoom();
                  }}
                  onPointerEnter={updateHoverZoom}
                  onPointerMove={updateHoverZoom}
                  onPointerLeave={resetHoverZoom}
                  onPointerCancel={resetHoverZoom}
                  onBlur={resetHoverZoom}
                  aria-label="Povečaj sliko"
                  title="Povečaj"
                  className="absolute inset-0 z-10 cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white/90"
                />
                {renderMediaControl(
                  'product-gallery-zoom',
                  'Odpri predogled slike',
                  'zoom-indicator',
                  'bottom-3 right-3',
                  <Search className="storefront-gallery-control-icon" />,
                  openZoom
                )}
              </>
            ) : null}

            {appearance.gallery.showArrows && galleryMedia.length > 1 ? (
              <>
                {renderMediaControl(
                  'product-gallery-previous',
                  'Prejšnja slika',
                  'previous',
                  'left-3 top-1/2 -translate-y-1/2',
                  <ChevronLeft className="storefront-gallery-control-icon" />,
                  () => selectRelative(-1)
                )}
                {renderMediaControl(
                  'product-gallery-next',
                  'Naslednja slika',
                  'next',
                  'right-3 top-1/2 -translate-y-1/2',
                  <ChevronRight className="storefront-gallery-control-icon" />,
                  () => selectRelative(1)
                )}
              </>
            ) : null}
          </div>

          {appearance.gallery.showDotsMobile && galleryMedia.length > 1 ? (
            <div
              className="storefront-gallery-dots-mobile mt-3 flex justify-center gap-1.5 lg:hidden"
              aria-hidden="true"
            >
              {galleryMedia.map((entry) => (
                <span
                  key={entry.id}
                  className={`h-1.5 rounded-full transition-all ${
                    selected.id === entry.id
                      ? 'w-5 bg-[color:var(--site-color-primary)]'
                      : 'w-1.5 bg-[color:var(--site-border-color)]'
                  }`}
                />
              ))}
            </div>
          ) : null}
          </div>,
          'storefront-gallery-main min-w-0'
        )}
        {footer ? wrapCanvasElement(
          'product-gallery-sale-unit',
          'Prodajna enota pod galerijo',
          footer,
          styles.caption
        ) : null}
      </section>

      <ImagePreviewDialog
        open={isZoomOpen && selected.kind === 'image'}
        src={selected.originalUrl ?? selected.url}
        alt={selected.altText || productName}
        aspectRatio={selected.originalWidth && selected.originalHeight
          ? selected.originalWidth / selected.originalHeight
          : selectedImageAspectRatio}
        originalHref={selected.originalUrl ?? selected.url}
        originalLabel={isDimensionDiagram(selected) ? 'Odpri skico v polni velikosti' : 'Odpri izvirno sliko v polni velikosti'}
        onClose={closeZoom}
      />
    </>
  );
}
