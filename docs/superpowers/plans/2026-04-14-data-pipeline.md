# Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** mock 데이터를 제거하고 IndexedDB 기반 실제 데이터 흐름으로 전환한다. 이 플랜이 끝나면 Home, Decks, Settings 페이지가 IndexedDB에서 데이터를 읽고 쓴다.

**Architecture:** 앱 초기화 시 `cards.json`을 fetch → `mergeCards()`로 IndexedDB 동기화 → 각 페이지에서 custom hooks로 데이터 조회. 이미 구현된 `db.ts`, `merge.ts`, `sm2.ts`를 활용한다.

**Tech Stack:** React 18, TypeScript, idb (IndexedDB wrapper), Vite

---

## File Structure

| 파일 | 책임 | 상태 |
|------|------|------|
| `public/cards.json` | 샘플 카드 데이터 (3덱, 15장) | 신규 |
| `src/lib/data.ts` | cards.json fetch + mergeCards 호출 + 쿼리 함수들 | 신규 |
| `src/hooks/useCards.ts` | 앱 초기화 + 카드 데이터 로딩 상태 관리 | 신규 |
| `src/hooks/useDueCards.ts` | 오늘 due 카드 조회 | 신규 |
| `src/hooks/useSettings.ts` | settings 읽기/쓰기 | 신규 |
| `src/App.tsx` | 초기화 훅 연결, screen 전환 함수 전달 | 수정 |
| `src/pages/Home.tsx` | mock → 실데이터 바인딩 | 수정 |
| `src/pages/Decks.tsx` | mock → 실데이터 바인딩 | 수정 |
| `src/pages/Settings.tsx` | useState → useSettings 전환 | 수정 |

---

## Chunk 1: 샘플 데이터 + 데이터 레이어

### Task 1: cards.json 샘플 데이터 생성

**Files:**
- Create: `public/cards.json`

- [ ] **Step 1: 샘플 cards.json 작성**

3개 덱 (Spring Core, JPA Core, Java Concurrency), 각 5장씩 총 15장. 3-tier 고르게 분배.

