'use client';

import { useSyncExternalStore } from 'react';
import type { ProductCanvasDevice } from '@/shared/domain/style/productAppearance';

const subscribers = new Set<() => void>();
let listening = false;

const getDevice = (): ProductCanvasDevice => {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  return width <= 767 ? 'mobile' : width <= 1024 ? 'tablet' : 'desktop';
};

const notifySubscribers = () => {
  subscribers.forEach((subscriber) => subscriber());
};

const subscribe = (subscriber: () => void) => {
  subscribers.add(subscriber);

  if (!listening && typeof window !== 'undefined') {
    window.addEventListener('resize', notifySubscribers);
    listening = true;
  }

  return () => {
    subscribers.delete(subscriber);
    if (listening && subscribers.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('resize', notifySubscribers);
      listening = false;
    }
  };
};

export default function useProductCanvasDevice(): ProductCanvasDevice {
  return useSyncExternalStore(subscribe, getDevice, () => 'desktop');
}
