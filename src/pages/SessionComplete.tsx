import { CheckCircle2, Calendar, Target, Clock, Home, RotateCcw } from 'lucide-react';
import ScreenContainer from '@/components/layout/ScreenContainer';
import SectionLabel from '@/components/shared/SectionLabel';
import ActionButton from '@/components/shared/ActionButton';
import { accuracyColor, TIER_COLORS } from '@/lib/tokens';
import type { Tier } from '@/types';
import type { SessionSummary } from '@/hooks/useReviewSession';

const TIER_LABEL: Record<Tier, string> = { foundation: 'Foundation', mechanism: 'Mechanism', diagnosis: 'Diagnosis' };

function formatDuration(s: number): string {
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec > 0 ? `${m}분 ${sec}초` : `${m}분`;
}

interface SessionCompleteProps {
  summary: SessionSummary;
  onRetry: () => void;
  onHome: () => void;
}

export default function SessionComplete({ summary, onRetry, onHome }: SessionCompleteProps) {
  const { accuracy, totalCards, correctCount, duration, tierBreakdown, wrongCards } = summary;
  const acc = accuracyColor(accuracy);
  const dash = 364.4;

  return (
    <ScreenContainer className="px-[22px] pb-10 pt-6 flex flex-col items-center">
      {/* Ring */}
      <div className="relative w-[132px] h-[132px] mt-1.5 animate-scale">
        <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
          <circle cx="66" cy="66" r="58" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
          <circle
            cx="66" cy="66" r="58" fill="none" stroke={acc.hex} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${(accuracy / 100) * dash} ${dash}`}
            style={{ filter: `drop-shadow(0 0 8px ${acc.hex}8c)`, transition: 'stroke-dasharray 1s' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-num text-[34px] font-semibold ${acc.text} tracking-[-0.02em]`}>{accuracy}%</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-6 animate-up stagger-1">
        <CheckCircle2 size={20} style={{ color: acc.hex }} />
        <span className="text-[20px] font-semibold text-[#F4F5F7]">세션 완료</span>
      </div>
      <p className="text-[14px] text-[#969BA6] mt-[7px] animate-up stagger-1">
        <span className="font-num">{totalCards}</span>장 중 <span className="font-num font-semibold" style={{ color: acc.hex }}>{correctCount}</span>장 정답
      </p>

      {/* Next review */}
      <div className="w-full flex items-center gap-3 surface rounded-[16px] p-4 mt-7 animate-up stagger-2">
        <span className="w-9 h-9 rounded-[11px] bg-[#5FB991]/12 flex items-center justify-center shrink-0">
          <Calendar size={18} className="text-[#6FC4A0]" strokeWidth={1.7} />
        </span>
        <div className="flex-1">
          <p className="text-[14.5px] font-medium text-[#ECEEF2]">다음 복습 예정</p>
          <p className="text-[12.5px] text-[#5D636F] mt-0.5">복습한 {totalCards}장이 다시 돌아와요</p>
        </div>
        <div className="text-right">
          <p className="font-num text-[15px] font-semibold text-[#6FC4A0]">내일</p>
          <p className="text-[11.5px] text-[#5D636F] mt-0.5">1일 후</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="w-full flex items-center surface rounded-[18px] py-[18px] px-1.5 mt-4 animate-up stagger-2">
        {[
          { icon: <Target size={17} className="text-[#5D636F]" strokeWidth={1.7} />, v: totalCards, l: '전체', c: '#ECEEF2' },
          { icon: <CheckCircle2 size={17} className="text-[#5FB991]" strokeWidth={1.7} />, v: correctCount, l: '정답', c: '#6FC4A0' },
          { icon: <Clock size={17} className="text-[#5D636F]" strokeWidth={1.7} />, v: formatDuration(duration), l: '소요', c: '#ECEEF2' },
        ].map((s, i) => (
          <div key={i} className={`flex-1 flex flex-col items-center gap-2 ${i > 0 ? 'border-l border-white/[0.08]' : ''}`}>
            {s.icon}
            <span className="font-num text-[22px] font-semibold leading-none" style={{ color: s.c }}>{s.v}</span>
            <span className="text-[12px] text-[#969BA6]">{s.l}</span>
          </div>
        ))}
      </div>

      {/* Tier results */}
      {tierBreakdown.length > 0 && (
        <div className="w-full mt-6 animate-up stagger-3">
          <SectionLabel upper>티어별 결과</SectionLabel>
          <div className="surface rounded-[18px] p-[18px] space-y-4">
            {tierBreakdown.map((t) => (
              <div key={t.tier}>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <span className="w-[7px] h-[7px] rounded-full" style={{ background: TIER_COLORS[t.tier] }} />
                  <span className="text-[14px] font-medium text-[#ECEEF2] flex-1">{TIER_LABEL[t.tier]}</span>
                  <span className="font-num text-[12.5px] text-[#5D636F]">{t.correct}/{t.total}</span>
                  <span className="font-num text-[13px] font-semibold" style={{ color: accuracyColor(t.accuracy).hex }}>{t.accuracy}%</span>
                </div>
                <div className="h-[5px] rounded-full bg-[#0D0F14] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${t.accuracy}%`, background: TIER_COLORS[t.tier] }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="w-full mt-6 space-y-2.5 animate-up stagger-4">
        {wrongCards.length > 0 && (
          <ActionButton variant="secondary" icon={<RotateCcw size={18} className="text-[#E9A94C]" />} onClick={onRetry}>
            틀린 카드 재복습 ({wrongCards.length}장)
          </ActionButton>
        )}
        <ActionButton variant="primary" icon={<Home size={18} />} onClick={onHome}>홈으로</ActionButton>
      </div>
    </ScreenContainer>
  );
}
