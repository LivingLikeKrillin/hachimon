import { useState, useEffect } from 'react';
import { RotateCcw, Download, Info, FolderInput, Database, ChevronRight, Bell } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import PageLayout from '@/components/layout/PageLayout';
import SectionLabel from '@/components/shared/SectionLabel';
import ImportVaultModal from '@/components/settings/ImportVaultModal';
import { useSettings } from '@/hooks/useSettings';
import { getCardSource, getVaultMeta, restoreDemoCards, exportLearningData, resetLearningData, type CardSource, type VaultMeta } from '@/lib/data';

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const GOLD_FILL = 'linear-gradient(90deg,#E09A3C,#F2BC68)';
const PURPLE_FILL = 'linear-gradient(90deg,#6E63B5,#9A90D4)';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  accent: string;
  fill: string;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}

function SliderSetting({ label, value, min, max, unit, accent, fill, step, format, onChange }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-[15px]">
        <span className="text-[15px] font-medium text-[#ECEEF2]">{label}</span>
        <span className="font-num text-[13px] text-[#5D636F]">
          <span className="text-[19px] font-semibold" style={{ color: accent }}>
            {format ? format(value) : (value % 1 !== 0 ? value.toFixed(1) : value)}
          </span>
          {unit && <> {unit}</>}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? (max <= 3 ? 0.1 : 1)}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ background: `linear-gradient(to right, transparent 0%, transparent ${pct}%, var(--track) ${pct}%, var(--track) 100%), ${fill}`, backgroundClip: 'padding-box' }}
      />
      <div className="flex justify-between mt-[9px]">
        <span className="text-[12px] text-[#5D636F]">{format ? format(min) : `${min}${unit}`}</span>
        <span className="text-[12px] text-[#5D636F]">{format ? format(max) : `${max}${unit}`}</span>
      </div>
    </div>
  );
}

const Divider = () => <div className="h-px bg-white/[0.06] my-[18px]" />;

