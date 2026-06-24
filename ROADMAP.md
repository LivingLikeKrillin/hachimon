# Hachimon Roadmap

> 현재 상태: Phase 0 완료. IndexedDB 데이터 파이프라인 연결됨. Home/Decks/Settings 실데이터 바인딩 완료.

---

## Phase 0 — 데이터 파이프라인 연결

UI와 데이터 레이어를 연결한다. 이 단계가 끝나면 mock 데이터 대신 실제 IndexedDB 데이터로 화면이 렌더링된다.

### 0-1. cards.json 샘플 데이터 생성

- [x] `public/cards.json` 샘플 파일 작성 (3개 덱, 15장 카드)
- [x] 스키마 검증 (version, decks[], cards[])

### 0-2. 데이터 페칭 + 머지

- [x] 앱 초기화 시 `cards.json` fetch
- [x] `mergeCards()` 호출하여 IndexedDB에 동기화
- [x] 로딩 상태 UI (로고 pulse + 텍스트)

### 0-3. Hooks 구현

- [x] `useDueCards()` — IndexedDB에서 오늘 복습할 카드 조회 (overdue 우선 → due 빠른 순)
- [x] `useSettings()` — IndexedDB settings 스토어 읽기/쓰기
- [ ] `useReviewSession()` — 세션 상태 관리 (Phase 1에서 구현)

### 0-4. 페이지 ↔ IndexedDB 바인딩

- [x] Home: due 카드 수, 연속 일수, 전체 카드 수를 IndexedDB에서 조회
- [x] Home: 오늘의 목표 진행률을 reviewLog에서 계산
- [x] Home: 복습 대기 Top 3를 실제 due 카드 기준으로 계산
- [x] Decks: 덱 목록을 cards 스토어에서 그룹핑
- [x] Settings: 슬라이더 값을 IndexedDB settings에 영속화

---

## Phase 1 — 복습 세션 (v0.1 MVP 핵심)

실제로 카드를 복습할 수 있게 한다.

### 1-1. 화면 전환 연결

- [x] Home "오늘의 복습 시작" → ReviewSession 전환 (`App.startReview`, due 재조회)
- [x] Home "단련" → Forge 전환
- [x] ReviewSession 완료 → SessionComplete 전환 (`finished` → useEffect로 onComplete, 렌더 중 setState 제거)
- [x] SessionComplete → Home 복귀 (`onHome`/`onRetry`)
- [x] `setScreen` 함수를 하위 컴포넌트에 전달 (prop drilling: onNavigate/onComplete/onExit 등)

### 1-2. ReviewSession 구현

- [ ] 프로그레스 바 (현재 카드 / 전체 카드)
- [ ] 질문 표시 → 탭하면 답변 공개 (flip 애니메이션)
- [ ] 하단 4버튼 평가 (Again / Hard / Good / Easy)
- [ ] 각 버튼에 다음 복습 간격 표시
- [ ] 평가 시 SM-2 `applyRating()` 호출 → schedules 업데이트
- [ ] reviewLog에 기록 저장
- [ ] 다음 카드로 이동 또는 세션 완료 전환

### 1-3. SessionComplete 구현

- [ ] 정답률 (Good+Easy / 전체)
- [ ] 소요 시간
- [ ] 티어별 결과 (Foundation/Mechanism/Diagnosis 각각 정답률)
- [ ] 틀린 카드 목록
- [ ] "재복습" 버튼 (틀린 카드만 다시)
- [ ] "홈으로" 버튼

---

## Phase 2 — 단련(鍛鍊) 모드 (v0.2)

맞춤형 복습 세션을 구성할 수 있게 한다.

### 2-1. Forge(단련) 구현

- [x] 덱 다중 선택 (체크박스, 전체 선택/해제)
- [x] 티어 필터 칩 (Foundation / Mechanism / Diagnosis 토글)
- [x] 세션 크기 슬라이더 (5~30장)
- [x] "시작" 버튼 → 선택 조건으로 카드 필터링(due 무관) → ReviewSession 진입
- [x] 선택 없음 방지 (덱·티어 각 1개 이상 + 매칭 0이면 비활성)