```json
{
  "version": "2026-04-14T00:00:00",
  "decks": [
    { "id": "flashcard/spring/core", "name": "Spring Core", "path": ["flashcard","spring","core"], "cardCount": 5 },
    { "id": "flashcard/jpa/core", "name": "JPA Core", "path": ["flashcard","jpa","core"], "cardCount": 5 },
    { "id": "flashcard/java/concurrency", "name": "Java Concurrency", "path": ["flashcard","java","concurrency"], "cardCount": 5 }
  ],
  "cards": [
    { "id": "spring-di-f1", "deck": "flashcard/spring/core", "tier": "foundation", "question": "DI(Dependency Injection)란 무엇인가?", "answer": "객체가 필요로 하는 의존성을 외부에서 주입받는 설계 패턴. Spring에서는 IoC 컨테이너가 빈의 생성과 의존성 주입을 담당한다.", "sourceFile": "Spring-DI.md", "sourceHash": "a1b2c3" },
    { "id": "spring-bean-scope-f2", "deck": "flashcard/spring/core", "tier": "foundation", "question": "Spring Bean의 기본 스코프는?", "answer": "**Singleton**. 스프링 컨테이너당 하나의 인스턴스만 생성된다. 그 외 prototype, request, session, application 스코프가 있다.", "sourceFile": "Spring-Bean.md", "sourceHash": "d4e5f6" },
    { "id": "spring-aop-m1", "deck": "flashcard/spring/core", "tier": "mechanism", "question": "Spring AOP의 프록시 생성 방식 두 가지는?", "answer": "1. **JDK Dynamic Proxy** — 인터페이스 기반\n2. **CGLIB Proxy** — 클래스 기반 (바이트코드 조작)\n\nSpring Boot는 기본적으로 CGLIB를 사용한다.", "sourceFile": "Spring-AOP.md", "sourceHash": "g7h8i9" },
    { "id": "spring-tx-m2", "deck": "flashcard/spring/core", "tier": "mechanism", "question": "REQUIRES_NEW와 NESTED 전파 레벨의 차이는?", "answer": "- **REQUIRES_NEW**: 기존 트랜잭션을 일시 정지하고 완전히 새로운 트랜잭션을 시작한다.\n- **NESTED**: 기존 트랜잭션 내에 savepoint를 생성하여 중첩 트랜잭션을 실행한다. 내부 롤백 시 savepoint까지만 롤백된다.", "sourceFile": "Spring-Transaction.md", "sourceHash": "j0k1l2" },
    { "id": "spring-circular-d1", "deck": "flashcard/spring/core", "tier": "diagnosis", "question": "순환 참조(Circular Dependency)가 발생했을 때 해결 전략은?", "answer": "1. **설계 리팩토링** — 단방향 의존으로 변경 (가장 근본적)\n2. **@Lazy** — 지연 초기화로 순환 끊기\n3. **Setter 주입** — 생성자 주입 대신 사용 (비권장)\n\nSpring Boot 2.6+부터 순환 참조는 기본 금지된다.", "sourceFile": "Spring-DI.md", "sourceHash": "m3n4o5" },
    { "id": "jpa-entity-state-f1", "deck": "flashcard/jpa/core", "tier": "foundation", "question": "JPA 엔티티의 4가지 생명주기 상태는?", "answer": "1. **New (비영속)** — 영속성 컨텍스트와 무관\n2. **Managed (영속)** — persist() 후, 변경 감지 대상\n3. **Detached (준영속)** — 분리된 상태\n4. **Removed (삭제)** — 삭제 예정 상태", "sourceFile": "JPA-Entity.md", "sourceHash": "p6q7r8" },
    { "id": "jpa-lazy-f2", "deck": "flashcard/jpa/core", "tier": "foundation", "question": "FetchType.LAZY와 EAGER의 차이는?", "answer": "- **LAZY**: 연관 엔티티를 실제 접근 시점에 조회 (프록시 사용)\n- **EAGER**: 주 엔티티 조회 시 연관 엔티티도 즉시 함께 조회\n\n`@ManyToOne`의 기본값은 EAGER, `@OneToMany`의 기본값은 LAZY이다.", "sourceFile": "JPA-Fetch.md", "sourceHash": "s9t0u1" },
    { "id": "jpa-n1-m1", "deck": "flashcard/jpa/core", "tier": "mechanism", "question": "N+1 문제의 발생 원인과 해결 방법은?", "answer": "**원인**: 1개의 쿼리로 N개의 엔티티 조회 후, 각 엔티티의 연관 관계를 개별 쿼리로 조회하여 총 N+1개의 쿼리가 실행됨.\n\n**해결**:\n1. `JOIN FETCH` — JPQL에서 연관 엔티티를 한 번에 조회\n2. `@EntityGraph` — 어노테이션 기반 페치 전략\n3. `@BatchSize` — IN 절로 묶어서 조회", "sourceFile": "JPA-N1.md", "sourceHash": "v2w3x4" },
    { "id": "jpa-dirty-check-m2", "deck": "flashcard/jpa/core", "tier": "mechanism", "question": "JPA의 변경 감지(Dirty Checking) 동작 원리는?", "answer": "1. 엔티티를 영속성 컨텍스트에 저장할 때 **스냅샷**을 보관\n2. 트랜잭션 커밋 시(flush) 현재 엔티티와 스냅샷을 **필드 단위로 비교**\n3. 변경이 감지되면 **UPDATE SQL을 자동 생성**하여 쓰기 지연 저장소에 등록\n4. flush 시점에 DB에 반영", "sourceFile": "JPA-DirtyCheck.md", "sourceHash": "y5z6a7" },
    { "id": "jpa-osiv-d1", "deck": "flashcard/jpa/core", "tier": "diagnosis", "question": "OSIV(Open Session In View) 패턴의 장단점은?", "answer": "**장점**: View 레이어에서도 지연 로딩 가능, LazyInitializationException 방지\n\n**단점**: DB 커넥션을 뷰 렌더링까지 유지하여 **커넥션 풀 고갈 위험**. 실시간 트래픽이 높은 서비스에서는 `spring.jpa.open-in-view=false` 권장.", "sourceFile": "JPA-OSIV.md", "sourceHash": "b8c9d0" },
    { "id": "java-thread-f1", "deck": "flashcard/java/concurrency", "tier": "foundation", "question": "Thread와 Runnable의 차이는?", "answer": "- **Thread**: 클래스 상속. Java는 단일 상속이므로 다른 클래스를 상속할 수 없음.\n- **Runnable**: 인터페이스 구현. 다중 구현 가능, 실행 로직과 스레드 제어를 분리.", "sourceFile": "Java-Thread.md", "sourceHash": "e1f2g3" },
    { "id": "java-volatile-f2", "deck": "flashcard/java/concurrency", "tier": "foundation", "question": "volatile 키워드의 역할은?", "answer": "변수의 값을 **CPU 캐시가 아닌 메인 메모리에서 읽고 쓰도록** 보장한다. 가시성(visibility)은 보장하지만 원자성(atomicity)은 보장하지 않는다.", "sourceFile": "Java-Volatile.md", "sourceHash": "h4i5j6" },
    { "id": "java-cas-m1", "deck": "flashcard/java/concurrency", "tier": "mechanism", "question": "CAS(Compare-And-Swap) 연산의 동작 원리는?", "answer": "1. 메모리 위치의 **현재 값**을 읽음\n2. **기대 값**(expected)과 비교\n3. 같으면 **새 값**으로 교체, 다르면 실패\n\n`AtomicInteger` 등 `java.util.concurrent.atomic` 패키지가 CAS 기반. Lock-free 알고리즘의 핵심.", "sourceFile": "Java-CAS.md", "sourceHash": "k7l8m9" },
    { "id": "java-pool-m2", "deck": "flashcard/java/concurrency", "tier": "mechanism", "question": "ThreadPoolExecutor의 핵심 파라미터 3가지는?", "answer": "1. **corePoolSize** — 기본 유지 스레드 수\n2. **maximumPoolSize** — 최대 스레드 수\n3. **workQueue** — 작업 대기 큐 (LinkedBlockingQueue, SynchronousQueue 등)\n\n동작: core 초과 → 큐에 적재 → 큐 가득 참 → max까지 스레드 생성 → 거부 정책 실행", "sourceFile": "Java-ThreadPool.md", "sourceHash": "n0o1p2" },
    { "id": "java-deadlock-d1", "deck": "flashcard/java/concurrency", "tier": "diagnosis", "question": "데드락이 발생하는 4가지 조건과 예방 전략은?", "answer": "**4가지 조건 (Coffman)**:\n1. 상호 배제 (Mutual Exclusion)\n2. 점유 대기 (Hold and Wait)\n3. 비선점 (No Preemption)\n4. 순환 대기 (Circular Wait)\n\n**예방**: Lock 획득 순서를 전역적으로 통일 (순환 대기 제거). `tryLock(timeout)` 사용으로 점유 대기 제거.", "sourceFile": "Java-Deadlock.md", "sourceHash": "q3r4s5" }
  ]
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npx vite build`
Expected: 빌드 성공, cards.json이 dist에 포함

