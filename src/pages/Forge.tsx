import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Flame, Check } from 'lucide-react';
import type { Card as CardType, Tier, Schedule } from '@/types';
import ScreenContainer from '@/components/layout/ScreenContainer';
import { getAllCardsByDeck, getForgeCards } from '@/lib/data';
import { TIER_COLORS, TIER_TEXT } from '@/lib/tokens';

interface DeckItem { id: string; group: string; name: string; cards: CardType[]; }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const TIERS: Tier[] = ['foundation', 'mechanism', 'diagnosis'];
const TIER_LABEL: Record<Tier, string> = { foundation: 'Foundation', mechanism: 'Mechanism', diagnosis: 'Diagnosis' };

function buildList(map: Map<string, CardType[]>): DeckItem[] {
  return [...map.entries()].map(([id, cards]) => {
    const parts = id.split('/');
    return { id, group: cap(parts[1] || parts[0]), name: cap(parts[parts.length - 1] || id), cards };
  });
}

interface ForgeProps {
  onStart: (cards: (CardType & { schedule: Schedule })[]) => void;
  onExit: () => void;
}

export default function Forge({ onStart, onExit }: ForgeProps) {
  const [decks, setDecks] = useState<DeckItem[]>([]);
  const [selDecks, setSelDecks] = useState<Set<string>>(new Set());
  const [selTiers, setSelTiers] = useState<Set<Tier>>(new Set(TIERS));
  const [size, setSize] = useState(15);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    getAllCardsByDeck().then((map) => {
      const list = buildList(map);
      setDecks(list);
      setSelDecks(new Set(list.map((d) => d.id)));
      setLoading(false);
    });
  }, []);

  const matchCount = useMemo(() => {
    let n = 0;
    for (const d of decks) if (selDecks.has(d.id)) n += d.cards.filter((c) => selTiers.has(c.tier)).length;
    return n;
  }, [decks, selDecks, selTiers]);

  const sessionCount = Math.min(size, matchCount);
  const canStart = selDecks.size > 0 && selTiers.size > 0 && matchCount > 0 && !starting;
  const allSel = decks.length > 0 && selDecks.size === decks.length;

  const toggleDeck = (id: string) => setSelDecks((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleTier = (t: Tier) => setSelTiers((p) => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; });
  const toggleAll = () => setSelDecks(allSel ? new Set() : new Set(decks.map((d) => d.id)));

  const start = async () => {
    if (!canStart) return;
    setStarting(true);
    const cards = await getForgeCards(selDecks, selTiers, size);
    if (cards.length === 0) { setStarting(false); return; }
    onStart(cards);
  };

  const pct = ((size - 5) / 25) * 100;

  return (
    <ScreenContainer className="flex flex-col">
      {/* Top nav */}
      <div className="flex items-center px-[18px] pt-3 pb-3.5 relative">
        <button onClick={onExit} className="w-[38px] h-[38px] rounded-[11px] bg-[#181B21] border border-white/[0.08] flex items-center justify-center active:bg-[#1E222A]">
          <ArrowLeft size={19} className="text-[#C7CCD4]" strokeWidth={1.9} />
        </button>
        <span className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold text-[#F4F5F7]">단련</span>
      </div>

      <div className="flex-1 overflow-y-auto px-[22px] pb-32">
        {!loading && (
          <>
            {/* Info banner */}
            <div
              className="flex gap-3 rounded-[16px] p-4 border"
              style={{ background: 'linear-gradient(180deg,rgba(233,169,76,0.10),rgba(233,169,76,0.04))', borderColor: 'rgba(233,169,76,0.18)' }}
            >
              <span className="flex-none w-[30px] h-[30px] rounded-[9px] bg-[#E9A94C]/15 flex items-center justify-center">
                <Flame size={17} className="text-[#E9A94C]" strokeWidth={1.8} />
              </span>
              <p className="text-[13.5px] leading-[1.55] text-[#C7CCD4]">
                <span className="text-[#E9A94C] font-semibold">약한 카드부터</span> 골라 거듭 벼립니다. 틀린 적 많거나 아직 안 굳은 카드가 먼저 나옵니다.
              </p>
            </div>

            {/* Deck select */}
            <div className="flex items-baseline justify-between mt-6 mb-3 px-0.5">
              <span className="text-[13px] font-semibold text-[#969BA6] tracking-[0.02em]">덱 선택</span>
              <button onClick={toggleAll} className="text-[13px] font-semibold text-[#E9A94C]">{allSel ? '전체 해제' : '전체 선택'}</button>
            </div>
            <div className="surface rounded-[18px] overflow-hidden">
              {decks.map((deck, i) => {
                const on = selDecks.has(deck.id);
                return (
                  <button
                    key={deck.id}
                    onClick={() => toggleDeck(deck.id)}
                    className={`w-full flex items-center gap-3 px-4 py-[15px] transition-colors active:bg-white/[0.03] ${i > 0 ? 'border-t border-white/[0.06]' : ''}`}
                  >
                    {on ? (
                      <span className="flex-none w-6 h-6 rounded-[7px] flex items-center justify-center" style={{ background: 'linear-gradient(180deg,#F2BC68,#E09A3C)', boxShadow: '0 0 8px rgba(233,169,76,0.4)' }}>
                        <Check size={14} className="text-[#241606]" strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="flex-none w-6 h-6 rounded-[7px] border border-white/[0.18]" />
                    )}
                    <span className="text-[15px] text-[#ECEEF2] flex-1 text-left"><span className="text-[#5D636F]">{deck.group} · </span><span className="font-medium">{deck.name}</span></span>
                    <span className="font-num text-[14px] text-[#5D636F]">{deck.cards.length}</span>
                  </button>
                );
              })}
            </div>

            {/* Tier */}
            <div className="text-[13px] font-semibold text-[#969BA6] tracking-[0.02em] mt-6 mb-3 px-0.5">티어</div>
            <div className="flex gap-2.5">
              {TIERS.map((t) => {
                const on = selTiers.has(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleTier(t)}
                    className="flex-1 h-[46px] rounded-[13px] flex items-center justify-center gap-1.5 text-[13.5px] font-semibold transition-colors"
                    style={on
                      ? { background: `${TIER_COLORS[t]}1f`, border: `1px solid ${TIER_COLORS[t]}60`, color: TIER_TEXT[t] }
                      : { border: '1px solid rgba(255,255,255,0.08)', color: '#5D636F' }}
                  >
                    <span className="w-[7px] h-[7px] rounded-full" style={{ background: on ? TIER_COLORS[t] : '#3F454F' }} />
                    {TIER_LABEL[t]}
                  </button>
                );
              })}
            </div>

            {/* Session size */}
            <div className="flex items-baseline justify-between mt-7 mb-3.5 px-0.5">
              <span className="text-[13px] font-semibold text-[#969BA6] tracking-[0.02em]">세션 크기</span>
              <span className="font-num text-[13px] text-[#5D636F]"><span className="text-[19px] font-semibold text-[#ECEEF2]">{size}</span> 장</span>
            </div>
            <div className="px-0.5">
              <input
                type="range" min={5} max={30} value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-full"
                style={{ background: `linear-gradient(to right, transparent 0%, transparent ${pct}%, var(--track) ${pct}%, var(--track) 100%), linear-gradient(90deg,#E09A3C,#F2BC68)` }}
              />
              <div className="flex justify-between mt-2"><span className="text-[12px] text-[#5D636F]">5장</span><span className="text-[12px] text-[#5D636F]">30장</span></div>
            </div>
          </>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[393px] px-[22px] pb-7 pt-6" style={{ background: 'linear-gradient(180deg,rgba(12,13,17,0) 0%,#0C0D11 32%)' }}>
        <p className="text-center text-[13px] text-[#5D636F] mb-3.5">
          약점 우선 · <span className="text-[#969BA6]">{matchCount}장</span> 중 <span className="text-[#E9A94C] font-semibold">{sessionCount}장</span> 단련
        </p>
        <button
          onClick={start}
          className={`btn-gold w-full h-[56px] rounded-[16px] text-[16.5px] font-semibold flex items-center justify-center gap-2.5 transition-transform active:scale-[0.98] ${canStart ? '' : 'opacity-40 pointer-events-none'}`}
        >
          <Flame size={19} />
          {starting ? '준비 중…' : '단련 시작'}
        </button>
      </div>
    </ScreenContainer>
  );
}