### 2-2. 마크다운 렌더링

- [ ] `react-markdown` + `rehype-highlight` 설치
- [ ] 답변 영역에 마크다운 파싱 적용 (코드블록, 볼드, 인라인코드, 리스트)

### 2-3. 코드 하이라이팅

- [ ] `src/lib/syntax.ts` — 커스텀 토크나이저 (Java/Kotlin, SQL/JPQL, YAML)
- [ ] One Dark Pro 테마 적용
- [ ] 코드블록에 줄 번호 + 언어 라벨 표시

---

## Phase 3 — 오프라인 + 설정 고도화 (v0.3)

PWA로서 오프라인에서도 동작하게 한다.

### 3-1. PWA 설정

- [ ] `vite-plugin-pwa` 설치 및 설정
- [ ] `manifest.json` 생성 (아이콘, theme-color, display: standalone)
- [ ] Service Worker 캐싱 전략 (cards.json: NetworkFirst, 나머지: CacheFirst)
- [ ] A2HS (홈 화면 추가) 지원 확인

### 3-2. 새 카드 학습 모드

- [x] 새 카드 감지 — `lastReviewedAt === null` (merge가 항상 초기 schedule 생성하므로 "schedules에 없는"이 아님). due 풀에서 분리.
- [x] Home에 새 카드 학습 배너 (`getNewCardCount`)
- [x] Foundation → Mechanism → Diagnosis 순차 노출 (`src/lib/newcards.ts` selectNewCards)
- [x] 일일 신규 카드 상한 적용 (`dailyNew − countIntroducedToday`)
- 퀴즈형 — 기존 ReviewSession/SessionComplete 재사용. 첫 복습 시 SM-2 풀로 자동 편입.

### 3-3. 스와이프 제스처

- [x] ReviewSession에서 좌/우 스와이프로 Again/Easy 평가 (좌→모름, 우→쉬움)
- [x] 터치 이벤트 기반 (라이브러리 없이, `src/lib/gesture.ts` resolveSwipe)

### 3-4. 약한 카드 (Leech) 탐지

- [x] reviewLog에서 3회 이상 Again 평가된 카드 조회 (`src/lib/stats.ts` findLeeches)
- [x] Home 약한 카드 섹션에 실제 데이터 표시

---

## Phase 4 — 통계 고도화 + 알림 (v0.4)

학습 데이터를 시각화하고 복습 리마인더를 보낸다.

### 4-1. Stats 실데이터 연동

- [x] 총 복습 횟수: reviewLog 전체 count
- [x] 마스터 카드 수: state === Review && stability >= 30 (FSRS 전환 후 재정의)
- [x] 평균 정답률: (Good+Easy) / 전체 reviewLog
- [x] 20주 히트맵: reviewLog.reviewedAt 기준 일별 집계 (`src/lib/stats.ts` buildHeatmap)
- [x] 30일 바 차트: 최근 30일 일별 복습량 (`src/lib/stats.ts` buildDailyVolume)
- [x] 티어별 정답률 추이: tier 기준 그룹핑 (`src/lib/stats.ts` tierAccuracy)

### 4-2. Decks 실데이터 연동

- [x] 덱 트리를 cards 스토어에서 path 기준 동적 생성 (`Decks.tsx` buildGroups + getAllCardsByDeck)
- [x] 각 덱의 카드 수, 마스터 수 실시간 계산 (getDeckMastery)
- [x] 바텀시트에서 실제 카드 미리보기

### 4-4. Settings 데이터 관리

- [x] 데이터 내보내기 — 스케줄·복습 로그·설정을 JSON 백업으로 다운로드 (`src/lib/backup.ts` buildExport)
- [x] 학습 기록 초기화 — 확인 모달 → 복습 로그 삭제 + 스케줄 초기화 (카드 유지, `resetLearningData`)

### 4-3. 복습 리마인더 (무서버 인앱 방식)