- [ ] **Step 3: Commit**

```bash
git add public/cards.json
git commit -m "feat: add sample cards.json with 3 decks, 15 cards"
```

---

### Task 2: 데이터 쿼리 레이어 (data.ts)

**Files:**
- Create: `src/lib/data.ts`

- [ ] **Step 1: data.ts 작성**

cards.json fetch, IndexedDB 쿼리 함수들을 모은다. 기존 `db.ts`(스키마), `merge.ts`(머지 로직)는 그대로 활용.

```typescript
import type { Card, Schedule, CardsData } from '@/types';
import { getDB } from './db';
import { mergeCards } from './merge';

export async function initializeCards(): Promise<void> {
  const res = await fetch('/cards.json');
  const data: CardsData = await res.json();
  await mergeCards(data);
}

export async function getDueCards(limit: number = 15): Promise<(Card & { schedule: Schedule })[]> {
  const db = await getDB();
  const now = new Date().toISOString();

  const allSchedules = await db.getAll('schedules');
  const due = allSchedules
    .filter((s) => s.nextReviewAt <= now)
    .sort((a, b) => a.nextReviewAt.localeCompare(b.nextReviewAt));

  const limited = due.slice(0, limit);
  const results: (Card & { schedule: Schedule })[] = [];

  for (const schedule of limited) {
    const card = await db.get('cards', schedule.cardId);
    if (card) {
      results.push({ ...card, schedule });
    }
  }

  return results;
}

export async function getTotalCardCount(): Promise<number> {
  const db = await getDB();
  return db.count('cards');
}

export async function getDueCount(): Promise<number> {
  const db = await getDB();
  const now = new Date().toISOString();
  const all = await db.getAll('schedules');
  return all.filter((s) => s.nextReviewAt <= now).length;
}

export async function getTodayReviewCount(): Promise<number> {
  const db = await getDB();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  const all = await db.getAll('reviewLog');
  return all.filter((r) => r.reviewedAt >= todayStr).length;
}

export async function getStreak(): Promise<number> {
  const db = await getDB();
  const logs = await db.getAll('reviewLog');
  if (logs.length === 0) return 0;

  const days = new Set(
    logs.map((r) => r.reviewedAt.slice(0, 10))
  );

  let streak = 0;
  const d = new Date();
  // 오늘 복습이 있으면 오늘부터, 없으면 어제부터
  const todayStr = d.toISOString().slice(0, 10);
  if (!days.has(todayStr)) {
    d.setDate(d.getDate() - 1);
  }

  while (days.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  return streak;
}

export async function getDueByDeck(): Promise<{ deckId: string; name: string; count: number }[]> {
  const db = await getDB();
  const now = new Date().toISOString();
  const schedules = await db.getAll('schedules');
  const dueCardIds = new Set(
    schedules.filter((s) => s.nextReviewAt <= now).map((s) => s.cardId)
  );

  const cards = await db.getAll('cards');
  const deckCounts = new Map<string, number>();

  for (const card of cards) {
    if (dueCardIds.has(card.id)) {
      deckCounts.set(card.deck, (deckCounts.get(card.deck) || 0) + 1);
    }
  }

  return Array.from(deckCounts.entries())
    .map(([deckId, count]) => ({
      deckId,
      name: deckId.split('/').pop() || deckId,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const db = await getDB();
  const row = await db.get('settings', key);
  if (!row) return defaultValue;
  return JSON.parse(row.value) as T;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put('settings', { key, value: JSON.stringify(value) });
}

export async function getAllCardsByDeck(): Promise<Map<string, Card[]>> {
  const db = await getDB();
  const cards = await db.getAll('cards');
  const map = new Map<string, Card[]>();
  for (const card of cards) {
    const list = map.get(card.deck) || [];
    list.push(card);
    map.set(card.deck, list);
  }
  return map;
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/data.ts
git commit -m "feat: add data query layer (fetch, due cards, streak, settings)"
```

