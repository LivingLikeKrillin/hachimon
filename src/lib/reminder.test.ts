import { describe, it, expect } from 'vitest';
import { shouldRemind, localDateKey, type RemindInput } from './reminder';

const now = new Date(2026, 5, 24, 10, 0, 0); // 10시

function base(overrides: Partial<RemindInput> = {}): RemindInput {
  return {
    enabled: true,
    permission: 'granted',
    dueCount: 5,
    todayReviewed: 0,
    now,
    reminderHour: 9,
    lastNotifiedDate: null,
    ...overrides,
  };
}

describe('shouldRemind', () => {
  it('모든 조건 충족 → true', () => {
    expect(shouldRemind(base())).toBe(true);
  });

  it('비활성화 → false', () => {
    expect(shouldRemind(base({ enabled: false }))).toBe(false);
  });

  it('권한 미허용 → false', () => {
    expect(shouldRemind(base({ permission: 'default' }))).toBe(false);
    expect(shouldRemind(base({ permission: 'denied' }))).toBe(false);
  });

  it('due 카드 없음 → false', () => {
    expect(shouldRemind(base({ dueCount: 0 }))).toBe(false);
  });

  it('오늘 이미 복습함 → false', () => {
    expect(shouldRemind(base({ todayReviewed: 3 }))).toBe(false);
  });

  it('설정 시각 이전 → false', () => {
    expect(shouldRemind(base({ reminderHour: 11 }))).toBe(false); // 지금 10시
  });

  it('설정 시각 정각 도달 → true', () => {
    expect(shouldRemind(base({ reminderHour: 10 }))).toBe(true);
  });

  it('오늘 이미 알림 보냄 → false', () => {
    expect(shouldRemind(base({ lastNotifiedDate: localDateKey(now) }))).toBe(false);
  });

  it('어제 알림 보냄(오늘은 아직) → true', () => {
    expect(shouldRemind(base({ lastNotifiedDate: '2026-06-23' }))).toBe(true);
  });
});

describe('localDateKey', () => {
  it('로컬 YYYY-MM-DD 포맷', () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
