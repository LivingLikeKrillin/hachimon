<p align="center">
  <img src="logo.png" alt="Hachimon" width="200" />
</p>

<h1 align="center">Hachimon (八門)</h1>

<p align="center">
  기억의 문을 하나씩 여는 간격 반복 시스템
</p>

<p align="center">
  Obsidian Vault의 플래시카드를 모바일에서 SM-2로 복습하는 서버리스 PWA
</p>

---

## 개요

Hachimon은 서버 없이 동작하는 정적 PWA입니다. Obsidian 노트를 Kotlin CLI로 파싱하여 `cards.json`을 생성하고, Cloudflare Pages에 배포합니다. 브라우저의 IndexedDB에서 SM-2 스케줄링을 수행하므로 인증, DB, API 서버가 필요 없습니다.

```
Obsidian Vault (.md)
  → Kotlin CLI 파서 → cards.json (정적)
  → git push → Cloudflare Pages
  → React PWA → fetch → IndexedDB (로컬)
```

## 기술 스택

| 레이어 | 선택 |
|--------|------|
| CLI 파서 | Kotlin + GraalVM native image |
| 프레임워크 | React 18 + TypeScript (strict) |
| 스타일링 | Tailwind CSS 3 + shadcn/ui |
| 빌드 | Vite |
| 마크다운 렌더링 | react-markdown + rehype-highlight |
| 로컬 저장소 | IndexedDB (idb) |
| 코드 하이라이팅 | 커스텀 One Dark Pro (Java/Kotlin, SQL, YAML) |
| 호스팅 | Cloudflare Pages |
| 오프라인 | vite-plugin-pwa (Workbox) |
| 아이콘 | lucide-react |

## 핵심 기능

### 복습 모드 3가지

- **오늘의 복습** — SM-2 due 카드 15장 자동 선택. overdue 우선, 원탭 시작.
- **면접 훈련** — 덱 트리 + 티어 필터 + 세션 크기 조절. 맞춤형 복습.
- **새 카드 학습** — Foundation → Mechanism → Diagnosis 순차 노출.

### 3-Tier 난이도 체계

| Tier | 색상 | 의미 |
|------|------|------|
| Foundation | 🔵 Blue | 개념 확인 — 정의, 용어 |
| Mechanism | 🟡 Amber | 동작 원리 — 내부 구현, 비교 |
| Diagnosis | 🔴 Red | 실전 진단 — 트러블슈팅, 설계 판단 |

### 화면 구성

| 탭 | 내용 |
|----|------|
| Home | 오늘의 요약, 복습/면접 시작, 새 카드 알림, 약한 카드(Leech) |
| Decks | 덱 트리 (그룹 접기/펼치기), 덱 상세 바텀시트 |
| Stats | 복습 히트맵, 일별 차트, 티어별 정답률 추이 |
| Settings | 세션 설정, SM-2 파라미터, 데이터 관리 |

## CLI 파서

Kotlin CLI로 Obsidian 볼트를 파싱합니다.

```bash
$ hachimon-cli parse /path/to/vault -o ./public/cards.json
```

**파싱 규칙:**
1. `## Self-Test Anchors` 이하만 스캔
2. `#flashcard/...` 패턴으로 덱 경로 추출
3. `### Foundation` / `### Mechanism` / `### Diagnosis`로 티어 매핑
4. `질문?::답변` 형식으로 Q/A 분리
5. 답변 내 마크다운 (코드블록, 볼드, 인라인코드) 보존

## 로드맵

| 버전 | 마일스톤 |
|------|----------|
| v0.1 | CLI → cards.json → PWA 복습 세션 → Cloudflare 배포 |
| v0.2 | 면접 훈련 모드 + Home + 마크다운 렌더링 + 코드 하이라이팅 |
| v0.3 | 오프라인(SW) + 새 카드 학습 + 스와이프 + 설정 + A2HS |
| v0.4 | Decks 탭 + Stats 탭 + Web Push 리마인더 |
| v0.5 | FSRS 전환 검토, Obsidian 플러그인, 이미지 카드 |

## 브랜딩

- **이름**: Hachimon (八門, 팔문)
- **컨셉**: 나루토의 팔문둔갑술 — 복습할수록 기억의 문이 하나씩 열린다
- **도메인**: hachimon.app

## 라이선스

Private
