import { Card, CardContent } from '@/components/ui/card';

interface StatItem {
  value: string | number;
  label: string;
  color?: string;
}

interface StatRowProps {
  items: StatItem[];
}

export default function StatRow({ items }: StatRowProps) {
  return (
    <Card className="border-gate-gradient">
      <CardContent className="p-4">
        <div
          className="grid divide-x divide-zinc-800/50"
          style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
        >
          {items.map((s, i) => (
            <div key={i} className="text-center px-2">
              <p className={`font-display text-2xl font-bold tabular-nums ${s.color || 'text-zinc-100'}`}>
                {s.value}
              </p>
              <p className="text-[11px] text-zinc-500 mt-1 tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
