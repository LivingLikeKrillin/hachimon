import { useState } from 'react';
import { RotateCcw, Download, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import PageLayout from '@/components/layout/PageLayout';
import SectionLabel from '@/components/shared/SectionLabel';

interface SliderSettingProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}

function SliderSetting({ label, value, min, max, unit, onChange }: SliderSettingProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-[13px]">{label}</span>
        <span className="font-display text-[14px] font-semibold tabular-nums text-blue-400">
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      <div className="flex justify-between">
        <span className="text-[10px] text-zinc-600">{min}{unit}</span>
        <span className="text-[10px] text-zinc-600">{max}{unit}</span>
      </div>
    </div>
  );
}

export default function Settings() {
  const [dailyNew, setDailyNew] = useState(10);
  const [dailyReview, setDailyReview] = useState(50);
  const [sessionSize, setSessionSize] = useState(15);
  const [initialEF, setInitialEF] = useState(2.5);
  const [minEF, setMinEF] = useState(1.3);

  return (
    <PageLayout>
      {/* Session settings */}
      <div className="animate-up">
        <SectionLabel>세션 설정</SectionLabel>
        <Card>
          <CardContent className="p-4 space-y-5">
            <SliderSetting label="일일 신규 카드" value={dailyNew} min={0} max={30} unit="장" onChange={setDailyNew} />
            <div className="border-t border-zinc-800/50" />
            <SliderSetting label="일일 복습 상한" value={dailyReview} min={10} max={200} unit="장" onChange={setDailyReview} />
            <div className="border-t border-zinc-800/50" />
            <SliderSetting label="세션당 카드 수" value={sessionSize} min={5} max={30} unit="장" onChange={setSessionSize} />
          </CardContent>
        </Card>
      </div>

      {/* SM-2 params */}
      <div className="animate-up stagger-1">
        <SectionLabel>SM-2 파라미터</SectionLabel>
        <Card>
          <CardContent className="p-4 space-y-5">
            <SliderSetting
              label="초기 Ease Factor"
              value={initialEF}
              min={1.3}
              max={3.0}
              unit=""
              onChange={setInitialEF}
            />
            <div className="border-t border-zinc-800/50" />
            <SliderSetting
              label="최소 Ease Factor"
              value={minEF}
              min={1.0}
              max={2.0}
              unit=""
              onChange={setMinEF}
            />
          </CardContent>
        </Card>
        <div className="flex items-start gap-2 mt-2 px-1">
          <Info size={12} className="text-zinc-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-zinc-600 leading-relaxed">
            Ease Factor가 높을수록 복습 간격이 빠르게 늘어납니다. 기본값 2.5를 권장합니다.
          </p>
        </div>
      </div>

      {/* Presets */}
      <div className="animate-up stagger-2">
        <SectionLabel>프리셋</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {[
            { name: '기본', desc: '균형 잡힌 설정', values: '10/50/15' },
            { name: '집중', desc: '많은 복습량', values: '5/100/20' },
            { name: '가벼운', desc: '적은 복습량', values: '5/30/10' },
            { name: '시험 대비', desc: '최대 복습', values: '0/200/30' },
          ].map((preset) => (
            <button
              key={preset.name}
              onClick={() => {
                const [n, r, s] = preset.values.split('/').map(Number);
                setDailyNew(n);
                setDailyReview(r);
                setSessionSize(s);
              }}
              className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-left transition-all hover:border-blue-500/30 active:scale-[0.97]"
            >
              <p className="text-[13px] font-medium">{preset.name}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">{preset.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Data management */}
      <div className="animate-up stagger-3">
        <SectionLabel>데이터 관리</SectionLabel>
        <div className="space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-zinc-900 border border-zinc-800 transition-colors hover:bg-zinc-800/60 active:scale-[0.97]">
            <Download size={16} className="text-zinc-400" />
            <div className="text-left">
              <p className="text-[14px]">데이터 내보내기</p>
              <p className="text-[11px] text-zinc-500">학습 기록을 JSON으로 저장</p>
            </div>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-zinc-900 border border-red-500/20 transition-colors hover:bg-red-500/5 active:scale-[0.97]">
            <RotateCcw size={16} className="text-red-400" />
            <div className="text-left">
              <p className="text-[14px] text-red-400">학습 기록 초기화</p>
              <p className="text-[11px] text-zinc-500">모든 복습 데이터를 삭제합니다</p>
            </div>
          </button>
        </div>
      </div>
    </PageLayout>
  );
}
