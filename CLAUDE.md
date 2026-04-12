# Hachimon — 개인용 지식 복습 PWA

> 八門遁甲 (팔문둔갑) — 기억의 문을 하나씩 여는 간격 반복 시스템.
> Obsidian Vault의 1,235장 플래시카드를 모바일에서 SM-2로 복습한다.

## 프로젝트 개요

Hachimon은 서버 없는 정적 PWA다. Obsidian 노트를 Kotlin CLI로 파싱하여 `cards.json`을 생성하고, Cloudflare Pages에 배포한다. 브라우저의 IndexedDB에서 SM-2 스케줄링을 수행하므로 인증, DB, API 서버가 없다.

도메인: hachimon.app

```
Obsidian Vault (.md)
  → Kotlin CLI 파서 → cards.json (정적)
  → git push → Cloudflare Pages
  → React PWA → fetch → IndexedDB (로컬)
```

## 기술 스택

| 레이어 | 선택 |
|--------|------|
| CLI 파서 | Kotlin (GraalVM native) |
| 프레임워크 | React + TypeScript |
| 스타일링 | Tailwind CSS + shadcn/ui |
| 빌드 | Vite |
| 마크다운 렌더링 | react-markdown + rehype-highlight |
| 로컬 저장소 | IndexedDB (idb 라이브러리) |
| 호스팅 | Cloudflare Pages |
| 오프라인 | vite-plugin-pwa (Workbox) |
| 아이콘 | lucide-react |

## 디렉토리 구조 (예상)

```
hachimon/
├── cli/                        # Kotlin CLI 파서
│   └── src/main/kotlin/
├── src/
│   ├── components/
│   │   ├── ui/                 # shadcn/ui 컴포넌트
│   │   ├── layout/             # TabBar, PageLayout
│   │   ├── review/             # ReviewCard, RatingButtons, ProgressHeader
│   │   └── shared/             # SectionLabel, StatRow, ProgressBar, TierBadge
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Decks.tsx
│   │   ├── Stats.tsx
│   │   ├── Settings.tsx
│   │   ├── ReviewSession.tsx
│   │   ├── InterviewFilter.tsx
│   │   └── SessionComplete.tsx
│   ├── lib/
│   │   ├── sm2.ts              # SM-2 알고리즘
│   │   ├── db.ts               # IndexedDB (idb) 래퍼
│   │   ├── merge.ts            # cards.json ↔ IndexedDB 머지
│   │   └── syntax.ts           # 코드 하이라이팅 (Java/Kotlin, SQL, YAML)
│   ├── hooks/
│   │   ├── useReviewSession.ts
│   │   ├── useDueCards.ts
│   │   └── useSettings.ts
│   ├── types/
│   │   └── index.ts            # Card, Deck, Schedule, ReviewLog 타입
│   ├── App.tsx
│   └── main.tsx
├── public/
│   └── cards.json              # CLI 파서 출력물 (정적)
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## 핵심 도메인 모델

### cards.json 스키마

```json
{
  "version": "2026-04-09T14:30:00",
  "decks": [{ "id": "flashcard/spring/core", "name": "Spring Core", "path": ["flashcard","spring","core"], "cardCount": 87 }],
  "cards": [{ "id": "spring-tx-propagation-f1", "deck": "flashcard/spring/core", "tier": "foundation", "question": "...", "answer": "...", "sourceFile": "Spring-Transaction.md", "sourceHash": "a3f2c1" }]
}
```

카드 ID 규칙: `{노트파일명}-{tier약자}-{순번}` (예: `spring-tx-propagation-f1`)

### 3-tier 난이도 체계

| Tier | 색상 | 의미 |
|------|------|------|
| Foundation | blue (#60a5fa) | 개념 확인 — 정의, 용어 |
| Mechanism | amber (#fbbf24) | 동작 원리 — 내부 구현, 비교 |
| Diagnosis | red (#f87171) | 실전 진단 — 트러블슈팅, 설계 판단 |

### SM-2 알고리즘

```typescript
interface Schedule {
  easeFactor: number;    // 초기 2.5, 최소 1.3
  interval: number;      // 일 단위
  repetitions: number;
  nextReviewAt: string;  // ISO date
  lastReviewedAt: string | null;
}

