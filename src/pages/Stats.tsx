import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import PageLayout from '@/components/layout/PageLayout';
import SectionLabel from '@/components/shared/SectionLabel';
import StatRow from '@/components/shared/StatRow';

// Stable mock data via useMemo
function useHeatmapData() {
  return useMemo(() => {
    const seed = [3,0,12,8,0,25,18,7,14,0,22,5,19,0,31,10,0,27,6,15,
      0,9,20,4,0,28,11,0,16,23,8,0,33,7,21,0,13,26,0,17,
      5,0,30,9,0,24,14,0,19,11,28,0,6,22,0,35,8,15,0,20,
      12,0,27,4,18,0,29,7,0,23,10,31,0,16,5,0,26,13,0,21,
      8,0,34,11,0,19,6,25,0,14,28,0,9,17,0,32,7,20,0,15,
      0,23,10,0,27,5,18,0,30,8,0,22,12,0,26,4,16,0,29,11,
      0,24,6,19,0,33,9,0,21,13,0,28,7,15,0,31,10,0,25,3];
    return seed;
  }, []);
}

function getHeatColor(count: number): string {
  if (count === 0) return '#1c1c1f';
  if (count < 8) return '#1e3a5f';
  if (count < 15) return '#1d5fa0';
  if (count < 25) return '#3b82f6';
  return '#60a5fa';
}

const dailyData = [18,25,12,30,8,22,35,15,28,10,32,20,14,38,16,24,9,33,19,27,11,36,21,13,29,7,31,17,26,40];
const maxDaily = Math.max(...dailyData);

const tierAccuracy = [
  { tier: 'Foundation', label: '기초', color: '#60a5fa', pct: 89 },
  { tier: 'Mechanism', label: '원리', color: '#fbbf24', pct: 74 },
  { tier: 'Diagnosis', label: '진단', color: '#f87171', pct: 58 },
];

const weekLabels = ['일', '월', '화', '수', '목', '금', '토'];

export default function Stats() {
  const heatmapData = useHeatmapData();

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
        <SectionLabel>복습 히트맵 (20주)</SectionLabel>
        <Card>
          <CardContent className="p-4">
            <div
              className="grid gap-[3px]"
              style={{
                gridTemplateRows: 'repeat(7, 1fr)',
                gridTemplateColumns: 'repeat(20, 1fr)',
                gridAutoFlow: 'column',
              }}
            >
              {heatmapData.map((count, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-[3px]"
                  style={{ background: getHeatColor(count) }}
                />
              ))}
            </div>
            {/* Legend */}
            <div className="flex items-center justify-end gap-1.5 mt-3">
              <span className="text-[10px] text-zinc-500">적음</span>
              {[0, 8, 15, 25, 35].map((v) => (
                <div
                  key={v}
                  className="w-[10px] h-[10px] rounded-[2px]"
                  style={{ background: getHeatColor(v) }}
                />
              ))}
              <span className="text-[10px] text-zinc-500">많음</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily volume chart */}
      <div className="animate-up stagger-2">
        <SectionLabel>일별 복습량 (30일)</SectionLabel>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-end gap-[4px] h-[100px]">
              {dailyData.map((val, i) => {
                const ratio = val / maxDaily;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0">
                    <div
                      className="w-full rounded-t-md"
                      style={{
                        height: `${ratio * 100}%`,
                        background: ratio < 0.4
                          ? 'linear-gradient(to top, #1e3a5f, #3b82f6)'
                          : ratio < 0.7
                            ? 'linear-gradient(to top, #92400e, #fbbf24)'
                            : 'linear-gradient(to top, #991b1b, #f87171)',
                        minHeight: '4px',
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-3">
              <span className="text-[10px] text-zinc-500">30일 전</span>
              <span className="text-[10px] text-zinc-500">오늘</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tier accuracy */}
      <div className="animate-up stagger-3">
        <SectionLabel>티어별 정답률</SectionLabel>
        <Card>
          <CardContent className="p-4 space-y-5">
            {tierAccuracy.map((t) => (
              <div key={t.tier} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: t.color }}
                    />
                    <span className="text-[14px] font-medium">{t.label}</span>
                    <span className="text-[12px] text-zinc-500">{t.tier}</span>
                  </div>
                  <span className="font-display text-[18px] font-bold tabular-nums" style={{ color: t.color }}>
                    {t.pct}%
                  </span>
                </div>
                <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-3 rounded-full transition-all duration-700 relative"
                    style={{
                      width: `${t.pct}%`,
                      background: `linear-gradient(90deg, ${t.color}99, ${t.color})`,
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
