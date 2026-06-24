import { useRef, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Markdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import { imageUrlTransform } from '@/lib/markdown';
import type { Quality, Card, Schedule } from '@/types';
import TierBadge from '@/components/shared/TierBadge';
import SectionLabel from '@/components/shared/SectionLabel';
import ScreenContainer from '@/components/layout/ScreenContainer';
import { useReviewSession } from '@/hooks/useReviewSession';
import type { SessionSummary } from '@/hooks/useReviewSession';
import { resolveSwipe } from '@/lib/gesture';

const RATING: { quality: Quality; label: string; bg: string; border: string; text: string; sub: string }[] = [
  { quality: 0, label: '모름', bg: 'rgba(205,116,108,0.13)', border: 'rgba(205,116,108,0.30)', text: '#DD8C85', sub: '#7E5450' },
  { quality: 2, label: '어려움', bg: 'rgba(207,162,78,0.13)', border: 'rgba(207,162,78,0.30)', text: '#DDB868', sub: '#806832' },
  { quality: 4, label: '알겠음', bg: 'rgba(110,139,201,0.13)', border: 'rgba(110,139,201,0.30)', text: '#93A8DC', sub: '#525F7E' },
  { quality: 5, label: '쉬움', bg: 'rgba(95,168,138,0.14)', border: 'rgba(95,168,138,0.30)', text: '#6FBE9C', sub: '#43705C' },
];

interface ReviewSessionProps {
  cards: (Card & { schedule: Schedule })[];
  onComplete: (summary: SessionSummary) => void;
  onExit: () => void;
}

export default function ReviewSession({ cards, onComplete, onExit }: ReviewSessionProps) {
  const { currentCard, currentIndex, totalCards, progress, flipped, finished, flip, rate, getSummary, getNextInterval } =
    useReviewSession(cards);

  // 스와이프: 답변 공개(flipped) 상태에서 좌→모름(0), 우→쉬움(5)
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [dragX, setDragX] = useState(0);
  const swipeHint = flipped && Math.abs(dragX) >= 60 ? (dragX > 0 ? 'right' : 'left') : null;

  const onTouchStart = (e: React.TouchEvent) => {
    if (!flipped) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!flipped || !touchStart.current) return;
    setDragX(e.touches[0].clientX - touchStart.current.x);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!flipped || !touchStart.current) return;
    const t = e.changedTouches[0];
    const dir = resolveSwipe(t.clientX - touchStart.current.x, t.clientY - touchStart.current.y);
    touchStart.current = null;
    setDragX(0);
    if (dir === 'left') rate(0);
    else if (dir === 'right') rate(5);
  };

  // 세션 종료 시 부모로 결과 전달 — 렌더 중이 아닌 커밋 후(useEffect)에 호출해야
  // "다른 컴포넌트 렌더 중 setState" 경고를 피한다.
  useEffect(() => {
    if (finished) onComplete(getSummary());
  }, [finished, onComplete, getSummary]);

  if (finished) {
    return null;
  }

  if (!currentCard) {
    return (
      <ScreenContainer className="flex items-center justify-center px-5">
        <div className="text-center space-y-2">
          <p className="text-[16px] font-semibold text-[#C7CCD4]">복습할 카드가 없습니다</p>
          <button onClick={onExit} className="text-[14px] text-[#E9A94C]">홈으로 돌아가기</button>
        </div>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex flex-col">
      {/* Header */}
      <div className="px-[22px] pt-3 pb-3.5">
        <div className="flex items-center justify-between">
          <button onClick={onExit} className="w-9 h-9 rounded-[10px] bg-[#181B21] border border-white/[0.08] flex items-center justify-center active:bg-[#1E222A]">
            <X size={17} className="text-[#969BA6]" strokeWidth={2} />
          </button>
          <span className="font-num text-[15px] font-semibold text-[#ECEEF2] tracking-[0.02em]">
            {currentIndex + 1} <span className="text-[#5D636F]">/ {totalCards}</span>
          </span>
          <div className="w-9" />
        </div>
        <div className="h-1 rounded-full bg-[#15171D] mt-3.5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#E09A3C] to-[#F2BC68] shadow-[0_0_8px_rgba(233,169,76,0.6)] transition-[width] duration-300"
            style={{ width: `${Math.max(progress * 100, 6)}%` }}
          />
        </div>
      </div>

      {/* Card area */}
      <div className="flex-1 px-[22px] pb-4">
        <div
          onClick={!flipped ? flip : undefined}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{
            transform: dragX ? `translateX(${dragX}px) rotate(${dragX * 0.018}deg)` : undefined,
            transition: dragX ? 'none' : 'transform 0.22s ease',
            borderColor:
              swipeHint === 'left'
                ? 'rgba(205,116,108,0.5)'
                : swipeHint === 'right'
                  ? 'rgba(95,168,138,0.5)'
                  : undefined,
          }}
          className={`relative h-full rounded-[20px] bg-[#15171D] border border-white/[0.07] p-[22px] flex flex-col shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_30px_-12px_rgba(0,0,0,0.5)] ${
            !flipped ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''
          }`}
        >
          {swipeHint === 'left' && (
            <span className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-[12px] font-semibold bg-[rgba(205,116,108,0.18)] text-[#DD8C85] border border-[rgba(205,116,108,0.4)]">
              모름
            </span>
          )}
          {swipeHint === 'right' && (
            <span className="absolute top-4 left-4 px-2.5 py-1 rounded-full text-[12px] font-semibold bg-[rgba(95,168,138,0.18)] text-[#6FBE9C] border border-[rgba(95,168,138,0.4)]">
              쉬움
            </span>
          )}
          <div className="mb-5"><TierBadge tier={currentCard.tier} full /></div>

          <SectionLabel tight upper>질문</SectionLabel>
          <p className="text-[21px] font-semibold leading-[1.4] text-[#F4F5F7] tracking-[-0.01em]">{currentCard.question}</p>

          {flipped ? (
            <div className="flex-1 animate-up">
              <div className="h-px bg-white/[0.07] my-5" />
              <SectionLabel tight upper>답변</SectionLabel>
              <div className="prose-hachimon text-[15.5px] leading-[1.62] text-[#C7CCD4]">
                <Markdown
                  rehypePlugins={[rehypeHighlight]}
                  urlTransform={imageUrlTransform}
                  components={{
                    img: ({ node, ...props }) => {
                      void node;
                      return <img {...props} className="max-w-full rounded-md my-2" />;
                    },
                  }}
                >
                  {currentCard.answer}
                </Markdown>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[13px] text-[#5D636F]">탭하여 답변 확인</p>
            </div>
          )}
        </div>
      </div>

      {/* Rating */}
      {flipped && (
        <div className="px-[22px] pb-7 pt-3 bg-gradient-to-t from-[#0C0D11] via-[#0C0D11]/95 to-transparent animate-up">
          <div className="grid grid-cols-4 gap-[9px]">
            {RATING.map(({ quality, label, bg, border, text, sub }) => (
              <button
                key={quality}
                onClick={() => rate(quality)}
                className="h-[68px] rounded-[14px] flex flex-col items-center justify-center gap-[3px] transition-transform active:scale-[0.95]"
                style={{ background: bg, border: `1px solid ${border}` }}
              >
                <span className="text-[15px] font-semibold" style={{ color: text }}>{label}</span>
                <span className="font-num text-[11.5px]" style={{ color: sub }}>{getNextInterval(quality)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </ScreenContainer>
  );
}
