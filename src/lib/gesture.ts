export type SwipeDir = 'left' | 'right' | null;

/**
 * 터치 이동량(dx, dy)을 좌/우 스와이프로 해석한다.
 * 수평 이동이 수직보다 우세하고 |dx| ≥ threshold 일 때만 방향을 반환한다.
 */
export function resolveSwipe(dx: number, dy: number, threshold = 60): SwipeDir {
  if (Math.abs(dx) < threshold) return null;
  if (Math.abs(dx) <= Math.abs(dy)) return null; // 수직 우세 → 스크롤로 간주
  return dx > 0 ? 'right' : 'left';
}
