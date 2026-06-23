import type { ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger';

interface ActionButtonProps {
  onClick?: () => void;
  variant?: Variant;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** 풀폭 CTA — 골드 프라이머리 / 철판 세컨더리 */
export default function ActionButton({
  onClick,
  variant = 'primary',
  icon,
  children,
  className = '',
}: ActionButtonProps) {
  const base =
    'w-full h-[54px] rounded-[15px] text-[15.5px] font-semibold flex items-center justify-center gap-2.5 transition-transform duration-150 active:scale-[0.98]';
  const cls =
    variant === 'primary'
      ? 'btn-gold'
      : variant === 'danger'
        ? 'bg-[#CD746C]/10 border border-[#CD746C]/25 text-[#DD8C85]'
        : 'btn-tile';

  return (
    <button onClick={onClick} className={`${base} ${cls} ${className}`}>
      {icon}
      {children}
    </button>
  );
}
