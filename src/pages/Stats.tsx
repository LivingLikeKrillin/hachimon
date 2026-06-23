import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import PageLayout from '@/components/layout/PageLayout';
import { getMasteryStats, getReviewStats, type MasteryStats, type ReviewStats } from '@/lib/data';

function heatColor(n: number): string {
  if (n === 0) return '#14161B';
  if (n < 8) return 'rgba(110,139,201,0.22)';
  if (n < 15) return 'rgba(110,139,201,0.42)';
  if (n < 25) return 'rgba(110,139,201,0.66)';
  return '#6E8BC9';
}

const EMPTY_STATS: ReviewStats = {
  summary: { total: 0, accuracy: 0 },
  heatmap: new Array(140).fill(0),
  daily: new Array(30).fill(0),
};

export default function Stats() {
  const [mastery, setMastery] = useState<MasteryStats>({ mastered: 0, total: 0 });
  const [stats, setStats] = useState<ReviewStats>(EMPTY_STATS);

  useEffect(() => {
    getMasteryStats().then(setMastery);
    getReviewStats().then(setStats);
  }, []);

  const masterPct = mastery.total > 0 ? (mastery.mastered / mastery.total) * 100 : 0;
  const { summary, heatmap: heat, daily } = stats;
  const maxDaily = Math.max(1, ...daily);
  const accuracyPct = Math.round(summary.accuracy * 100);

  return (
    <PageLayout>
      {/* Mastery progress */}
      <Card className="animate-up">
        <CardContent className="p-5">
          <div className="flex items-baseline justify-between mb-4">
            <span className="text-[15px] font-semibold text-[#ECEEF2]">마스터 진행도</span>
            <span className="font-num text-[14px] text-[#5D636F]">
              <span className="text-[18px] font-semibold text-[#ECEEF2]">{mastery.mastered}</span> / {mastery.total}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-[#0E1015] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="h-full rounded-full bg-[#5FB991] shadow-[0_0_8px_rgba(95,185,145,0.6)]" style={{ width: `max(5px, ${masterPct}%)` }} />
          </div>
          <p className="text-[12.5px] text-[#5D636F] mt-3.5">복습을 반복하면 카드가 <span className="text-[#969BA6] font-medium">마스터</span>로 굳어요</p>
        </CardContent>
      </Card>

      {/* Big stats */}
      <Card className="animate-up stagger-1">
        <CardContent className="flex items-center px-1.5 py-[18px]">
          {[
            { v: summary.total.toLocaleString(), l: '총 복습', c: summary.total === 0 ? '#5D636F' : '#ECEEF2' },
            { v: mastery.mastered, l: '마스터', c: mastery.mastered === 0 ? '#5D636F' : '#ECEEF2' },
            { v: `${accuracyPct}%`, l: '정답률', c: summary.total === 0 ? '#5D636F' : '#5FA88A' },
          ].map((s, i) => (
            <div key={i} className={`flex-1 text-center ${i > 0 ? 'border-l border-white/[0.08]' : ''}`}>
              <div className="font-num text-[25px] font-semibold leading-none" style={{ color: s.c }}>{s.v}</div>
              <div className="text-[12px] text-[#969BA6] mt-[7px]">{s.l}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Heatmap */}
      <div className="animate-up stagger-2">
        <div className="flex items-baseline justify-between mb-3 px-0.5">
          <span className="text-[13px] font-semibold text-[#969BA6] tracking-[0.02em]">복습 히트맵</span>
          <span className="text-[12px] text-[#5D636F]">최근 20주</span>
        </div>
        <Card>
          <CardContent className="px-4 pt-[18px] pb-3.5">
            <div className="grid gap-[3px]" style={{ gridTemplateRows: 'repeat(7,1fr)', gridTemplateColumns: 'repeat(20,1fr)', gridAutoFlow: 'column' }}>
              {heat.map((n, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-[3px]"
                  style={n === 0
                    ? { background: '#14161B', border: '1px solid rgba(255,255,255,0.05)' }
                    : { background: heatColor(n) }}
                />
              ))}
            </div>
            <div className="flex items-center justify-end gap-1.5 mt-3.5">
              <span className="text-[11px] text-[#5D636F]">적음</span>
              {['#14161B', 'rgba(110,139,201,0.22)', 'rgba(110,139,201,0.42)', 'rgba(110,139,201,0.66)', '#6E8BC9'].map((c, i) => (
                <span key={i} className="w-[11px] h-[11px] rounded-[3px]" style={{ background: c, border: i === 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }} />
              ))}
              <span className="text-[11px] text-[#5D636F]">많음</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily volume */}
      <div className="animate-up stagger-3">
        <div className="flex items-baseline justify-between mb-3 px-0.5">
          <span className="text-[13px] font-semibold text-[#969BA6] tracking-[0.02em]">일별 복습량</span>
          <span className="text-[12px] text-[#5D636F]">최근 30일</span>
        </div>
        <Card>
          <CardContent className="px-4 pt-5 pb-4">
            <div className="flex items-end gap-[5px] h-[118px]">
              {daily.map((v, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-[4px] rounded-b-[2px]"
                  style={{
                    height: `max(8%, ${(v / maxDaily) * 100}%)`,
                    background: 'linear-gradient(180deg,#8AA3E0 0%,#5E78C4 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
