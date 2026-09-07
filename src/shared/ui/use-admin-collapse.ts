'use client';

import { useLayoutEffect, useRef, useState, type TransitionEvent } from 'react';

/** Retain collapsing content until its shared grid transition finishes. */
export function useAdminCollapse(open: boolean) {
  const [mounted, setMounted] = useState(open);
  const [expanded, setExpanded] = useState(open);
  const [settled, setSettled] = useState(open);
  const started = useRef(open);

  useLayoutEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let firstFrame = 0;
    let secondFrame = 0;
    const cancelFrames = () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      firstFrame = 0;
      secondFrame = 0;
    };
    const settleReducedMotion = () => {
      if (!motionPreference.matches) return;
      cancelFrames();
      started.current = open;
      setMounted(open);
      setExpanded(open);
      setSettled(open);
    };
    motionPreference.addEventListener('change', settleReducedMotion);
    const cleanup = () => {
      cancelFrames();
      motionPreference.removeEventListener('change', settleReducedMotion);
    };

    if (!open) {
      setSettled(false);
      setExpanded(false);
      if (!started.current || motionPreference.matches) {
        started.current = false;
        setMounted(false);
      }
      return cleanup;
    }
    if (!mounted) { setMounted(true); return cleanup; }
    if (motionPreference.matches) {
      settleReducedMotion();
      return cleanup;
    }
    // Paint the zero-height cells before expanding; cancel pending frames on reversal.
    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        started.current = true;
        setExpanded(true);
      });
    });
    return cleanup;
  }, [open, mounted]);

  const onTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'grid-template-rows') return;
    if (!expanded) {
      // A close can finish while reopening is still waiting for its animation frames.
      started.current = false;
      if (!open) setMounted(false);
    } else if (open) setSettled(true);
  };

  return { mounted, expanded, settled, onTransitionEnd };
}
