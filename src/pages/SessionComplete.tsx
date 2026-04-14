import { CheckCircle, RotateCcw, Home, Clock, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import SectionLabel from '@/components/shared/SectionLabel';
import TierBadge from '@/components/shared/TierBadge';
import type { SessionSummary } from '@/hooks/useReviewSession';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec > 0 ? `${min}분 ${sec}초` : `${min}분`;
}

interface SessionCompleteProps {
  summary: SessionSummary;
  onRetry: () => void;
  onHome: () => void;
}

export default function SessionComplete({ summary, onRetry, onHome }: SessionCompleteProps) {
  const { accuracy, totalCards, correctCount, duration, tierBreakdown, wrongCards } = summary;

  const accuracyColor = accuracy >= 80 ? 'text-emerald-400' : accuracy >= 60 ? 'text-amber-400' : 'text-red-400';
  const ringColor = accuracy >= 80 ? '#34d399' : accuracy >= 60 ? '#fbbf24' : '#f87171';

  return (
    <div className="w-full max-w-[393px] mx-auto min-h-svh px-4 pb-24 pt-safe">
      {/* Result header */}
      <div className="text-center pt-8 pb-6 animate-up">
        {/* Accuracy ring */}
        <div className="relative w-28 h-28 mx-auto mb-4">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#27272a" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              stroke={ringColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${accuracy * 2.64} ${264 - accuracy * 2.64}`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`font-display text-[28px] font-bold ${accuracyColor}`}>
              {accuracy}%
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mb-1">
          <CheckCircle size={18} className={accuracyColor} />
          <p className="text-[18px] font-semibold text-zinc-100">세션 완료</p>
        </div>
        <p className="text-[13px] text-zinc-500">
          {totalCards}장 중 {correctCount}장 정답
        </p>
      </div>

      {/* Quick stats */}
      <Card className="animate-up stagger-1">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 divide-x divide-zinc-800/50">
            <div className="text-center px-2">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Target size={14} className="text-zinc-500" />
              </div>
              <p className="font-display text-[18px] font-bold text-zinc-100">{totalCards}</p>
              <p className="text-[11px] text-zinc-500">전체</p>
            </div>
            <div className="text-center px-2">
              <div className="flex items-center justify-center gap-1 mb-1">
                <CheckCircle size={14} className="text-emerald-400" />
              </div>
              <p className="font-display text-[18px] font-bold text-emerald-400">{correctCount}</p>
              <p className="text-[11px] text-zinc-500">정답</p>
            </div>
            <div className="text-center px-2">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Clock size={14} className="text-zinc-500" />
              </div>
              <p className="font-display text-[18px] font-bold text-zinc-100">{formatDuration(duration)}</p>
              <p className="text-[11px] text-zinc-500">소요</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tier breakdown */}
      {tierBreakdown.length > 0 && (
        <div className="mt-4 animate-up stagger-2">
          <SectionLabel>티어별 결과</SectionLabel>
          <Card>
            <CardContent className="p-4 space-y-3">
              {tierBreakdown.map((t) => (
                <div key={t.tier} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TierBadge tier={t.tier} full />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-zinc-500">
                      {t.correct}/{t.total}
                    </span>
                    <span className={`font-display text-[14px] font-bold tabular-nums ${
                      t.accuracy >= 80 ? 'text-emerald-400' : t.accuracy >= 60 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {t.accuracy}%
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Wrong cards */}
      {wrongCards.length > 0 && (
        <div className="mt-4 animate-up stagger-3">
          <SectionLabel>틀린 카드 ({wrongCards.length})</SectionLabel>
          <Card>
            <CardContent className="p-0">
              {wrongCards.map((card, i) => (
                <div
                  key={card.cardId}
                  className={`px-4 py-3 ${i < wrongCards.length - 1 ? 'border-b border-zinc-800/50' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <TierBadge tier={card.tier} />
                    <p className="text-[13px] text-zinc-300 leading-relaxed">{card.question}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-6 space-y-2.5 animate-up stagger-4">
        {wrongCards.length > 0 && (
          <button
            onClick={onRetry}
            className="w-full h-[48px] rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2.5 bg-gradient-to-r from-amber-600 to-amber-500 text-white transition-all duration-150 active:scale-[0.96]"
          >
            <RotateCcw size={18} />
            틀린 카드 재복습 ({wrongCards.length}장)
          </button>
        )}
        <button
          onClick={onHome}
          className="w-full h-[48px] rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2.5 bg-zinc-900 border border-zinc-800 text-zinc-200 transition-all duration-150 active:scale-[0.96] active:bg-zinc-800"
        >
          <Home size={18} />
          홈으로
        </button>
      </div>
    </div>
  );
}