---

### Task 3: Hooks 구현

**Files:**
- Create: `src/hooks/useCards.ts`
- Create: `src/hooks/useDueCards.ts`
- Create: `src/hooks/useSettings.ts`

- [ ] **Step 1: useCards.ts 작성**

앱 초기화: cards.json fetch → merge → 로딩 상태 관리.

```typescript
import { useState, useEffect } from 'react';
import { initializeCards } from '@/lib/data';

export function useCards() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeCards()
      .then(() => setLoading(false))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load cards');
        setLoading(false);
      });
  }, []);

  return { loading, error };
}
```

- [ ] **Step 2: useDueCards.ts 작성**

```typescript
import { useState, useEffect, useCallback } from 'react';
import type { Card, Schedule } from '@/types';
import { getDueCards, getDueCount, getTotalCardCount, getTodayReviewCount, getStreak, getDueByDeck } from '@/lib/data';

interface HomeStats {
  dueCount: number;
  streak: number;
  totalCards: number;
  todayReviewed: number;
  dueByDeck: { deckId: string; name: string; count: number }[];
}

export function useDueCards(limit: number = 15) {
  const [cards, setCards] = useState<(Card & { schedule: Schedule })[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await getDueCards(limit);
    setCards(result);
    setLoading(false);
  }, [limit]);

  useEffect(() => { refresh(); }, [refresh]);

  return { cards, loading, refresh };
}

export function useHomeStats() {
  const [stats, setStats] = useState<HomeStats>({
    dueCount: 0,
    streak: 0,
    totalCards: 0,
    todayReviewed: 0,
    dueByDeck: [],
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [dueCount, streak, totalCards, todayReviewed, dueByDeck] = await Promise.all([
      getDueCount(),
      getStreak(),
      getTotalCardCount(),
      getTodayReviewCount(),
      getDueByDeck(),
    ]);
    setStats({ dueCount, streak, totalCards, todayReviewed, dueByDeck });
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { stats, loading, refresh };
}
```

