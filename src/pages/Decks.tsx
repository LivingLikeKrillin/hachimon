import { useState } from 'react';
import { ChevronRight, Folder, CreditCard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import PageLayout from '@/components/layout/PageLayout';
import SectionLabel from '@/components/shared/SectionLabel';
import TierBadge from '@/components/shared/TierBadge';

interface DeckItem {
  name: string;
  count: number;
  mastered: number;
}

interface DeckGroup {
  id: string;
  label: string;
  gate: string;
  decks: DeckItem[];
}

const groups: DeckGroup[] = [
  {
    id: 'spring', label: 'Spring', gate: 'var(--gate-1)',
    decks: [
      { name: 'Core', count: 87, mastered: 52 },
      { name: 'Batch', count: 43, mastered: 28 },
      { name: 'Security', count: 65, mastered: 31 },
      { name: 'Data', count: 51, mastered: 40 },
    ],
  },
  {
    id: 'jpa', label: 'JPA', gate: 'var(--gate-5)',
    decks: [
      { name: 'Core', count: 92, mastered: 55 },
      { name: 'QueryDSL', count: 38, mastered: 20 },
    ],
  },
  {
    id: 'java', label: 'Java', gate: 'var(--gate-7)',
    decks: [
      { name: 'Concurrency', count: 78, mastered: 45 },
      { name: 'Stream', count: 44, mastered: 30 },
      { name: 'GC', count: 36, mastered: 18 },
    ],
  },
  {
    id: 'k8s', label: 'Kubernetes', gate: 'var(--gate-3)',
    decks: [
      { name: 'Core', count: 56, mastered: 32 },
      { name: 'Networking', count: 41, mastered: 22 },
    ],
  },
  {
    id: 'db', label: 'Database', gate: 'var(--gate-6)',
    decks: [
      { name: 'MySQL', count: 68, mastered: 42 },
      { name: 'Redis', count: 34, mastered: 19 },
    ],
  },
  {
    id: 'aws', label: 'AWS', gate: 'var(--gate-2)',
    decks: [
      { name: 'Core', count: 45, mastered: 25 },
      { name: 'Lambda', count: 29, mastered: 14 },
    ],
  },
];

export default function Decks() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['spring']));
  const [selectedDeck, setSelectedDeck] = useState<{ group: DeckGroup; deck: DeckItem } | null>(null);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalDecks = groups.reduce((sum, g) => sum + g.decks.length, 0);
  const totalCards = groups.reduce((sum, g) => sum + g.decks.reduce((s, d) => s + d.count, 0), 0);

  return (
    <PageLayout>
      {/* Summary */}
      <div className="flex items-center justify-between animate-up">
        <div>
          <p className="text-[13px] text-zinc-400">{totalDecks}개 덱</p>
          <p className="text-[12px] text-zinc-500">{totalCards.toLocaleString()}장 카드</p>
        </div>
      </div>

      {/* Deck tree */}
      <div className="space-y-2 animate-up stagger-1">
        <SectionLabel>덱 목록</SectionLabel>
        <Card>
          <CardContent className="p-0">
            {groups.map((group, gi) => (
              <div key={group.id}>
                {/* Group header */}
                <button
                  onClick={() => toggle(group.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-800/30 ${
                    gi > 0 ? 'border-t border-zinc-800/50' : ''
                  }`}
                >
                  <span className="w-1.5 h-6 rounded-full" style={{ background: group.gate }} />
                  <Folder size={16} className="text-zinc-500" />
                  <span className="text-[14px] font-semibold flex-1 text-left text-zinc-200">{group.label}</span>
                  <span className="text-[12px] text-zinc-500 tabular-nums mr-1">
                    {group.decks.reduce((s, d) => s + d.count, 0)}
                  </span>
                  <ChevronRight
                    size={14}
                    className={`text-zinc-500 transition-transform duration-200 ${expanded.has(group.id) ? 'rotate-90' : ''}`}
                  />
                </button>

                {/* Deck items */}
                {expanded.has(group.id) && (
                  <div className="animate-expand">
                    {group.decks.map((deck) => (
                      <button
                        key={deck.name}
                        onClick={() => setSelectedDeck({ group, deck })}
                        className="w-full flex items-center gap-3 pl-10 pr-4 py-2.5 transition-colors hover:bg-zinc-800/30 border-t border-zinc-800/30"
                      >
                        <CreditCard size={14} className="text-zinc-600" />
                        <span className="text-[13px] text-zinc-300 flex-1 text-left">{deck.name}</span>
                        <span className="text-[12px] text-zinc-500 tabular-nums">{deck.count}장</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Bottom sheet (deck detail) */}
      {selectedDeck && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center animate-overlay"
          onClick={() => setSelectedDeck(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-[393px] bg-zinc-900 rounded-t-2xl p-5 space-y-4 animate-sheet border-t border-zinc-700/30"
            style={{ boxShadow: '0 -8px 40px rgba(0, 0, 0, 0.4)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="w-10 h-1 rounded-full bg-zinc-700 mx-auto" />

            <div className="flex items-center gap-3">
              <span
                className="w-2 h-8 rounded-full"
                style={{ background: selectedDeck.group.gate }}
              />
              <div>
                <p className="font-display text-[16px] font-semibold">
                  {selectedDeck.group.label} — {selectedDeck.deck.name}
                </p>
                <p className="text-[12px] text-zinc-500">
                  {selectedDeck.deck.count}장 · {selectedDeck.deck.mastered}장 마스터
                </p>
              </div>
            </div>

            {/* Tier breakdown (mock) */}
            <div className="flex gap-2">
              <TierBadge tier="foundation" full />
              <TierBadge tier="mechanism" full />
              <TierBadge tier="diagnosis" full />
            </div>

            {/* Sample cards preview */}
            <div className="space-y-2">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider">미리보기</p>
              {['트랜잭션 전파 레벨의 종류는?', 'REQUIRES_NEW와 NESTED의 차이점은?'].map((q) => (
                <div key={q} className="p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/40">
                  <p className="text-[13px] text-zinc-300">{q}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setSelectedDeck(null)}
              className="w-full h-11 rounded-xl bg-zinc-800 text-[14px] font-medium text-zinc-300 active:scale-[0.97] transition-transform"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
