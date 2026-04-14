import { RotateCcw, Download, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import PageLayout from '@/components/layout/PageLayout';
import SectionLabel from '@/components/shared/SectionLabel';
import { useSettings } from '@/hooks/useSettings';

interface SliderSettingProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  color?: string;
  onChange: (v: number) => void;
}

function SliderSetting({ label, value, min, max, unit, color = '#60a5fa', onChange }: SliderSettingProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-[14px] font-medium">{label}</span>
        <span
          className="font-display text-[20px] font-bold tabular-nums"
          style={{ color }}
        >
          {typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1) : value}
          <span className="text-[13px] text-zinc-400 font-normal ml-0.5">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={max <= 3 ? 0.1 : 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${((value - min) / (max - min)) * 100}%, #27272a ${((value - min) / (max - min)) * 100}%, #27272a 100%)`,
        }}
      />
      <div className="flex justify-between">
        <span className="text-[11px] text-zinc-500">{min}{unit}</span>
        <span className="text-[11px] text-zinc-500">{max}{unit}</span>
      </div>
    </div>
  );
}

export default function Settings() {
  const { settings, loading, update } = useSettings();

  if (loading) return <PageLayout><div /></PageLayout>;

  return (
    <PageLayout>
      {/* Session settings */}
      <div className="animate-up">
        <SectionLabel>세션 설정</SectionLabel>
        <Card>
          <CardContent className="p-5 space-y-6">
            <SliderSetting label="일일 신규 카드" value={settings.dailyNew} min={0} max={30} unit="장" color="#60a5fa" onChange={(v) => update({ dailyNew: v })} />
            <div className="border-t border-zinc-800/50" />
            <SliderSetting label="일일 복습 상한" value={settings.dailyReview} min={10} max={200} unit="장" color="#34d399" onChange={(v) => update({ dailyReview: v })} />
            <div className="border-t border-zinc-800/50" />
            <SliderSetting label="세션당 카드 수" value={settings.sessionSize} min={5} max={30} unit="장" color="#fbbf24" onChange={(v) => update({ sessionSize: v })} />
          </CardContent>
        </Card>
      </div>

      {/* SM-2 params */}
      <div className="animate-up stagger-1">
        <SectionLabel>SM-2 파라미터</SectionLabel>
        <Card>
          <CardContent className="p-5 space-y-6">
            <SliderSetting
              label="초기 Ease Factor"
              value={settings.initialEF}
              min={1.3}
              max={3.0}
              unit=""
              color="#a78bfa"
              onChange={(v) => update({ initialEF: v })}
            />
            <div className="border-t border-zinc-800/50" />
            <SliderSetting
              label="최소 Ease Factor"
              value={settings.minEF}
              min={1.0}
              max={2.0}
              unit=""
              color="#fb923c"
              onChange={(v) => update({ minEF: v })}
            />
          </CardContent>
        </Card>
        <div className="flex items-start gap-2 mt-2 px-1">
          <Info size={13} className="text-zinc-500 mt-0.5 shrink-0" />
          <p className="text-[12px] text-zinc-500 leading-relaxed">
            Ease Factor가 높을수록 복습 간격이 빠르게 늘어납니다. 기본값 2.5를 권장합니다.
          </p>
        </div>
      </div>

      {/* Presets */}
      <div className="animate-up stagger-2">
        <SectionLabel>프리셋</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { name: '기본', desc: '균형 잡힌 설정', values: { dailyNew: 10, dailyReview: 50, sessionSize: 15 }, icon: '⚖️' },
            { name: '집중', desc: '많은 복습량', values: { dailyNew: 5, dailyReview: 100, sessionSize: 20 }, icon: '🔥' },
            { name: '가벼운', desc: '적은 복습량', values: { dailyNew: 5, dailyReview: 30, sessionSize: 10 }, icon: '🍃' },
            { name: '시험 대비', desc: '최대 복습', values: { dailyNew: 0, dailyReview: 200, sessionSize: 30 }, icon: '⚡' },
          ].map((preset) => (
            <button
              key={preset.name}
              onClick={() => update(preset.values)}
              className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-left transition-all hover:border-zinc-600 active:scale-[0.97]"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[16px]">{preset.icon}</span>
                <span className="text-[14px] font-semibold">{preset.name}</span>
              </div>
              <p className="text-[12px] text-zinc-500">{preset.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Data management */}
      <div className="animate-up stagger-3">
        <SectionLabel>데이터 관리</SectionLabel>
        <div className="space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-4 rounded-xl bg-zinc-900 border border-zinc-800 transition-colors hover:bg-zinc-800/60 active:scale-[0.97]">
            <Download size={18} className="text-zinc-300" />
            <div className="text-left">
              <p className="text-[14px] font-medium">데이터 내보내기</p>
              <p className="text-[12px] text-zinc-500">학습 기록을 JSON으로 저장</p>
            </div>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-4 rounded-xl bg-zinc-900 border border-red-500/20 transition-colors hover:bg-red-500/5 active:scale-[0.97]">
            <RotateCcw size={18} className="text-red-400" />
            <div className="text-left">
              <p className="text-[14px] font-medium text-red-400">학습 기록 초기화</p>
              <p className="text-[12px] text-zinc-500">모든 복습 데이터를 삭제합니다</p>
            </div>
          </button>
        </div>
      </div>
    </PageLayout>
  );
}
