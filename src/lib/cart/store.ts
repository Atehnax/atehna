'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';

export type CartItem = {
  sku: string;
  name: string;
  unit?: string;
  unitPrice?: number | null;
  quantity: number;
  category?: string;
  note?: string;
};

type AddCartItemInput = Omit<CartItem, 'quantity'> & {
  quantity?: number;
  price?: number | null; // legacy fallback
};

type CartState = {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: AddCartItemInput) => void;
  removeItem: (sku: string) => void;
  setQuantity: (sku: string, quantity: number) => void;
  clearCart: () => void;
  getItemCount: () => number;
  openDrawer: () => void;
  closeDrawer: () => void;
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

      addItem: (item) =>
        set((state) => {
          const incomingUnitPrice = item.unitPrice ?? item.price ?? null;
          const existing = state.items.find((current) => current.sku === item.sku);

          if (existing) {
            return {
              items: state.items.map((current) => {
                if (current.sku !== item.sku) return current;

                // handles old persisted objects that might still have `price`
                const currentUnitPrice =
                  current.unitPrice ??
                  ((current as CartItem & { price?: number | null }).price ?? null);

                return {
                  ...current,
                  unitPrice: currentUnitPrice ?? incomingUnitPrice,
                  quantity: current.quantity + (item.quantity ?? 1)
                };
              })
            };
          }

          return {
            items: [
              ...state.items,
              {
                sku: item.sku,
                name: item.name,
                unit: item.unit,
                category: item.category,
                note: item.note,
                unitPrice: incomingUnitPrice,
                quantity: item.quantity ?? 1
              }
            ]
          };
        }),

      removeItem: (sku) =>
        set((state) => ({
          items: state.items.filter((item) => item.sku !== sku)
        })),

      setQuantity: (sku, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((item) => item.sku !== sku)
              : state.items.map((item) =>
                  item.sku === sku ? { ...item, quantity } : item
                )
        })),

      clearCart: () => set({ items: [] }),
      getItemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
      openDrawer: () => set({ isOpen: true }),
      closeDrawer: () => set({ isOpen: false })
    }),
    {
      name: 'atehna-cart',
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ items: state.items })
    }
  )
);
