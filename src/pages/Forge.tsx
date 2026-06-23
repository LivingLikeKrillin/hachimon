import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Flame, Check } from 'lucide-react';
import type { Card as CardType, Tier, Schedule } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import ScreenContainer from '@/components/layout/ScreenContainer';
import SectionLabel from '@/components/shared/SectionLabel';
import ActionButton from '@/components/shared/ActionButton';
import { GATE_COLORS, TIER_COLORS } from '@/lib/tokens';
import { getAllCardsByDeck, getForgeCards } from '@/lib/data';

interface DeckItem {
  id: string;
  group: string;
  name: string;
  gate: string;
  cards: CardType[];
}

const GROUP_GATES: Record<string, string> = {
  spring: GATE_COLORS[0],
  jpa: GATE_COLORS[4],
  java: GATE_COLORS[6],
  k8s: GATE_COLORS[2],
  db: GATE_COLORS[5],
  aws: GATE_COLORS[1],
};

const TIERS: { id: Tier; label: string; color: string }[] = [
  { id: 'foundation', label: 'Foundation', color: TIER_COLORS.foundation },
  { id: 'mechanism', label: 'Mechanism', color: TIER_COLORS.mechanism },
  { id: 'diagnosis', label: 'Diagnosis', color: TIER_COLORS.diagnosis },
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function buildDeckList(map: Map<string, CardType[]>): DeckItem[] {
  return [...map.entries()].map(([id, cards]) => {
    const parts = id.split('/');
    const group = parts[1] || parts[0];
    return {
      id,
      group: cap(group),
      name: cap(parts[parts.length - 1] || id),
      gate: GROUP_GATES[group] || GATE_COLORS[0],
      cards,
    };
  });
}

interface ForgeProps {
  onStart: (cards: (CardType & { schedule: Schedule })[]) => void;
  onExit: () => void;
}

export default function Forge({ onStart, onExit }: ForgeProps) {
  const [decks, setDecks] = useState<DeckItem[]>([]);
  const [selectedDecks, setSelectedDecks] = useState<Set<string>>(new Set());
  const [selectedTiers, setSelectedTiers] = useState<Set<Tier>>(
    new Set(['foundation', 'mechanism', 'diagnosis']),
  );
  const [size, setSize] = useState(15);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    getAllCardsByDeck().then((map) => {
      const list = buildDeckList(map);
      setDecks(list);
      setSelectedDecks(new Set(list.map((d) => d.id))); // 기본 전체 선택
      setLoading(false);
    });
  }, []);

  const matchCount = useMemo(() => {
    let n = 0;
    for (const d of decks) {
      if (!selectedDecks.has(d.id)) continue;
      n += d.cards.filter((c) => selectedTiers.has(c.tier)).length;
    }
    return n;
  }, [decks, selectedDecks, selectedTiers]);

  const sessionCount = Math.min(size, matchCount);
  const canStart = selectedDecks.size > 0 && selectedTiers.size > 0 && matchCount > 0 && !starting;
  const allSelected = decks.length > 0 && selectedDecks.size === decks.length;

  const toggleDeck = (id: string) =>
    setSelectedDecks((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleTier = (id: Tier) =>
    setSelectedTiers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelectedDecks(allSelected ? new Set() : new Set(decks.map((d) => d.id)));

  const start = async () => {
    if (!canStart) return;
    setStarting(true);
    const cards = await getForgeCards(selectedDecks, selectedTiers, size);
    if (cards.length === 0) {
      setStarting(false);
      return;
    }
    onStart(cards);
  };

  return (
    <ScreenContainer className="flex flex-col">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <button
          onClick={onExit}
          className="w-10 h-10 flex items-center justify-center text-zinc-500 active:text-zinc-300"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="text-center">
          <p className="font-display text-[15px] font-bold text-zinc-100">단련</p>
          <p className="text-[10px] text-zinc-600 tracking-[0.2em]">鍛 鍊</p>
        </div>
        <div className="w-10" />
      </div>

      {/* Scrollable config */}
      <div className="flex-1 overflow-y-auto px-4 pb-32 space-y-5">
        {!loading && (
          <>
            {/* Deck selection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>덱 선택</SectionLabel>
                <button onClick={toggleAll} className="text-[11px] text-blue-400 active:text-blue-300">
                  {allSelected ? '전체 해제' : '전체 선택'}
                </button>
              </div>
              <Card>
                <CardContent className="p-0">
                  {decks.map((deck, i) => {
                    const on = selectedDecks.has(deck.id);
                    return (
                      <button
                        key={deck.id}
                        onClick={() => toggleDeck(deck.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors active:bg-zinc-800/40 ${
                          i > 0 ? 'border-t border-zinc-800/60' : ''
                        }`}
                      >
                        <span
                          className={`w-[18px] h-[18px] rounded-md border flex items-center justify-center transition-colors ${
                            on ? 'border-transparent' : 'border-zinc-700'
                          }`}
                          style={on ? { background: deck.gate } : undefined}
                        >
                          {on && <Check size={12} className="text-zinc-950" strokeWidth={3} />}
                        </span>
                        <span className="w-1 h-5 rounded-full" style={{ background: deck.gate }} />
                        <span className="text-[13px] flex-1 text-left text-zinc-200">
                          <span className="text-zinc-500">{deck.group}</span> · {deck.name}
                        </span>
                        <span className="text-[12px] text-zinc-500 tabular-nums">{deck.cards.length}</span>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Tier filter */}
            <div>
              <SectionLabel>티어</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {TIERS.map((t) => {
                  const on = selectedTiers.has(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleTier(t.id)}
                      className={`h-11 rounded-xl text-[13px] font-medium border transition-all active:scale-[0.97] ${
                        on ? 'border-transparent' : 'border-zinc-800 text-zinc-500'
                      }`}
                      style={on ? { background: `${t.color}1f`, color: t.color, borderColor: `${t.color}55` } : undefined}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Session size */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>세션 크기</SectionLabel>
                <span className="font-display text-[18px] font-bold tabular-nums text-zinc-100">
                  {size}
                  <span className="text-[12px] text-zinc-500 font-normal ml-0.5">장</span>
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={30}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-full"
                style={{
                  background: `linear-gradient(to right, #fb923c 0%, #fb923c ${((size - 5) / 25) * 100}%, #27272a ${((size - 5) / 25) * 100}%, #27272a 100%)`,
                }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-[11px] text-zinc-500">5장</span>
                <span className="text-[11px] text-zinc-500">30장</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Sticky start */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[393px] px-4 pb-6 pt-3 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent">
        <p className="text-center text-[12px] text-zinc-500 mb-2.5 tabular-nums">
          조건에 맞는 <span className="text-zinc-300">{matchCount}</span>장 중{' '}
          <span className="text-amber-400 font-medium">{sessionCount}</span>장 단련
        </p>
        <ActionButton
          variant="warning"
          icon={<Flame size={18} />}
          onClick={start}
          className={canStart ? '' : 'opacity-40 pointer-events-none'}
        >
          {starting ? '준비 중…' : '단련 시작'}
        </ActionButton>
      </div>
    </ScreenContainer>
  );
}
