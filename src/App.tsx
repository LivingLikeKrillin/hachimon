import { useState } from 'react';
import type { Tab, Screen } from '@/types';
import TabBar from '@/components/layout/TabBar';
import Home from '@/pages/Home';
import Decks from '@/pages/Decks';
import Stats from '@/pages/Stats';
import Settings from '@/pages/Settings';
import ReviewSession from '@/pages/ReviewSession';
import InterviewFilter from '@/pages/InterviewFilter';
import SessionComplete from '@/pages/SessionComplete';

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [screen, setScreen] = useState<Screen>('tabs');

  if (screen === 'review') {
    return <ReviewSession />;
  }
  if (screen === 'interview') {
    return <InterviewFilter />;
  }
  if (screen === 'complete') {
    return <SessionComplete />;
  }

  const pages: Record<Tab, React.ReactNode> = {
    home: <Home />,
    decks: <Decks />,
    stats: <Stats />,
    settings: <Settings />,
  };

  // suppress unused warning — will be wired up in feature implementation
  void setScreen;

  return (
    <>
      {pages[tab]}
      <TabBar active={tab} onChange={setTab} />
    </>
  );
}
