import { GATE_COLORS } from '@/lib/tokens';

const TOTAL = 8;

interface GateMeterProps {
  /** 현재 값 (예: 오늘 복습한 카드 수) */
  value: number;
  /** 목표 값 (예: 세션 크기) */
  max: number;
  /** 글리프 높이(px) */
  size?: number;
  /** 캡션("여덟 문 중 N문 개방") 표시 */
  showCaption?: boolean;
  className?: string;
}

interface GateProps {
  color: string;
  open: boolean;
  newest: boolean;
  size: number;
  index: number;
}

/** 토리이(⛩) 게이트 글리프 — 닫힘(흐림) / 열림(게이트 색 + 글로우) / 방금 열림(펄스) */
function Gate({ color, open, newest, size, index }: GateProps) {
  const w = (size * 28) / 32;
  const stroke = open ? color : '#3f3f46';

  const animation = !open
    ? undefined
    : newest
      ? `gate-open 0.5s cubic-bezier(0.16,1,0.3,1) ${index * 70}ms both, gate-pulse 2.2s ease-in-out ${index * 70 + 500}ms infinite`
      : `gate-open 0.5s cubic-bezier(0.16,1,0.3,1) ${index * 70}ms both`;

  return (
    <svg
      width={w}
      height={size}
      viewBox="0 0 28 32"
      fill="none"
      stroke={stroke}
      strokeWidth={2.3}
      strokeLinecap="round"
      style={{
        ['--gate-glow' as string]: color,
        opacity: open ? 1 : 0.4,
        filter: open && !newest ? `drop-shadow(0 0 4px ${color}99)` : undefined,
        animation,
      }}
    >
      {/* 열린 문 사이로 들어오는 빛 */}
      {open && <rect x="8.5" y="12" width="11" height="18" rx="1" fill={color} opacity={0.13} stroke="none" />}
      {/* 카사기 (윗보) */}
      <line x1="2" y1="6" x2="26" y2="6" strokeWidth={3.2} />
      {/* 누키 (둘째보) */}
      <line x1="5.5" y1="11.5" x2="22.5" y2="11.5" />
      {/* 기둥 둘 */}
      <line x1="8.5" y1="6" x2="8.5" y2="30" />
      <line x1="19.5" y1="6" x2="19.5" y2="30" />
    </svg>
  );
}

/** 八門 진행 미터 — 진행도에 따라 여덟 문이 왼→오른쪽으로 하나씩 열린다. */
export default function GateMeter({
  value,
  max,
  size = 30,
  showCaption = false,
  className = '',
}: GateMeterProps) {
  const ratio = max > 0 ? value / max : 0;
  const open = Math.min(TOTAL, Math.max(0, Math.round(ratio * TOTAL)));

  return (
    <div className={className}>
      <div className="flex items-end justify-between">
        {GATE_COLORS.map((color, i) => (
          <Gate key={i} color={color} open={i < open} newest={i === open - 1} size={size} index={i} />
        ))}
      </div>
      {showCaption && (
        <p className="text-[11px] text-zinc-500 mt-2.5 tabular-nums tracking-wide">
          여덟 문 중 <span className="text-zinc-300 font-medium">{open}</span>문 개방
        </p>
      )}
    </div>
  );
}