> "서버 없는 정적 PWA" 원칙 유지를 위해 진짜 Web Push(백엔드 필요) 대신 인앱 리마인더로 구현.
> 앱이 닫힌 상태 푸시는 미지원 — 향후 Cloudflare Worker 백엔드 추가 시 확장 가능.

- [x] 알림 권한 요청 (Settings 토글로 opt-in)
- [x] 설정 시각 이후 앱을 열었을 때 미복습이면 로컬 알림 1회/일 (`src/lib/reminder.ts` shouldRemind)
- [x] Home 리마인더 배너 (due 있음 + 오늘 미복습) → 탭 시 복습 시작
- [ ] (보류) 앱 닫힌 상태 정시 푸시 — Worker + Cron + VAPID 백엔드 필요

---

## Phase 5 — 알고리즘 진화 + 확장 (v0.5)

SM-2에서 FSRS로의 전환을 검토하고, Obsidian과의 통합을 강화한다.

### 5-1. FSRS 전환 (완료 — SM-2 완전 폐기)

- [x] FSRS 알고리즘 구현 — `ts-fsrs`(FSRS-6) 도입, `src/lib/fsrs.ts`. 일 단위 복습 모델에 맞춰 short-term step 비활성화.
- [x] SM-2 → FSRS 마이그레이션 로직 — `reviewLog` 시간순 리플레이로 stability/difficulty 재구성 (`src/lib/migrate.ts`, init 시 1회 가드)
- [~] 설정에서 알고리즘 선택 (SM-2 / FSRS) — **완전 전환 결정으로 대체(비목표)**. 대신 목표 기억 유지율(retention) 슬라이더 노출.

### 5-2. CLI 파서 (완료 — Node/TS, parseVault 재사용)

- [x] `scripts/parse-vault.ts` — 볼트 디렉토리 재귀 파싱 → cards.json (`parseArgs`·`collectMarkdownFiles`·`run`)
- [x] `npm run parse -- <vault> -o public/cards.json` 명령어 (`tsx` 실행)
- [x] `tsconfig.scripts.json`로 타입체크, `build`에 포함
- [~] Kotlin/GraalVM — **미채택**. `src/lib/obsidian.ts`(parseVault)가 이미 단일 진실원천이라, in-app·CLI·(향후)플러그인 3중 중복을 피하려 Node/TS 채택. "Obsidian 운용 전제"(생태계가 TS)에도 부합.

### 5-3. Obsidian 플러그인 (완료 — 내보내기 명령)

- [x] Obsidian 플러그인 포맷 (`obsidian-plugin/`, manifest/main.js, 데스크톱 전용)
- [x] 볼트 내에서 직접 cards.json 생성 — 명령/리본 → `parseVault` → 절대 경로 작성 (in-app·CLI·플러그인 단일 진실원천). 설치/사용: `docs/obsidian-plugin.md`
- [~] 카드 편집 UI — 비목표(마크다운 직접 편집과 중복). 내보내기 MVP로 한정.

### 5-4. 이미지 카드

- [ ] 답변에 이미지 첨부 지원
- [ ] 이미지 최적화 (리사이즈, WebP 변환)

---

## 우선순위 원칙

1. **Phase 0 → 1 이 최우선.** 데이터 연결 + 복습 세션이 없으면 앱이 아닌 목업이다.
2. **Phase 2는 1 직후.** 단련이 핵심 시나리오다.
3. **Phase 3~4는 병렬 가능.** PWA와 통계는 독립적이다.
4. **Phase 5는 MVP 안정화 이후.** CLI와 FSRS는 서두를 필요 없다.

```
Phase 0 (데이터 연결)
  └─▶ Phase 1 (복습 세션) ──MVP 완성──
        └─▶ Phase 2 (단련 + 마크다운)
              ├─▶ Phase 3 (오프라인 + PWA)
              └─▶ Phase 4 (통계 + 알림)
                    └─▶ Phase 5 (FSRS + CLI + 확장)
```
