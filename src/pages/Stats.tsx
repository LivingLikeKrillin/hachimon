import { Card, CardContent } from '@/components/ui/card';
import PageLayout from '@/components/layout/PageLayout';
import SectionLabel from '@/components/shared/SectionLabel';
import StatRow from '@/components/shared/StatRow';

// 20-week heatmap mock data (7 days x 20 weeks = 140 cells)
function generateHeatmap(): number[] {
  const data: number[] = [];
  for (let i = 0; i < 140; i++) {
    const rand = Math.random();
    if (rand < 0.15) data.push(0);
    else if (rand < 0.4) data.push(Math.floor(Math.random() * 10) + 1);
    else if (rand < 0.7) data.push(Math.floor(Math.random() * 20) + 10);
    else data.push(Math.floor(Math.random() * 30) + 20);
  }
  return data;
}

function getHeatColor(count: number): string {
  if (count === 0) return '#18181b';
  if (count < 5) return 'rgba(96, 165, 250, 0.2)';
  if (count < 10) return 'rgba(96, 165, 250, 0.35)';
  if (count < 20) return 'rgba(96, 165, 250, 0.55)';
  if (count < 30) return 'rgba(96, 165, 250, 0.75)';
  return '#60a5fa';
}

// 30-day bar chart mock
const dailyData = Array.from({ length: 30 }, () => Math.floor(Math.random() * 40) + 5);
const maxDaily = Math.max(...dailyData);

// Tier accuracy mock
const tierAccuracy = [
  { tier: 'Foundation', color: 'var(--gate-1)', pct: 89 },
  { tier: 'Mechanism', color: 'var(--gate-5)', pct: 74 },
  { tier: 'Diagnosis', color: 'var(--gate-7)', pct: 58 },
];

const heatmapData = generateHeatmap();

export default function Stats() {
  return (
    <PageLayout>
      {/* Summary stats */}
      <div className="animate-up">
        <StatRow
          items={[
            { value: '4,287', label: '총 복습', color: 'text-blue-400' },
            { value: 312, label: '마스터', color: 'text-emerald-400' },
            { value: '74%', label: '정답률', color: 'text-amber-400' },
          ]}
        />
      </div>

      {/* Heatmap */}
      <div className="animate-up stagger-1">
        <SectionLabel>복습 히트맵</SectionLabel>
        <Card>
          <CardContent className="p-4">
            <div className="overflow-x-auto -mx-1">
              <div
                className="grid gap-[3px]"
                style={{
                  gridTemplateRows: 'repeat(7, 1fr)',
                  gridTemplateColumns: `repeat(20, 1fr)`,
                  gridAutoFlow: 'column',
                  width: 'fit-content',
                  minWidth: '100%',
                }}
              >
                {heatmapData.map((count, i) => (
                  <div
                    key={i}
                    className="w-[14px] h-[14px] rounded-[3px] transition-colors"
                    style={{ background: getHeatColor(count) }}
                    title={`${count}회`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-1.5 mt-3">
              <span className="text-[10px] text-zinc-600">Less</span>
              {[0, 5, 10, 20, 30].map((v) => (
                <div
                  key={v}
                  className="w-[10px] h-[10px] rounded-[2px]"
                  style={{ background: getHeatColor(v) }}
                />
              ))}
              <span className="text-[10px] text-zinc-600">More</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily volume chart */}
      <div className="animate-up stagger-2">
        <SectionLabel>일별 복습량 (30일)</SectionLabel>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-end gap-[3px] h-[80px]">
              {dailyData.map((val, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm transition-all duration-300"
                  style={{
                    height: `${(val / maxDaily) * 100}%`,
                    background: `linear-gradient(to top, var(--gate-1), var(--gate-2))`,
                    opacity: 0.4 + (val / maxDaily) * 0.6,
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-zinc-600">30일 전</span>
              <span className="text-[10px] text-zinc-600">오늘</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tier accuracy */}
      <div className="animate-up stagger-3">
        <SectionLabel>티어별 정답률</SectionLabel>
        <Card>
          <CardContent className="p-4 space-y-4">
            {tierAccuracy.map((t) => (
              <div key={t.tier} className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[13px]">{t.tier}</span>
                  <span className="font-display text-[14px] font-semibold tabular-nums" style={{ color: t.color }}>
                    {t.pct}%
                  </span>
                </div>
                <div className="w-full h-2 bg-zinc-800/60 rounded-full overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all duration-700"
                    style={{
                      width: `${t.pct}%`,
                      background: t.color,
                      boxShadow: `0 0 10px ${t.color}40`,
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
