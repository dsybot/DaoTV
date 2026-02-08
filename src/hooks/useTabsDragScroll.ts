import { useCallback, useRef, useState } from 'react';

interface DragState {
  isActive: boolean;
  startX: number;
  startScrollLeft: number;
  preventClickUntil: number;
}

export function useTabsDragScroll() {
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<DragState>({
    isActive: false,
    startX: 0,
    startScrollLeft: 0,
    preventClickUntil: 0,
  });

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    // Only handle left mouse button
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const target = event.currentTarget;
    const scrollContainer = target.querySelector('.MuiTabs-scroller') as HTMLElement;
    if (!scrollContainer) return;

    dragStateRef.current.isActive = true;
    dragStateRef.current.startX = event.clientX;
    dragStateRef.current.startScrollLeft = scrollContainer.scrollLeft;
    setIsDragging(true);

    // Capture pointer for smooth dragging
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }

    // Prevent text selection during drag
    event.preventDefault();
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState.isActive) return;

    const target = event.currentTarget;
    const scrollContainer = target.querySelector('.MuiTabs-scroller') as HTMLElement;
    if (!scrollContainer) return;

    const deltaX = event.clientX - dragState.startX;

    // If moved more than 6px, prevent click events
    if (Math.abs(deltaX) > 6) {
      dragState.preventClickUntil = Date.now() + 160;
    }

    // Update scroll position
    scrollContainer.scrollLeft = dragState.startScrollLeft - deltaX;
  }, []);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget;

    // Release pointer capture
    if (target.hasPointerCapture(event.pointerId)) {
      try {
        target.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    }

    dragStateRef.current.isActive = false;
    setIsDragging(false);
  }, []);

  const handlePointerCancel = useCallback(() => {
    dragStateRef.current.isActive = false;
    setIsDragging(false);
  }, []);

  const shouldPreventClick = useCallback(() => {
    return Date.now() < dragStateRef.current.preventClickUntil;
  }, []);

  return {
    isDragging,
    shouldPreventClick,
    dragHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
      onPointerLeave: handlePointerCancel,
    },
  };
}
