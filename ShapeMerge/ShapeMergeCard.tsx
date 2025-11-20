import React, { useRef, useEffect } from 'react';
import { useShapeMergeContext } from './ShapeMergeProvider';

interface ShapeMergeCardProps extends React.HTMLAttributes<HTMLDivElement> {
  cornerRadius?: number;
}

export const ShapeMergeCard: React.FC<ShapeMergeCardProps> = ({ 
  children, 
  cornerRadius = 20,
  style,
  ...props 
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { registerElement, unregisterElement } = useShapeMergeContext();
  const id = useRef(Math.random().toString(36).substr(2, 9)).current;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      const rect = element.getBoundingClientRect();
      registerElement({
        id,
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        cornerRadius
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener('scroll', update);
    window.addEventListener('resize', update);

    return () => {
      unregisterElement(id);
      observer.disconnect();
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [registerElement, unregisterElement, cornerRadius]);

  return (
    <div 
      ref={ref} 
      style={{ 
        ...style,
        // Make the card itself transparent so we see the glass effect behind it
        backgroundColor: 'transparent', 
      }} 
      {...props}
    >
      {children}
    </div>
  );
};
