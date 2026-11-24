import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

let openLockCount = 0;

/**
 * Ref-counted body scroll lock so nested or stacked modals never
 * prematurely unlock scrolling while an underlying modal remains open.
 */
export function useModalScrollLock(isLocked: boolean = true) {
  useEffect(() => {
    if (!isLocked || typeof document === 'undefined') return;

    openLockCount += 1;
    if (openLockCount === 1) {
      document.body.style.overflow = 'hidden';
      document.body.dataset.modalOpen = 'true';
    }

    return () => {
      openLockCount = Math.max(0, openLockCount - 1);
      if (openLockCount === 0) {
        document.body.style.overflow = '';
        delete document.body.dataset.modalOpen;
      }
    };
  }, [isLocked]);
}

interface ModalPortalProps {
  children: React.ReactNode;
  lockScroll?: boolean;
}

/**
 * Mounts modal overlays directly onto document.body so ancestor transforms,
 * view transitions, filters, or sticky headers/navbars never trap fixed positioning
 * or bleed above modal layers.
 */
export default function ModalPortal({ children, lockScroll = true }: ModalPortalProps) {
  useModalScrollLock(lockScroll);

  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
