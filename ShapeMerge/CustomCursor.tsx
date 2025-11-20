import React, { useEffect, useRef } from 'react';

export const CustomCursor: React.FC = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorInnerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    const cursorInner = cursorInnerRef.current;
    if (!cursor || !cursorInner) return;

    const onMouseMove = (e: MouseEvent) => {
      // Direct DOM manipulation for performance
      cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if element is clickable
      const isClickable = 
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.closest('a') ||
        target.closest('button') ||
        window.getComputedStyle(target).cursor === 'pointer';

      if (isClickable) {
        cursorInner.style.backgroundColor = '#ffffff';
      } else {
        cursorInner.style.backgroundColor = 'transparent';
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseover', onMouseOver);
    
    // Hide default cursor
    document.body.style.setProperty('cursor', 'none');

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseover', onMouseOver);
      document.body.style.cursor = 'auto';
    };
  }, []);

  return (
    <div
      ref={cursorRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        willChange: 'transform',
        mixBlendMode: 'difference',
      }}
    >
      <div
        ref={cursorInnerRef}
        style={{
          width: '20px',
          height: '20px',
          boxSizing: 'border-box',
          backgroundColor: 'transparent',
          border: '2px solid #ffffff',
          borderRadius: '50%',
          marginTop: '-10px', // Center the cursor
          marginLeft: '-10px',
          transition: 'transform 0.2s ease-out, background-color 0.2s ease-out',
        }}
      />
    </div>
  );
};
