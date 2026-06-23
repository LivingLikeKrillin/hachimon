import { useState, useCallback } from 'react';
import type { Tab, Screen, Card, Schedule } from '@/types';
import { useCards } from '@/hooks/useCards';
import { getDueCards, getCardsByIds } from '@/lib/data';
import type { SessionSummary } from '@/hooks/useReviewSession';
import TabBar from '@/components/layout/TabBar';
import ScreenContainer from '@/components/layout/ScreenContainer';
import { ToriiMark } from '@/components/layout/PageLayout';
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

  // 단련(Forge) — 필터로 고른 카드로 세션 시작
  const startForge = useCallback((cards: (Card & { schedule: Schedule })[]) => {
    setSessionCards(cards);
    setScreen('review');
  }, []);

  const handleComplete = useCallback((summary: SessionSummary) => {
    setSessionSummary(summary);
    setScreen('complete');
  }, []);

  const handleRetry = useCallback(async () => {
    if (!sessionSummary) return;
    // 틀린 카드를 ID로 직접 조회 — 방금 평가돼 due가 아니어도 다시 꺼낸다
    const wrongIds = sessionSummary.wrongCards.map((c) => c.cardId);
    const retryCards = await getCardsByIds(wrongIds);
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
        <div className="text-center space-y-4">
          <div className="flex justify-center animate-pulse"><ToriiMark size={60} /></div>
          <p className="text-[14px] text-[#969BA6]">카드 불러오는 중...</p>
        </div>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer className="flex items-center justify-center px-4">
        <div className="text-center space-y-2">
          <p className="text-[16px] font-semibold text-[#DD8C85]">로딩 실패</p>
          <p className="text-[13px] text-[#969BA6]">{error}</p>
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
    return <Forge onStart={startForge} onExit={goHome} />;
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
