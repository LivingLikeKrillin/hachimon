import { X } from 'lucide-react';
import Markdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import type { Quality, Card, Schedule } from '@/types';
import TierBadge from '@/components/shared/TierBadge';
import { useReviewSession } from '@/hooks/useReviewSession';
import type { SessionSummary } from '@/hooks/useReviewSession';

const RATING_BUTTONS: { quality: Quality; label: string; bg: string; text: string }[] = [
  { quality: 0, label: '모름', bg: '#7f1d1d', text: '#fca5a5' },
  { quality: 2, label: '어려움', bg: '#78350f', text: '#fde68a' },
  { quality: 4, label: '알겠음', bg: '#1e3a5f', text: '#93c5fd' },
  { quality: 5, label: '쉬움', bg: '#064e3b', text: '#6ee7b7' },
];

interface ReviewSessionProps {
  cards: (Card & { schedule: Schedule })[];
  onComplete: (summary: SessionSummary) => void;
  onExit: () => void;
}

export default function ReviewSession({ cards, onComplete, onExit }: ReviewSessionProps) {
  const {
    currentCard,
    currentIndex,
    totalCards,
    progress,
    flipped,
    finished,
    flip,
    rate,
    getSummary,
    getNextInterval,
  } = useReviewSession(cards);

  if (finished) {
    const summary = getSummary();
    onComplete(summary);
    return null;
  }

  if (!currentCard) {
    return (
      <div className="w-full max-w-[393px] mx-auto min-h-svh flex items-center justify-center px-4">
        <div className="text-center space-y-2">
          <p className="text-[16px] font-semibold text-zinc-300">복습할 카드가 없습니다</p>
          <button onClick={onExit} className="text-[14px] text-blue-400">홈으로 돌아가기</button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[393px] mx-auto min-h-svh flex flex-col pt-safe">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <button onClick={onExit} className="w-10 h-10 flex items-center justify-center text-zinc-500 active:text-zinc-300">
          <X size={20} />
        </button>
        <span className="font-display text-[14px] font-semibold tabular-nums text-zinc-400">
          {currentIndex + 1} / {totalCards}
        </span>
        <div className="w-10" />
      </div>

      {/* Progress bar */}
      <div className="px-4 mb-4">
        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-1 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* Card area */}
      <div className="flex-1 px-4 pb-4">
        <div
          onClick={!flipped ? flip : undefined}
          className={`h-full rounded-2xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col ${
            !flipped ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''
          }`}
        >
          {/* Tier badge */}
          <div className="mb-4">
            <TierBadge tier={currentCard.tier} full />
          </div>

          {/* Question */}
          <div className="mb-4">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">질문</p>
            <p className="text-[16px] text-zinc-100 leading-relaxed font-medium">
              {currentCard.question}
            </p>
          </div>

          {/* Answer (revealed on flip) */}
          {flipped ? (
            <div className="flex-1 animate-up">
              <div className="border-t border-zinc-800 pt-4">
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">답변</p>
                <div className="prose-hachimon text-[14px] text-zinc-300 leading-relaxed">
                  <Markdown rehypePlugins={[rehypeHighlight]}>{currentCard.answer}</Markdown>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[13px] text-zinc-600">탭하여 답변 확인</p>
            </div>
          )}
        </div>
      </div>

      {/* Rating buttons (visible after flip) */}
      {flipped && (
        <div className="px-4 pb-6 pt-2 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent animate-up">
          <div className="grid grid-cols-4 gap-2">
            {RATING_BUTTONS.map(({ quality, label, bg, text }) => (
              <button
                key={quality}
                onClick={() => rate(quality)}
                className="min-h-[60px] rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-150 active:scale-[0.94] active:brightness-125"
                style={{ background: bg }}
              >
                <span className="text-[13px] font-semibold" style={{ color: text }}>{label}</span>
                <span className="text-[10px] opacity-70" style={{ color: text }}>{getNextInterval(quality)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
