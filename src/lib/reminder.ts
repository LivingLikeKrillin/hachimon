export type NotificationPermissionState = 'granted' | 'denied' | 'default';

export interface RemindInput {
  enabled: boolean;
  permission: NotificationPermissionState;
  dueCount: number;
  todayReviewed: number;
  now: Date;
  reminderHour: number; // 0~23 — 이 시각 이후에만 알림
  lastNotifiedDate: string | null; // 마지막 알림 로컬 날짜 (YYYY-MM-DD)
}

/** 로컬 캘린더 날짜 키 (YYYY-MM-DD) */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 앱이 열린 동안 로컬 알림을 띄울지 판단한다 (무서버 리마인더).
 * 모든 조건을 만족할 때만 true: 활성화 + 권한 허용 + due>0 + 오늘 미복습 +
 * 설정 시각 도달 + 오늘 아직 미알림.
 */
export function shouldRemind(i: RemindInput): boolean {
  if (!i.enabled) return false;
  if (i.permission !== 'granted') return false;
  if (i.dueCount <= 0) return false;
  if (i.todayReviewed > 0) return false;
  if (i.now.getHours() < i.reminderHour) return false;
  if (i.lastNotifiedDate === localDateKey(i.now)) return false;
  return true;
}
