import { useState, useEffect } from 'react';
import { ChevronRight, Folder, CreditCard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Card as CardType } from '@/types';
import PageLayout from '@/components/layout/PageLayout';
import SectionLabel from '@/components/shared/SectionLabel';
import TierBadge from '@/components/shared/TierBadge';
import { getAllCardsByDeck } from '@/lib/data';

const GATE_COLORS: Record<string, string> = {
  spring: 'var(--gate-1)',
  jpa: 'var(--gate-5)',
  java: 'var(--gate-7)',
  k8s: 'var(--gate-3)',
  db: 'var(--gate-6)',
  aws: 'var(--gate-2)',
};

interface DeckGroup {
  id: string;
  label: string;
  gate: string;
  decks: { id: string; name: string; cards: CardType[] }[];
}

function buildGroups(cardsByDeck: Map<string, CardType[]>): DeckGroup[] {
  const groupMap = new Map<string, DeckGroup>();

  for (const [deckId, cards] of cardsByDeck) {
    const parts = deckId.split('/');
    const groupKey = parts[1] || parts[0];
    const deckName = parts[parts.length - 1] || deckId;

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        id: groupKey,
        label: groupKey.charAt(0).toUpperCase() + groupKey.slice(1),
        gate: GATE_COLORS[groupKey] || 'var(--gate-1)',
        decks: [],
      });
    }

    groupMap.get(groupKey)!.decks.push({
      id: deckId,
      name: deckName.charAt(0).toUpperCase() + deckName.slice(1),
      cards,
    });
  }

  return Array.from(groupMap.values());
}

export default function Decks() {
  const [groups, setGroups] = useState<DeckGroup[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedDeck, setSelectedDeck] = useState<{ group: DeckGroup; deck: DeckGroup['decks'][0] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllCardsByDeck().then((map) => {
      const built = buildGroups(map);
      setGroups(built);
      if (built.length > 0) {
        setExpanded(new Set([built[0].id]));
      }
      setLoading(false);
    });
  }, []);

  if (loading) return <PageLayout><div /></PageLayout>;

  const totalDecks = groups.reduce((sum, g) => sum + g.decks.length, 0);
  const totalCards = groups.reduce((sum, g) => sum + g.decks.reduce((s, d) => s + d.cards.length, 0), 0);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

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
                    {group.decks.reduce((s, d) => s + d.cards.length, 0)}
                  </span>
                  <ChevronRight
                    size={14}
                    className={`text-zinc-500 transition-transform duration-200 ${expanded.has(group.id) ? 'rotate-90' : ''}`}
                  />
                </button>

                {expanded.has(group.id) && (
                  <div className="animate-expand">
                    {group.decks.map((deck) => (
                      <button
                        key={deck.id}
                        onClick={() => setSelectedDeck({ group, deck })}
                        className="w-full flex items-center gap-3 pl-10 pr-4 py-2.5 transition-colors hover:bg-zinc-800/30 border-t border-zinc-800/30"
                      >
                        <CreditCard size={14} className="text-zinc-600" />
                        <span className="text-[13px] text-zinc-300 flex-1 text-left">{deck.name}</span>
                        <span className="text-[12px] text-zinc-500 tabular-nums">{deck.cards.length}장</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Bottom sheet */}
      {selectedDeck && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center animate-overlay"
          onClick={() => setSelectedDeck(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-[393px] max-h-[80svh] overflow-y-auto bg-zinc-900 rounded-t-2xl p-5 space-y-4 animate-sheet border-t border-zinc-700/30"
            style={{ boxShadow: '0 -8px 40px rgba(0, 0, 0, 0.4)' }}
            onClick={(e) => e.stopPropagation()}
          >
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
                  {selectedDeck.deck.cards.length}장
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              {(['foundation', 'mechanism', 'diagnosis'] as const).map((tier) => {
                const count = selectedDeck.deck.cards.filter((c) => c.tier === tier).length;
                return count > 0 ? <TierBadge key={tier} tier={tier} full /> : null;
              })}
            </div>

            <div className="space-y-2">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider">미리보기</p>
              {selectedDeck.deck.cards.slice(0, 2).map((card) => (
                <div key={card.id} className="p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/40">
                  <p className="text-[13px] text-zinc-300">{card.question}</p>
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
