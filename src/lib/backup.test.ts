import { describe, it, expect } from 'vitest';
import type { Schedule, ReviewLog } from '@/types';
import { buildExport, EXPORT_FORMAT, EXPORT_VERSION, type SettingRow } from './backup';

const schedule: Schedule = {
  cardId: 'c1',
  stability: 6,
  difficulty: 5,
  state: 2,
  reps: 2,
  lapses: 0,
  elapsedDays: 0,
  scheduledDays: 6,
  nextReviewAt: '2026-06-30T00:00:00.000Z',
  lastReviewedAt: '2026-06-24T00:00:00.000Z',
};
const log: ReviewLog = { cardId: 'c1', quality: 4, reviewedAt: '2026-06-24T00:00:00.000Z', sessionId: 's' };
const setting: SettingRow = { key: 'appSettings', value: '{"sessionSize":15}' };

describe('buildExport', () => {
  it('format/version/exportedAt 메타를 채운다', () => {
    const out = buildExport([], [], [], '2026-06-24T12:00:00.000Z');
    expect(out.format).toBe(EXPORT_FORMAT);
    expect(out.version).toBe(EXPORT_VERSION);
    expect(out.exportedAt).toBe('2026-06-24T12:00:00.000Z');
  });

  it('schedules/reviewLog/settings를 그대로 담는다', () => {
    const out = buildExport([schedule], [log], [setting], 'now');
    expect(out.schedules).toEqual([schedule]);
    expect(out.reviewLog).toEqual([log]);
    expect(out.settings).toEqual([setting]);
  });

  it('JSON 직렬화/역직렬화 후에도 동일하다', () => {
    const out = buildExport([schedule], [log], [setting], 'now');
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
  });
});
