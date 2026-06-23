import type { Tier } from '@/types';

const config: Record<Tier, { label: string; full: string; dot: string; text: string }> = {
  foundation: { label: 'F', full: 'Foundation', dot: '#6E8BC9', text: '#93A8DC' },
  mechanism: { label: 'M', full: 'Mechanism', dot: '#CFA24E', text: '#DDB868' },
  diagnosis: { label: 'D', full: 'Diagnosis', dot: '#CD746C', text: '#DD8C85' },
};

interface TierBadgeProps {
  tier: Tier;
  full?: boolean;
}

export default function TierBadge({ tier, full = false }: TierBadgeProps) {
  const c = config[tier];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-semibold"
      style={{ background: `${c.dot}22`, border: `1px solid ${c.dot}52`, color: c.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      {full ? c.full : c.label}
    </span>
  );
}
