import type { Tier } from '@/types';

const config = {
  foundation: { label: 'F', full: 'Foundation', bg: 'bg-blue-500/15', text: 'text-blue-400', dot: 'bg-blue-400' },
  mechanism: { label: 'M', full: 'Mechanism', bg: 'bg-amber-500/15', text: 'text-amber-400', dot: 'bg-amber-400' },
  diagnosis: { label: 'D', full: 'Diagnosis', bg: 'bg-red-500/15', text: 'text-red-400', dot: 'bg-red-400' },
} as const;

interface TierBadgeProps {
  tier: Tier;
  full?: boolean;
}

export default function TierBadge({ tier, full = false }: TierBadgeProps) {
  const cfg = config[tier];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {full ? cfg.full : cfg.label}
    </span>
  );
}
