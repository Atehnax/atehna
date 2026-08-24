'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import {
  createCartLineId,
  type AddCartItemInput,
  type CartItem,
  type CartReconciliationUpdate
} from '@/commercial/cart/cartTypes';

export type {
  AddCartItemInput,
  CartItem,
  CartOptionSelection,
  CartPricingSnapshot,
  CartReconciliation,
  CartReconciliationStatus,
  CartVariantSnapshot
} from '@/commercial/cart/cartTypes';

type CartState = {
  items: CartItem[];
  isOpen: boolean;
  lastChangedLineId: string | null;
  announcement: string;
  addItem: (item: AddCartItemInput) => string;
  removeItem: (lineIdOrSku: string) => void;
  setQuantity: (lineIdOrSku: string, quantity: number) => void;
  updateItem: (lineId: string, patch: Partial<CartItem>) => void;
  reconcileItems: (updates: CartReconciliationUpdate[]) => void;
  clearCart: () => void;
  getItemCount: () => number;
  openDrawer: () => void;
  closeDrawer: () => void;
  clearAnnouncement: () => void;
};

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined
};

const storage: StateStorage =
  typeof window !== 'undefined' ? localStorage : noopStorage;

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      lastChangedLineId: null,
      announcement: '',

      addItem: (item) => {
        const lineId =
          item.lineId ??
          createCartLineId({
            sku: item.sku,
            productId: item.productId,
            variant: item.variant
          });
        const incomingQuantity = Math.max(1, Math.floor(item.quantity ?? 1));
        set((state) => {
          const incomingUnitPrice = item.unitPrice ?? null;
          const existing = state.items.find((current) => current.lineId === lineId);

          if (existing) {
            return {
              items: state.items.map((current) => {
                if (current.lineId !== lineId) return current;

                return {
                  ...current,
                  unitPrice: current.unitPrice ?? incomingUnitPrice,
                  pricing: item.pricing ?? current.pricing,
                  imageUrl: item.imageUrl ?? current.imageUrl,
                  imageAlt: item.imageAlt ?? current.imageAlt,
                  productHref: item.productHref ?? current.productHref,
                  variant: item.variant ?? current.variant,
                  reconciliation: item.reconciliation ?? {
                    status: 'unchecked'
                  },
                  quantity: current.quantity + incomingQuantity
                };
              }),
              lastChangedLineId: lineId,
              announcement: `${item.name} je dodan v košarico. Količina je ${existing.quantity + incomingQuantity}.`
            };
          }

          return {
            items: [
              ...state.items,
              {
                lineId,
                sku: item.sku,
                name: item.name,
                productId: item.productId,
                productSlug: item.productSlug,
                productHref: item.productHref,
                imageUrl: item.imageUrl,
                imageAlt: item.imageAlt,
                variant: item.variant,
                unit: item.unit,
                category: item.category,
                note: item.note,
                unitPrice: incomingUnitPrice,
                pricing: item.pricing,
                quantity: incomingQuantity,
                reconciliation: item.reconciliation ?? { status: 'unchecked' }
              }
            ],
            lastChangedLineId: lineId,
            announcement: `${item.name} je dodan v košarico.`
          };
        });
        return lineId;
      },

      removeItem: (lineIdOrSku) =>
        set((state) => {
          const removed = state.items.find(
            (item) => item.lineId === lineIdOrSku || item.sku === lineIdOrSku
          );
          return {
            items: state.items.filter(
              (item) => item.lineId !== lineIdOrSku && item.sku !== lineIdOrSku
            ),
            lastChangedLineId: null,
            announcement: removed ? `${removed.name} je odstranjen iz košarice.` : ''
          };
        }),

      setQuantity: (lineIdOrSku, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter(
                  (item) => item.lineId !== lineIdOrSku && item.sku !== lineIdOrSku
                )
              : state.items.map((item) =>
                  item.lineId === lineIdOrSku || item.sku === lineIdOrSku
                    ? {
                        ...item,
                        quantity: Math.max(1, Math.floor(quantity)),
                        reconciliation: { status: 'unchecked' }
                      }
                    : item
                ),
          lastChangedLineId:
            state.items.find(
              (item) => item.lineId === lineIdOrSku || item.sku === lineIdOrSku
            )?.lineId ?? null
        })),

      updateItem: (lineId, patch) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.lineId === lineId ? { ...item, ...patch, lineId } : item
          )
        })),

      reconcileItems: (updates) =>
        set((state) => {
          const updatesByLineId = new Map(updates.map((update) => [update.lineId, update]));
          return {
            items: state.items.map((item) => {
              const update = updatesByLineId.get(item.lineId);
              if (!update) return item;
              return {
                ...item,
                quantity: update.quantity ?? item.quantity,
                pricing: item.pricing
                  ? { ...item.pricing, ...update.pricing }
                  : update.pricing
                    ? {
                        currency: 'EUR',
                        taxRate: 0.22,
                        baseUnitNet: 0,
                        discountPct: 0,
                        unitNet: 0,
                        estimatedUnitGross: 0,
                        ...update.pricing
                      }
                    : undefined,
                reconciliation: update.reconciliation
              };
            })
          };
        }),

      clearCart: () =>
        set({
          items: [],
          lastChangedLineId: null,
          announcement: 'Košarica je izpraznjena.'
        }),
      getItemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
      openDrawer: () => set({ isOpen: true }),
      closeDrawer: () => set({ isOpen: false }),
      clearAnnouncement: () => set({ announcement: '' })
    }),
    {
      name: 'atehna-cart-v3',
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ items: state.items })
    }
  )
);
