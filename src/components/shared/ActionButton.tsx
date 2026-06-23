import type { ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'warning' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-blue-600 to-blue-500 text-white active:from-blue-700 active:to-blue-600 active:shadow-none',
  secondary:
    'bg-zinc-900 border border-zinc-800/60 text-zinc-200 active:bg-zinc-800',
  warning:
    'bg-gradient-to-r from-amber-600 to-amber-500 text-white active:from-amber-700 active:to-amber-600',
  danger:
    'bg-red-500/5 border border-red-500/20 text-red-400 active:bg-red-500/10',
};

interface ActionButtonProps {
  onClick?: () => void;
  variant?: Variant;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** 풀폭 모바일 CTA 버튼 — 높이 h-12(48px)로 통일 */
export default function ActionButton({
  onClick,
  variant = 'primary',
  icon,
  children,
  className = '',
}: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full h-12 rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2.5 transition-all duration-150 active:scale-[0.96] ${VARIANTS[variant]} ${className}`}
      style={
        variant === 'primary'
          ? { boxShadow: '0 2px 12px rgba(37, 99, 235, 0.15)' }
          : undefined
      }
    >
      {icon}
      {children}
    </button>
  );
}
