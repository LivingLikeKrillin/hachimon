import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Folder, CreditCard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Card as CardType } from '@/types';
import PageLayout from '@/components/layout/PageLayout';
import SectionLabel from '@/components/shared/SectionLabel';
import TierBadge from '@/components/shared/TierBadge';
import ActionButton from '@/components/shared/ActionButton';
import { getAllCardsByDeck, getDeckMastery, type MasteryStats } from '@/lib/data';

interface DeckItem {
  id: string;
  name: string;
  cards: CardType[];
}
interface DeckGroup {
  id: string;
  label: string;
  decks: DeckItem[];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function buildGroups(map: Map<string, CardType[]>): DeckGroup[] {
  const groupMap = new Map<string, DeckGroup>();
  for (const [deckId, cards] of map) {
    const parts = deckId.split('/');
    const groupKey = parts[1] || parts[0];
    const deckName = parts[parts.length - 1] || deckId;
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, { id: groupKey, label: cap(groupKey), decks: [] });
    }
    groupMap.get(groupKey)!.decks.push({ id: deckId, name: cap(deckName), cards });
  }
  return Array.from(groupMap.values());
}

export default function Decks() {
  const [groups, setGroups] = useState<DeckGroup[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedDeck, setSelectedDeck] = useState<{ group: DeckGroup; deck: DeckItem } | null>(null);
  const [mastery, setMastery] = useState<Map<string, MasteryStats>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAllCardsByDeck(), getDeckMastery()]).then(([map, m]) => {
      const built = buildGroups(map);
      setGroups(built);
      setMastery(m);
      if (built.length > 0) setExpanded(new Set([built[0].id]));
      setLoading(false);
    });
  }, []);

  if (loading) return <PageLayout><div /></PageLayout>;

  const dm = (deck: DeckItem): MasteryStats => mastery.get(deck.id) ?? { mastered: 0, total: deck.cards.length };
  const gm = (g: DeckGroup) =>
    g.decks.reduce((a, d) => { const m = dm(d); return { mastered: a.mastered + m.mastered, total: a.total + m.total }; }, { mastered: 0, total: 0 });

  const totalDecks = groups.reduce((s, g) => s + g.decks.length, 0);
  const totalCards = groups.reduce((s, g) => s + g.decks.reduce((x, d) => x + d.cards.length, 0), 0);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const Frac = ({ m, dim }: { m: MasteryStats; dim?: boolean }) => (
    <span className="font-num text-[14px] text-[#5D636F]">
      <span className={dim ? 'text-[#969BA6]' : 'text-[#C7CCD4]'}>{m.mastered}</span> / {m.total}
    </span>
  );

  return (
    <PageLayout>
      {/* Summary */}
      <div className="flex items-end gap-3.5 pt-1 pb-1 animate-up">
        <span className="font-num text-[32px] font-semibold text-[#ECEEF2] leading-none">{totalDecks}</span>
        <span className="text-[14px] text-[#969BA6] pb-1">개 덱 · <span className="font-num">{totalCards.toLocaleString()}</span>장 카드</span>
      </div>

      <div className="animate-up stagger-1">
        <SectionLabel>덱 목록</SectionLabel>
        <Card>
          <CardContent className="p-0">
            {groups.map((group, gi) => (
              <div key={group.id} className={gi > 0 ? 'border-t border-white/[0.06]' : ''}>
                <button onClick={() => toggle(group.id)} className="w-full flex items-center gap-3 p-4 transition-colors active:bg-white/[0.03]">
                  <Folder size={19} className="text-[#969BA6]" strokeWidth={1.6} />
                  <span className="text-[16px] font-semibold text-[#ECEEF2] flex-1 text-left">{group.label}</span>
                  <Frac m={gm(group)} />
                  {expanded.has(group.id)
                    ? <ChevronDown size={18} className="text-[#6B717C]" />
                    : <ChevronRight size={18} className="text-[#6B717C]" />}
                </button>
                {expanded.has(group.id) && (
                  <div className="bg-[#101218] animate-expand">
                    {group.decks.map((deck) => (
                      <button
                        key={deck.id}
                        onClick={() => setSelectedDeck({ group, deck })}
                        className="w-full flex items-center gap-[11px] py-[13px] pl-[34px] pr-4 transition-colors active:bg-white/[0.03]"
                      >
                        <CreditCard size={16} className="text-[#5D636F]" strokeWidth={1.6} />
                        <span className="text-[14.5px] text-[#C7CCD4] flex-1 text-left">{deck.name}</span>
                        <Frac m={dm(deck)} dim />
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
        <div className="fixed inset-0 z-50 flex items-end justify-center animate-overlay" onClick={() => setSelectedDeck(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-[393px] max-h-[80svh] overflow-y-auto bg-[#15171D] rounded-t-[24px] p-5 pb-7 space-y-4 animate-sheet border-t border-white/[0.08]"
            style={{ boxShadow: '0 -8px 40px rgba(0,0,0,0.5)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-[#2A2F38] mx-auto" />
            <div>
              <p className="font-display text-[18px] font-semibold text-[#F4F5F7]">
                {selectedDeck.group.label} · {selectedDeck.deck.name}
              </p>
              <p className="text-[12.5px] text-[#5D636F] mt-1">
                <span className="font-num">{selectedDeck.deck.cards.length}</span>장 · 마스터 <span className="font-num text-[#6FC4A0]">{dm(selectedDeck.deck).mastered}</span>/<span className="font-num">{dm(selectedDeck.deck).total}</span>
              </p>
            </div>

            <div className="h-1.5 rounded-full bg-[#0E1015] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#5FB991]"
                style={{ width: `${(dm(selectedDeck.deck).mastered / Math.max(1, dm(selectedDeck.deck).total)) * 100}%` }}
              />
            </div>

            <div className="flex gap-2">
              {(['foundation', 'mechanism', 'diagnosis'] as const).map((tier) => {
                const count = selectedDeck.deck.cards.filter((c) => c.tier === tier).length;
                return count > 0 ? <TierBadge key={tier} tier={tier} full /> : null;
              })}
            </div>

            <div className="space-y-2">
              <SectionLabel tight upper>미리보기</SectionLabel>
              {selectedDeck.deck.cards.slice(0, 2).map((card) => (
                <div key={card.id} className="p-3.5 rounded-[13px] bg-[#101218] border border-white/[0.06]">
                  <p className="text-[13.5px] text-[#C7CCD4] leading-relaxed">{card.question}</p>
                </div>
              ))}
            </div>

            <ActionButton variant="secondary" onClick={() => setSelectedDeck(null)}>닫기</ActionButton>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
