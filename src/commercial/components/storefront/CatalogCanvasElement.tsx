'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useProductAppearance } from '@/commercial/components/ProductAppearanceProvider';
import { resolveProductCanvasElementDeviceSettings, type ProductCanvasDevice } from '@/shared/domain/style/productAppearance';
import ProductCanvasElement from '@/shared/ui/product-canvas/ProductCanvasElement';
import useProductCanvasDevice from './useProductCanvasDevice';

export type CatalogCanvasWrapper = (
  id: string, label: string, children: ReactNode, className?: string, representative?: boolean
) => ReactNode;

export const CatalogCanvasContext = createContext<{
  wrapper?: CatalogCanvasWrapper;
  representativeProductId?: string;
  device?: ProductCanvasDevice;
}>({});

export default function CatalogCanvasElement({
  id, label, children, className = '', productId
}: {
  id: string; label: string; children: ReactNode; className?: string; productId?: string;
}) {
  const { wrapper, representativeProductId, device: previewDevice } = useContext(CatalogCanvasContext);
  const appearance = useProductAppearance();
  const device = useProductCanvasDevice();
  if (wrapper) {
    return wrapper(id, label, children, className, !productId || productId === representativeProductId);
  }
  // Catalog elements use their own IDs; retired card layouts cannot distort rows.
  if (appearance.canvas.mode !== 'free' || !appearance.canvas.elements[id]) return children;
  return (
    <ProductCanvasElement elementId={id} label={label}
      settings={resolveProductCanvasElementDeviceSettings(appearance, id, previewDevice ?? device)}
      active className={className}>{children}</ProductCanvasElement>
  );
}
