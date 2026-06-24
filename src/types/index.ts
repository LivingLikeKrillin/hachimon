export type Tier = 'foundation' | 'mechanism' | 'diagnosis';

export interface Card {
  id: string;
  deck: string;
  tier: Tier;
  question: string;
  answer: string;
  sourceFile: string;
  sourceHash: string;
}

export interface Deck {
  id: string;
  name: string;
  path: string[];
  cardCount: number;
}

export interface CardsData {
  version: string;
  decks: Deck[];
  cards: Card[];
}

export interface Schedule {
  cardId: string;
  stability: number;
  difficulty: number;
  state: number;           // 0 New · 1 Learning · 2 Review · 3 Relearning
  reps: number;
  lapses: number;
  elapsedDays: number;
  scheduledDays: number;
  nextReviewAt: string;    // = FSRS due (ISO)
  lastReviewedAt: string | null; // = FSRS last_review (ISO), New이면 null
}

export interface ReviewLog {
  id?: number;
  cardId: string;
  quality: number;
  reviewedAt: string;
  sessionId: string;
}

export type Quality = 0 | 2 | 4 | 5; // Again | Hard | Good | Easy

export type Tab = 'home' | 'decks' | 'stats' | 'settings';

export type Screen = 'tabs' | 'forge' | 'review' | 'complete';
