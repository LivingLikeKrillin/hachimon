# Hachimon Obsidian 플러그인

Obsidian 안에서 명령 한 번으로 현재 볼트의 플래시카드를 `cards.json`으로 내보내는 **데스크톱 전용** 플러그인입니다. 터미널 없이 노트를 쓰던 자리에서 곧장 repo의 `public/cards.json`을 갱신하고 배포할 수 있습니다.

```
Obsidian Vault  →  [플러그인: Generate cards.json]  →  설정한 절대 경로(예: .../public/cards.json)  →  git push  →  Cloudflare
```

> 인앱 가져오기(설정 → Obsidian Vault 가져오기)와 **동일한 파서**(`parseVault`)를 씁니다. 그래서 플러그인으로 구운 결과와 인앱 결과의 카드 id·해시·덱 집계가 동일합니다. 빌드타임 CLI(`npm run parse`)와도 같습니다.

## 설치 (수동)

1. `obsidian-plugin/`의 **`manifest.json`** 과 **`main.js`** 두 파일을 Obsidian 볼트의 다음 위치로 복사합니다:
   ```
   <당신의 Vault>/.obsidian/plugins/hachimon/
   ```
   (`hachimon` 폴더가 없으면 만드세요. `main.js`는 repo에 빌드된 채로 커밋돼 있어 별도 빌드가 필요 없습니다.)
2. Obsidian → **설정 → 커뮤니티 플러그인**에서 **Hachimon**을 활성화합니다.
   - "제한 모드(Restricted/Safe mode)"가 켜져 있으면 먼저 끕니다.

> 데스크톱 전용입니다(파일시스템 절대 경로에 직접 씀). iPhone/Android에서는 동작하지 않습니다 — 모바일은 인앱 가져오기를 쓰세요.

## 설정

플러그인 설정 탭에서 **출력 경로(절대)** 를 지정합니다. 예:

```
C:/Users/you/Desktop/.../hachimon/public/cards.json
/Users/you/dev/hachimon/public/cards.json
```

상대 경로나 빈 값이면 실행 시 안내가 뜨고 아무것도 쓰지 않습니다.

## 사용

- 왼쪽 리본의 **다운로드 아이콘** 클릭, 또는 명령 팔레트(`Ctrl/Cmd+P`)에서 **`Generate cards.json`** 실행.
- 성공하면 `✓ N decks / M cards / 이미지 K장 → <경로>` 알림이 뜨고 해당 경로에 `cards.json`이 작성됩니다.
- 답변 속 이미지(`![[img.png]]` / `![](img.png)`)는 볼트에서 찾아 자동 인라인됩니다 — 가로 800px 리사이즈 + WebP(q80)로 최적화해 base64로 박아 넣고(SVG는 벡터 그대로), 외부 `http(s)·data:` URL은 건드리지 않습니다. 같은 basename의 이미지가 여럿이면 첫 매치를 씁니다. 못 찾으면 경고가 뜨고 원본 표기를 유지합니다.
- 같은 파일명이 여러 폴더에 있으면 id 충돌 가능 경고가 뜹니다(작성은 계속됨).
- 카드를 못 찾으면(노트 포맷 문제) 에러 알림이 뜨고 파일은 쓰지 않습니다.

작성된 `cards.json`을 `git commit` → `push` 하면 Cloudflare Pages에 배포됩니다.

## 노트 작성 포맷

인앱 가져오기와 동일합니다 — `## Self-Test Anchors` 이하의 `#flashcard/…` 덱 태그, `### Foundation|Mechanism|Diagnosis` 티어, `질문?::답변` 줄. 자세한 규칙은 [Obsidian 연동 가이드](obsidian-guide.md)를 참고하세요.

## 카드를 고친 뒤

Obsidian에서 카드를 추가·수정한 뒤 명령을 다시 실행하면 `cards.json`이 새로 작성됩니다. 앱(또는 인앱 가져오기)의 머지 로직이 복습 일정을 유지하므로, 다시 배포·가져오기해도 진도는 사라지지 않습니다.

## 소스 변경 시 (개발)

플러그인 코드(`obsidian-plugin/*.ts`)를 고쳤다면:

```bash
npm run typecheck:plugin   # 타입체크
npm run build:plugin       # main.js 재생성
```

`main.js`를 다시 커밋하면 설치 측에서 그 파일만 교체해 갱신할 수 있습니다.