- [ ] **Step 3: useSettings.ts 작성**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { getSetting, setSetting } from '@/lib/data';

export interface AppSettings {
  dailyNew: number;
  dailyReview: number;
  sessionSize: number;
  initialEF: number;
  minEF: number;
}

const DEFAULTS: AppSettings = {
  dailyNew: 10,
  dailyReview: 50,
  sessionSize: 15,
  initialEF: 2.5,
  minEF: 1.3,
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSetting<AppSettings>('appSettings', DEFAULTS)
      .then((s) => { setSettings(s); setLoading(false); });
  }, []);

  const update = useCallback(async (partial: Partial<AppSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    await setSetting('appSettings', next);
  }, [settings]);

  return { settings, loading, update };
}
```

- [ ] **Step 4: 타입 체크**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCards.ts src/hooks/useDueCards.ts src/hooks/useSettings.ts
git commit -m "feat: add hooks (useCards, useDueCards, useHomeStats, useSettings)"
```

---

## Chunk 2: 페이지 바인딩

### Task 4: App.tsx 초기화 연결

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: useCards 연결 + 로딩 UI 추가**

App.tsx에서 `useCards()`를 호출하여 앱 시작 시 cards.json을 로드. 로딩 중에는 간단한 로딩 화면 표시.

```typescript
import { useState } from 'react';
import type { Tab, Screen } from '@/types';
import { useCards } from '@/hooks/useCards';
import TabBar from '@/components/layout/TabBar';
import Home from '@/pages/Home';
import Decks from '@/pages/Decks';
import Stats from '@/pages/Stats';
import Settings from '@/pages/Settings';
import ReviewSession from '@/pages/ReviewSession';
import InterviewFilter from '@/pages/InterviewFilter';
import SessionComplete from '@/pages/SessionComplete';

export default function App() {
  const { loading, error } = useCards();
  const [tab, setTab] = useState<Tab>('home');
  const [screen, setScreen] = useState<Screen>('tabs');

  if (loading) {
    return (
      <div className="w-full max-w-[393px] mx-auto min-h-svh flex items-center justify-center">
        <div className="text-center space-y-3">
          <img src="/logo.png" alt="Hachimon" className="w-16 h-16 rounded-2xl mx-auto animate-pulse" />
          <p className="text-[14px] text-zinc-400">카드 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-[393px] mx-auto min-h-svh flex items-center justify-center px-4">
        <div className="text-center space-y-2">
          <p className="text-[16px] font-semibold text-red-400">로딩 실패</p>
          <p className="text-[13px] text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  if (screen === 'review') {
    return <ReviewSession />;
  }
  if (screen === 'interview') {
    return <InterviewFilter />;
  }
  if (screen === 'complete') {
    return <SessionComplete />;
  }

  const pages: Record<Tab, React.ReactNode> = {
    home: <Home onNavigate={setScreen} />,
    decks: <Decks />,
    stats: <Stats />,
    settings: <Settings />,
  };

  return (
    <>
      <div key={tab} className="animate-tab-in">
        {pages[tab]}
      </div>
      <TabBar active={tab} onChange={setTab} />
    </>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: Home에 `onNavigate` prop이 없어서 타입 에러 발생 — 다음 task에서 수정

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire useCards initialization + loading/error UI in App"
```

