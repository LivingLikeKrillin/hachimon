import { useState, useCallback } from 'react';
import type { Tab, Screen, Card, Schedule } from '@/types';
import { useCards } from '@/hooks/useCards';
import { getDueCards } from '@/lib/data';
import type { SessionSummary } from '@/hooks/useReviewSession';
import TabBar from '@/components/layout/TabBar';
import ScreenContainer from '@/components/layout/ScreenContainer';
import Home from '@/pages/Home';
import Decks from '@/pages/Decks';
import Stats from '@/pages/Stats';
import Settings from '@/pages/Settings';
import ReviewSession from '@/pages/ReviewSession';
import Forge from '@/pages/Forge';
import SessionComplete from '@/pages/SessionComplete';

export default function App() {
  const { loading, error } = useCards();
  const [tab, setTab] = useState<Tab>('home');
  const [screen, setScreen] = useState<Screen>('tabs');
  const [sessionCards, setSessionCards] = useState<(Card & { schedule: Schedule })[]>([]);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);

  // 시작 시점에 due 카드를 새로 조회 — 초기화 race를 피한다
  const startReview = useCallback(async () => {
    const fresh = await getDueCards(15);
    setSessionCards(fresh);
    setScreen('review');
  }, []);

  const handleComplete = useCallback((summary: SessionSummary) => {
    setSessionSummary(summary);
    setScreen('complete');
  }, []);

  const handleRetry = useCallback(async () => {
    if (!sessionSummary) return;
    // Reload wrong cards from IndexedDB with fresh schedules
    const { getDueCards: fetchDue } = await import('@/lib/data');
    const freshCards = await fetchDue(200);
    const wrongIds = new Set(sessionSummary.wrongCards.map((c) => c.cardId));
    const retryCards = freshCards.filter((c) => wrongIds.has(c.id));
    setSessionCards(retryCards);
    setSessionSummary(null);
    setScreen('review');
  }, [sessionSummary]);

  const goHome = useCallback(() => {
    setScreen('tabs');
    setTab('home');
    setSessionCards([]);
    setSessionSummary(null);
  }, []);

  const startDeckReview = useCallback(async (deckId: string) => {
    const allDue = await getDueCards(200);
    const deckCards = allDue.filter((c) => c.deck === deckId);
    if (deckCards.length === 0) return;
    setSessionCards(deckCards);
    setScreen('review');
  }, []);

  const handleNavigate = useCallback((s: Screen) => {
    if (s === 'review') {
      startReview();
    } else {
      setScreen(s);
    }
  }, [startReview]);

  if (loading) {
    return (
      <ScreenContainer className="flex items-center justify-center">
        <div className="text-center space-y-3">
          <img src="/logo.png" alt="Hachimon" className="w-16 h-16 rounded-2xl mx-auto animate-pulse" />
          <p className="text-[14px] text-zinc-400">카드 불러오는 중...</p>
        </div>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer className="flex items-center justify-center px-4">
        <div className="text-center space-y-2">
          <p className="text-[16px] font-semibold text-red-400">로딩 실패</p>
          <p className="text-[13px] text-zinc-400">{error}</p>
        </div>
      </ScreenContainer>
    );
  }

  if (screen === 'review') {
    return (
      <ReviewSession
        cards={sessionCards}
        onComplete={handleComplete}
        onExit={goHome}
      />
    );
  }

  if (screen === 'complete' && sessionSummary) {
    return (
      <SessionComplete
        summary={sessionSummary}
        onRetry={handleRetry}
        onHome={goHome}
      />
    );
  }

  if (screen === 'forge') {
    return <Forge />;
  }

  const pages: Record<Tab, React.ReactNode> = {
    home: <Home onNavigate={handleNavigate} onStartDeckReview={startDeckReview} />,
    decks: <Decks />,
    stats: <Stats />,
    settings: <Settings />,
  };

  return (
    <>
      <div key={tab} className="animate-tab-in">
        {pages[tab]}
      </div>
      <TabBar active={tab} onChange={setTab} />
    </>
  );
}
