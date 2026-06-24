import { useState, useEffect, useCallback } from 'react';
import { getSetting, setSetting } from '@/lib/data';

export interface AppSettings {
  dailyNew: number;
  dailyReview: number;
  sessionSize: number;
  requestRetention: number;
  reminderEnabled: boolean;
  reminderHour: number; // 0~23
}

const DEFAULTS: AppSettings = {
  dailyNew: 10,
  dailyReview: 50,
  sessionSize: 15,
  requestRetention: 0.9,
  reminderEnabled: false,
  reminderHour: 9,
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSetting<AppSettings>('appSettings', DEFAULTS)
      // 기존 저장값에 새 필드가 없을 수 있어 DEFAULTS와 병합
      .then((s) => { setSettings({ ...DEFAULTS, ...s }); setLoading(false); });
  }, []);

  const update = useCallback(async (partial: Partial<AppSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    await setSetting('appSettings', next);
  }, [settings]);

  return { settings, loading, update };
}