---

### Task 5: Home 페이지 실데이터 바인딩

**Files:**
- Modify: `src/pages/Home.tsx`

- [ ] **Step 1: mock 데이터를 hooks로 교체**

```typescript
import { Flame, Sparkles, AlertTriangle, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Screen } from '@/types';
import PageLayout from '@/components/layout/PageLayout';
import SectionLabel from '@/components/shared/SectionLabel';
import StatRow from '@/components/shared/StatRow';
import ProgressBar from '@/components/shared/ProgressBar';
import { useHomeStats } from '@/hooks/useDueCards';
import { useSettings } from '@/hooks/useSettings';

const GATE_COLORS = ['var(--gate-1)', 'var(--gate-5)', 'var(--gate-7)', 'var(--gate-3)', 'var(--gate-6)'];

interface HomeProps {
  onNavigate: (screen: Screen) => void;
}

export default function Home({ onNavigate }: HomeProps) {
  const { stats, loading } = useHomeStats();
  const { settings } = useSettings();

  if (loading) return <PageLayout><div /></PageLayout>;

  return (
    <PageLayout>
      {/* Stats summary */}
      <div className="animate-up stagger-1">
        <StatRow
          items={[
            { value: stats.dueCount, label: '오늘 복습', color: 'text-blue-400' },
            { value: stats.streak, label: '연속 일수', color: 'text-amber-400' },
            { value: stats.totalCards.toLocaleString(), label: '전체 카드' },
          ]}
        />
      </div>

      {/* Daily goal */}
      <Card className="animate-up stagger-2">
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-[14px] text-zinc-300">오늘의 목표</p>
            <p className="font-display text-[16px] font-bold tabular-nums">
              <span className="text-blue-400">{stats.todayReviewed}</span>
              <span className="text-zinc-500 mx-1">/</span>
              <span>{settings.sessionSize}</span>
            </p>
          </div>
          <ProgressBar value={stats.todayReviewed} max={settings.sessionSize} color="#60a5fa" h="h-2" />
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="space-y-2.5 animate-up stagger-3">
        <button
          onClick={() => onNavigate('review')}
          className="w-full h-[52px] rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white transition-all duration-150 active:scale-[0.96] active:from-blue-700 active:to-blue-600 active:shadow-none"
          style={{ boxShadow: '0 2px 12px rgba(37, 99, 235, 0.15)' }}
        >
          <Sparkles size={18} />
          오늘의 복습 시작
        </button>
        <button
          onClick={() => onNavigate('interview')}
          className="w-full h-[52px] rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2.5 bg-zinc-900 border border-zinc-800 text-zinc-200 transition-all duration-150 active:scale-[0.96] active:bg-zinc-800"
        >
          <Flame size={18} className="text-amber-500" />
          면접 훈련 모드
        </button>
      </div>

      {/* Due decks */}
      {stats.dueByDeck.length > 0 && (
        <div className="animate-up stagger-4">
          <SectionLabel>복습 대기 Top 3</SectionLabel>
          <Card>
            <CardContent className="p-0">
              {stats.dueByDeck.map((deck, i) => (
                <div
                  key={deck.deckId}
                  className={`flex justify-between items-center px-4 py-3.5 group cursor-pointer transition-colors hover:bg-zinc-800/30 ${
                    i < stats.dueByDeck.length - 1 ? 'border-b border-zinc-800/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-1 h-6 rounded-full"
                      style={{ background: GATE_COLORS[i % GATE_COLORS.length] }}
                    />
                    <span className="text-[14px] text-zinc-200">{deck.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-display text-[14px] font-semibold tabular-nums" style={{ color: GATE_COLORS[i % GATE_COLORS.length] }}>
                      {deck.count}
                    </span>
                    <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Leech warning */}
      <div className="animate-up stagger-5">
        <SectionLabel>약한 카드</SectionLabel>
        <Card className="glow-amber">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-amber-400" />
            </div>
            <div className="space-y-1">
              <p className="text-[14px] text-zinc-200">
                거머리 카드 탐지는 복습 데이터 축적 후 활성화됩니다
              </p>
              <p className="text-[12px] text-zinc-400">복습을 시작하세요</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS

- [ ] **Step 3: 브라우저에서 확인**

Home에서 실제 IndexedDB 데이터 표시 확인:
- 오늘 복습: 15 (모든 카드가 due)
- 연속 일수: 0
- 전체 카드: 15
- 복습 대기 Top 3: 실제 덱 이름 표시

- [ ] **Step 4: Commit**

```bash
git add src/pages/Home.tsx
git commit -m "feat: bind Home page to IndexedDB data via hooks"
```

---

### Task 6: Decks 페이지 실데이터 바인딩

**Files:**
- Modify: `src/pages/Decks.tsx`

- [ ] **Step 1: mock 배열을 IndexedDB 쿼리로 교체**

기존 하드코딩된 `groups[]` 배열을 `getAllCardsByDeck()`으로 교체. 덱 트리를 동적으로 생성한다.

핵심 변경:
- `groups` 상수 → `useEffect`로 `getAllCardsByDeck()` 호출
- 덱 ID 경로 (`flashcard/spring/core`)에서 그룹명 추출 (`path[1]`)
- 각 덱의 cardCount, mastered 수를 schedules에서 계산

- [ ] **Step 2: 타입 체크 + 브라우저 확인**

Run: `npx tsc -p tsconfig.app.json --noEmit`
cards.json의 3개 덱이 트리에 표시되는지 확인

- [ ] **Step 3: Commit**

```bash
git add src/pages/Decks.tsx
git commit -m "feat: bind Decks page to IndexedDB data"
```

---

### Task 7: Settings 페이지 영속화

**Files:**
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: useState → useSettings 전환**

기존 5개의 `useState` 호출을 `useSettings()` 훅으로 교체. 슬라이더 변경 시 `update()`로 IndexedDB에 저장.

핵심 변경:
- `const [dailyNew, setDailyNew] = useState(10)` 등 5개 제거
- `const { settings, update } = useSettings()` 사용
- `onChange={setDailyNew}` → `onChange={(v) => update({ dailyNew: v })}`
- 프리셋 클릭 시 `update({ dailyNew: n, dailyReview: r, sessionSize: s })`

- [ ] **Step 2: 타입 체크 + 브라우저 확인**

Run: `npx tsc -p tsconfig.app.json --noEmit`
슬라이더 조절 → 다른 탭 갔다 와도 값 유지되는지 확인

- [ ] **Step 3: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat: persist Settings to IndexedDB via useSettings hook"
```

---

### Task 8: 최종 확인 + 빌드

- [ ] **Step 1: 타입 체크**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS

- [ ] **Step 2: 빌드**

Run: `npx vite build`
Expected: 빌드 성공, 경고 없음

- [ ] **Step 3: 브라우저 전체 점검**

- 앱 시작 시 로딩 화면 → 카드 로드 완료
- Home: 실제 due 카드 수, 전체 15장, 연속 0일
- Decks: 3개 덱 (Spring Core, JPA Core, Java Concurrency) 동적 표시
- Settings: 슬라이더 값 변경 → 탭 이동 → 값 유지

- [ ] **Step 4: 최종 커밋**

```bash
git add -A
git commit -m "feat: complete Phase 0 — data pipeline connected"
```