export default function Settings() {
  const { settings, loading, update } = useSettings();
  const [source, setSource] = useState<CardSource>('demo');
  const [vaultMeta, setVaultMeta] = useState<VaultMeta | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    getCardSource().then(setSource);
    getVaultMeta().then(setVaultMeta);
  }, []);

  const revertToDemo = async () => { await restoreDemoCards(); window.location.reload(); };

  const [resetOpen, setResetOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const data = await exportLearningData();
      downloadJson(`hachimon-backup-${new Date().toISOString().slice(0, 10)}.json`, data);
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setBusy(true);
    await resetLearningData();
    window.location.reload();
  };

  const notifyUnsupported = typeof window !== 'undefined' && !('Notification' in window);

  const toggleReminder = async () => {
    if (settings.reminderEnabled) {
      update({ reminderEnabled: false });
      return;
    }
    // 켜는 중 — 알림 권한 요청
    if (notifyUnsupported) return;
    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    update({ reminderEnabled: perm === 'granted' });
  };

  if (loading) return <PageLayout><div /></PageLayout>;

  const presets = [
    { name: '기본', desc: '균형 잡힌 설정', values: { dailyNew: 10, dailyReview: 50, sessionSize: 15 } },
    { name: '집중', desc: '많은 복습량', values: { dailyNew: 5, dailyReview: 100, sessionSize: 20 } },
    { name: '가벼운', desc: '적은 복습량', values: { dailyNew: 5, dailyReview: 30, sessionSize: 10 } },
    { name: '시험 대비', desc: '최대 복습', values: { dailyNew: 0, dailyReview: 200, sessionSize: 30 } },
  ];

  return (
    <PageLayout>
      {/* Session settings */}
      <div className="animate-up">
        <SectionLabel upper>세션 설정</SectionLabel>
        <Card>
          <CardContent className="p-5">
            <SliderSetting label="일일 신규 카드" value={settings.dailyNew} min={0} max={30} unit="장" accent="#E9A94C" fill={GOLD_FILL} onChange={(v) => update({ dailyNew: v })} />
            <Divider />
            <SliderSetting label="일일 복습 상한" value={settings.dailyReview} min={10} max={200} unit="장" accent="#E9A94C" fill={GOLD_FILL} onChange={(v) => update({ dailyReview: v })} />
            <Divider />
            <SliderSetting label="세션당 카드 수" value={settings.sessionSize} min={5} max={30} unit="장" accent="#E9A94C" fill={GOLD_FILL} onChange={(v) => update({ sessionSize: v })} />
          </CardContent>
        </Card>
      </div>

      {/* FSRS params */}
      <div className="animate-up stagger-1">
        <SectionLabel upper>FSRS 파라미터</SectionLabel>
        <Card>
          <CardContent className="p-5">
            <SliderSetting
              label="목표 기억 유지율"
              value={settings.requestRetention}
              min={0.8} max={0.97} step={0.01}
              unit="" accent="#9A90D4" fill={PURPLE_FILL}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => update({ requestRetention: v })}
            />
          </CardContent>
        </Card>
        <div className="flex items-start gap-2 mt-2.5 px-1">
          <Info size={13} className="text-[#5D636F] mt-0.5 shrink-0" />
          <p className="text-[12px] text-[#5D636F] leading-relaxed">목표 기억 유지율이 높을수록 복습 간격이 짧아지고 더 자주 복습합니다. 기본값 90%를 권장합니다.</p>
        </div>
      </div>

      {/* Reminder */}
      <div className="animate-up stagger-2">
        <SectionLabel upper>복습 리마인더</SectionLabel>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Bell size={18} style={{ color: settings.reminderEnabled ? '#E9A94C' : '#969BA6' }} />
              <div className="flex-1">
                <p className="text-[15px] font-medium text-[#ECEEF2]">매일 복습 알림</p>
                <p className="text-[12px] text-[#5D636F]">앱을 열었을 때 미복습이면 알려줘요</p>
              </div>
              <button
                onClick={toggleReminder}
                disabled={notifyUnsupported}
                role="switch"
                aria-checked={settings.reminderEnabled}
                className="relative w-[46px] h-[28px] rounded-full transition-colors disabled:opacity-40"
                style={{ background: settings.reminderEnabled ? '#E9A94C' : '#2A2E37' }}
              >
                <span
                  className="absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white transition-[left] duration-200"
                  style={{ left: settings.reminderEnabled ? '21px' : '3px' }}
                />
              </button>
            </div>
            {settings.reminderEnabled && (
              <>
                <Divider />
                <SliderSetting
                  label="알림 시각"
                  value={settings.reminderHour}
                  min={0}
                  max={23}
                  unit="시"
                  accent="#E9A94C"
                  fill={GOLD_FILL}
                  onChange={(v) => update({ reminderHour: v })}
                />
              </>
            )}
          </CardContent>
        </Card>
        {notifyUnsupported && (
          <div className="flex items-start gap-2 mt-2.5 px-1">
            <Info size={13} className="text-[#5D636F] mt-0.5 shrink-0" />
            <p className="text-[12px] text-[#5D636F] leading-relaxed">이 브라우저는 알림을 지원하지 않습니다.</p>
          </div>
        )}
      </div>

      {/* Presets */}
      <div className="animate-up stagger-2">
        <SectionLabel upper>프리셋</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5">
          {presets.map((p) => (
            <button
              key={p.name}
              onClick={() => update(p.values)}
              className="p-4 rounded-[14px] bg-[#181B21] border border-white/[0.07] text-left transition-colors active:bg-[#1E222A]"
            >
              <p className="text-[14px] font-semibold text-[#ECEEF2] mb-0.5">{p.name}</p>
              <p className="text-[12px] text-[#5D636F]">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Card source */}
      <div className="animate-up stagger-3">
        <SectionLabel upper>데이터 소스</SectionLabel>
        <div className="space-y-2">
          <div className="flex items-center gap-3 px-4 py-3 rounded-[14px] bg-[#181B21] border border-white/[0.07]">
            <Database size={18} style={{ color: source === 'vault' ? '#E9A94C' : '#969BA6' }} />
            <div className="flex-1">
              <p className="text-[14px] font-medium text-[#ECEEF2]">{source === 'vault' ? '내 Obsidian Vault' : '데모 카드'}</p>
              <p className="text-[12px] text-[#5D636F]">
                {source === 'vault' && vaultMeta ? `${vaultMeta.deckCount}덱 · ${vaultMeta.cardCount}장` : '샘플 데이터로 둘러보는 중'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setImportOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-[14px] bg-[#181B21] border border-white/[0.07] transition-colors active:bg-[#1E222A]"
          >
            <FolderInput size={18} className="text-[#C7CCD4]" />
            <div className="flex-1 text-left">
              <p className="text-[14px] font-medium text-[#ECEEF2]">Obsidian Vault 가져오기</p>
              <p className="text-[12px] text-[#5D636F]">내 노트로 카드 교체 · 일정은 유지</p>
            </div>
            <ChevronRight size={16} className="text-[#4A505B]" />
          </button>
          {source === 'vault' && (
            <button onClick={revertToDemo} className="w-full flex items-center gap-3 px-4 py-3 rounded-[14px] bg-[#181B21] border border-white/[0.07] transition-colors active:bg-[#1E222A]">
              <RotateCcw size={16} className="text-[#969BA6]" />
              <p className="text-[13px] text-[#969BA6]">데모 카드로 되돌리기</p>
            </button>
          )}
        </div>
      </div>

      {/* Data management */}
      <div className="animate-up stagger-4">
        <SectionLabel upper>데이터 관리</SectionLabel>
        <div className="space-y-2">
          <button onClick={handleExport} disabled={busy} className="w-full flex items-center gap-3 px-4 py-4 rounded-[14px] bg-[#181B21] border border-white/[0.07] transition-colors active:bg-[#1E222A] disabled:opacity-50">
            <Download size={18} className="text-[#C7CCD4]" />
            <div className="text-left">
              <p className="text-[14px] font-medium text-[#ECEEF2]">데이터 내보내기</p>
              <p className="text-[12px] text-[#5D636F]">학습 기록을 JSON으로 저장</p>
            </div>
          </button>
          <button onClick={() => setResetOpen(true)} disabled={busy} className="w-full flex items-center gap-3 px-4 py-4 rounded-[14px] bg-[#181B21] border border-[#CD746C]/20 transition-colors active:bg-[#CD746C]/[0.06] disabled:opacity-50">
            <RotateCcw size={18} className="text-[#DD8C85]" />
            <div className="text-left">
              <p className="text-[14px] font-medium text-[#DD8C85]">학습 기록 초기화</p>
              <p className="text-[12px] text-[#5D636F]">모든 복습 데이터를 삭제합니다</p>
            </div>
          </button>
        </div>
      </div>

      {importOpen && <ImportVaultModal onClose={() => setImportOpen(false)} />}

      {/* Reset confirm */}
      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-7 animate-overlay" onClick={() => !busy && setResetOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-[330px] bg-[#15171D] rounded-[20px] p-6 border border-white/[0.08] animate-scale"
            style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="w-11 h-11 rounded-[13px] bg-[#CD746C]/15 flex items-center justify-center mb-4">
              <RotateCcw size={21} className="text-[#DD8C85]" strokeWidth={1.8} />
            </span>
            <p className="text-[17px] font-semibold text-[#F4F5F7]">학습 기록 초기화</p>
            <p className="text-[13px] text-[#969BA6] mt-2 leading-relaxed">
              모든 복습 로그가 삭제되고 카드 스케줄이 초기 상태로 돌아갑니다. 카드는 유지되며 다시 새 카드가 됩니다. <span className="text-[#DD8C85] font-medium">되돌릴 수 없어요.</span>
            </p>
            <div className="grid grid-cols-2 gap-2.5 mt-6">
              <button onClick={() => setResetOpen(false)} disabled={busy} className="h-[46px] rounded-[13px] bg-[#181B21] border border-white/[0.08] text-[14.5px] font-semibold text-[#C7CCD4] active:bg-[#1E222A] disabled:opacity-50">
                취소
              </button>
              <button onClick={handleReset} disabled={busy} className="h-[46px] rounded-[13px] bg-[#CD746C] text-[14.5px] font-semibold text-[#1A0E0D] active:opacity-90 disabled:opacity-50">
                {busy ? '초기화 중…' : '초기화'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
