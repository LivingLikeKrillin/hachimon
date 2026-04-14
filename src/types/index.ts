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
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: string;
  lastReviewedAt: string | null;
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

export type Screen = 'tabs' | 'interview' | 'review' | 'complete';
