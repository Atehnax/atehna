'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useProgressiveActivation() {
  const [isActive, setIsActive] = useState(false);
  const activatedRef = useRef(false);

  const activate = useCallback(() => {
    if (activatedRef.current) return;
    activatedRef.current = true;
    setIsActive(true);
  }, []);

  useEffect(() => {
    if (activatedRef.current) return;

    let frameA = 0;
    let frameB = 0;
    let idleId: number | null = null;

    frameA = window.requestAnimationFrame(() => {
      frameB = window.requestAnimationFrame(() => {
        activate();
      });
    });

    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(() => {
        activate();
      }, { timeout: 1200 });
    }

    return () => {
      if (frameA) window.cancelAnimationFrame(frameA);
      if (frameB) window.cancelAnimationFrame(frameB);
      if (idleId !== null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [activate]);

  return { isActive, activate };
}
