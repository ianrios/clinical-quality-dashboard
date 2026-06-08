import { useState } from 'react';

interface Props {
  label: string;
  tooltip: string;
  align?: 'left' | 'right';
}

interface TooltipPos {
  bottom: number;
  left?: number;
  right?: number;
}

export function TooltipHeader({ label, tooltip, align = 'right' }: Props) {
  const [pos, setPos] = useState<TooltipPos | null>(null);
  const isLeft = align === 'left';

  const handleMouseEnter = (e: React.MouseEvent<HTMLSpanElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPos({
      bottom: window.innerHeight - rect.top + 8,
      ...(isLeft ? { left: rect.left } : { right: window.innerWidth - rect.right }),
    });
  };

  const icon = (
    <span
      className="text-gray-400 hover:text-gray-600 cursor-help select-none"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setPos(null)}
    >
      ⓘ
    </span>
  );

  return (
    <div className={`flex items-center gap-1 ${isLeft ? '' : 'justify-end'}`}>
      {!isLeft && icon}
      {label}
      {isLeft && icon}
      {pos && (
        <span
          style={{
            position: 'fixed',
            bottom: pos.bottom,
            ...(pos.left !== undefined ? { left: pos.left } : { right: pos.right }),
            zIndex: 999,
          }}
          className="w-64 bg-gray-800 text-white text-xs font-normal normal-case rounded p-2 leading-relaxed text-left pointer-events-none"
        >
          {tooltip}
        </span>
      )}
    </div>
  );
}