// quality 매핑: Again=0, Hard=2, Good=4, Easy=5
// quality < 3 → repetitions 리셋, interval = 1
// quality >= 3 → rep 0이면 interval=1, rep 1이면 interval=6, 이후 interval * EF
```

### IndexedDB 스토어

```
cards:     { id, deck, tier, question, answer, sourceHash }
schedules: { cardId, easeFactor, interval, repetitions, nextReviewAt, lastReviewedAt }
reviewLog: { cardId, quality, reviewedAt, sessionId }
settings:  { key, value }
```

### 머지 로직 (cards.json → IndexedDB)

| 상태 | 동작 |
|------|------|
| 서버에 있고 로컬에 없음 | 새 카드로 추가, SM-2 초기 상태 |
| 로컬에 있고 서버에 없음 | 삭제 (스케줄 포함) |
| 같은 ID, sourceHash 다름 | question/answer만 갱신, SM-2 스케줄 유지 |
| 같은 ID, sourceHash 동일 | 무시 |

## 복습 모드 3가지

1. **오늘의 복습** — SM-2 due 카드 15장 자동 선택. overdue 우선 → due 빠른 순. 원탭 시작.
2. **면접 훈련** — 덱 트리 + 티어 필터 + 세션 크기 조절. 핵심 시나리오.
3. **새 카드 학습** — cards.json 갱신 시 새 카드 감지. Foundation → Mechanism → Diagnosis 순차 노출.

## UI/UX 규칙

### 모바일 최적화 (iPhone 393px 기준)

```
Page padding:       px-4 (16px)
Section gap:        space-y-4 (16px)
Card padding:       p-4 (16px)
Tab bar height:     82px (48px nav + 34px iOS safe area)
Page bottom pad:    pb-24 (96px — tab bar + 여유)
Touch targets:      min-h-[44px]
Max container:      max-w-[393px] mx-auto
```

### 디자인 토큰

- 배경: zinc-950 (#09090b)
- 카드 배경: zinc-900 (#18181b) — shadcn Card 기본
- 보더: zinc-800 (#27272a)
- 1차 텍스트: zinc-50 (#fafafa)
- 2차 텍스트: zinc-400 (#a1a1aa)
- 3차 텍스트: zinc-500 (#71717a)
- 라벨: zinc-600 (#52525b)
- 프라이머리 액션: blue-600 (#2563eb)
- 섹션 라벨: text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3

### 폰트 사이즈 체계 (명시적 px)

```
text-[11px]  — 라벨, 서브텍스트, 메타
text-[12px]  — 보조 정보
text-[13px]  — 본문 소
text-[14px]  — 본문
text-[15px]  — 버튼 텍스트
text-[16px]  — 카드 질문
text-xl      — 페이지 제목
text-2xl     — 앱 타이틀
```

### 공유 컴포넌트

```tsx
// 섹션 레이블 — 모든 카드 섹션 상단에 통일
const SectionLabel = ({ children }) => (
  <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">{children}</p>
);

