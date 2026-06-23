import type { Schedule, ReviewLog } from '@/types';

export const EXPORT_FORMAT = 'hachimon-backup';
export const EXPORT_VERSION = 1;

export interface SettingRow {
  key: string;
  value: string;
}

export interface BackupData {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  schedules: Schedule[];
  reviewLog: ReviewLog[];
  settings: SettingRow[];
}

/**
 * 학습 기록 백업 객체를 구성한다 (순수). 카드 본문은 cards.json/vault에서
 * 재생성되므로 제외하고, SM-2 스케줄·복습 로그·설정만 담는다.
 */
export function buildExport(
  schedules: Schedule[],
  reviewLog: ReviewLog[],
  settings: SettingRow[],
  exportedAt: string,
): BackupData {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt,
    schedules,
    reviewLog,
    settings,
  };
}