// 3칸/2칸 스탯 요약 — Home, Stats, DeckDetail에서 재사용
const StatRow = ({ items }) => (
  <Card>
    <CardContent className="p-4">
      <div className="grid divide-x divide-zinc-800" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((s, i) => (
          <div key={i} className="text-center px-2">
            <p className={`text-lg font-bold tabular-nums ${s.color || "text-zinc-100"}`}>{s.value}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

// 프로그레스 바 — 정답률, 마스터리, 목표 진행
const ProgressBar = ({ value, max, color, h = "h-1" }) => (
  <div className={`w-full ${h} bg-zinc-800 rounded-full overflow-hidden`}>
    <div className={`${h} rounded-full transition-all duration-500`}
      style={{ width: `${Math.min((value / max) * 100, 100)}%`, background: color }} />
  </div>
);

// 티어 뱃지 — Foundation(파랑) / Mechanism(앰버) / Diagnosis(레드)
const TierBadge = ({ tier, full = false }) => {
  const cfg = {
    foundation: { label: "F", full: "Foundation", bg: "bg-blue-500/15", text: "text-blue-400", dot: "bg-blue-400" },
    mechanism:  { label: "M", full: "Mechanism",  bg: "bg-amber-500/15", text: "text-amber-400", dot: "bg-amber-400" },
    diagnosis:  { label: "D", full: "Diagnosis",  bg: "bg-red-500/15", text: "text-red-400", dot: "bg-red-400" },
  }[tier];
  // full=true 면 텍스트 포함, false 면 약자만
};
```

### 코드 신택스 하이라이팅

답변 내 코드블록에 One Dark Pro 테마 적용. 커스텀 토크나이저로 Java/Kotlin, YAML, SQL/JPQL 지원.

```
keyword:     #ff7b72
type:        #79c0ff
string:      #a5d6ff
annotation:  #d2a8ff
comment:     #6e7681
number:      #79c0ff
property:    #7ee787
punctuation: #b1bac4
plain:       #e6edf3
gutter:      #484f58
```

### 탭 바

```tsx
<nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[393px] bg-zinc-950/95 backdrop-blur border-t border-zinc-800/60">
  <div className="flex justify-around h-12">
    {/* 각 탭: min-w-[64px] min-h-[48px] */}
  </div>
  <div className="h-[34px]" /> {/* iOS Home Indicator safe area */}
</nav>
```

### 복습 세션 레이팅 버튼

하단 고정, 그래디언트 페이드 배경:

```tsx
<div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[393px] px-4 pb-6 pt-3 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent">
  <div className="grid grid-cols-4 gap-2">
    {/* Again(red) / Hard(amber) / Good(blue) / Easy(emerald) */}
    {/* 각 버튼: min-h-[44px] + 다음 간격 표시 */}
  </div>
</div>
```

## 화면 구성 (4탭 + 3 플로우)

### 탭

| 탭 | 내용 |
|----|------|
| Home | 3칸 요약(due/streak/total), 오늘의 목표 진행률, 복습·면접 버튼, 새 카드 알림, Due Top 3 덱, 약한 카드(Leech) |
| Decks | 55개 덱 트리 (그룹 접기/펼치기), 탭 → 덱 상세 바텀시트 (카드 미리보기) |
| Stats | 총 복습/마스터/정답률, 복습 히트맵(20주 CSS grid), 일별 복습량(30일 바 차트), 티어별 정답률 추이 |
| Settings | 세션 설정 슬라이더(일일 신규/복습 상한/세션 크기), SM-2 파라미터(초기 EF/최소 EF), 데이터 관리(리셋/내보내기) |

### 플로우 화면

| 화면 | 진입 | 내용 |
|------|------|------|
| InterviewFilter | Home → "면접 훈련 모드" | 덱 선택(다중) + 티어 칩 + 세션 크기 + 시작 버튼 |
| ReviewSession | Home → "오늘의 복습 시작" 또는 InterviewFilter → "시작" | 프로그레스 바 + 질문 → 탭 → 답변(마크다운) + 4단계 평가 |
| SessionComplete | ReviewSession 완료 | 정답률, 소요시간, 티어별 결과, 틀린 카드, 재복습/홈 버튼 |

## 설정 기본값

| 항목 | 기본값 | 범위 |
|------|--------|------|
| 일일 신규 카드 | 10장 | 0~30 |
| 일일 복습 상한 | 50장 | 10~200 |
| 세션당 카드 수 | 15장 | 5~30 |
| SM-2 초기 EF | 2.5 | 1.3~3.0 |
| SM-2 최소 EF | 1.3 | 1.0~2.0 |

## CLI 파서 (Kotlin)

### 파싱 규칙
1. `## Self-Test Anchors` 이하만 스캔
2. `#flashcard/...` 패턴 → 덱 경로 추출
3. `### Foundation` / `### Mechanism` / `### Diagnosis` → 티어 매핑
4. `질문?::답변` → question/answer 분리
5. 답변 내 마크다운 (코드블록, 볼드, 인라인코드) 보존

### 실행
```bash
$ hachimon-cli parse /path/to/vault -o ./public/cards.json
```

## 브랜딩

이름: Hachimon (八門, 팔문)
컨셉: 나루토의 팔문둔갑술. 복습할수록 기억의 문이 하나씩 열린다.
색상: 1문(blue) → 8문(crimson) 그래디언트 진행.
로고: `logo.png`

## 코딩 컨벤션

- 언어: TypeScript strict mode
- 컴포넌트: 함수형 컴포넌트 + hooks. default export.
- 네이밍: PascalCase(컴포넌트), camelCase(함수/변수), UPPER_SNAKE(상수)
- CSS: Tailwind utility only. 커스텀 CSS 최소화. shadcn/ui 컴포넌트 우선 사용.
- 타입: `interface` 우선 (type은 유니온/교차에만)
- 상태: 단순 로컬 → useState. 복잡/공유 → Context + useReducer.
- IndexedDB: idb 래퍼로 접근. 직접 IDBTransaction 사용 금지.
- 에러 핸들링: IndexedDB, fetch 호출에 try-catch 필수.
- 커밋: conventional commits (feat/fix/refactor/docs/chore)

## 마일스톤

- **v0.1 (MVP)** — 파이프라인 관통: CLI → cards.json → PWA 복습 세션 → Cloudflare 배포
- **v0.2** — 면접 훈련 모드 + Home/세션완료 + 마크다운 렌더링 + 코드 하이라이팅
- **v0.3** — 오프라인(SW) + 새 카드 학습 + 스와이프 제스처 + 설정 + A2HS
- **v0.4** — Decks 탭 + Stats 탭 + Web Push 리마인더
- **v0.5** — FSRS 전환 검토, Obsidian 플러그인, 이미지 카드
