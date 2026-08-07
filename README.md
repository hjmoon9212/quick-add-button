# Hub Button

프로젝트 허브 노트의 **⚡ 빠른 추가 버튼**을 코드블록 한 줄로 만드는 Obsidian 플러그인.

기존에는 허브 노트마다 dataviewjs 56줄을 복붙해 두고, 타입을 하나 추가할 때마다
여러 파일의 `SUB` / `LABEL` / `for` 루프를 손으로 맞춰야 했다. 이 플러그인은 그
정의를 설정창 한 곳으로 옮긴다 — **타입 하나 추가 = 설정 한 번**.

## 쓰는 법

허브 노트에 이렇게만 적는다.

````markdown
# ⚡ 빠른 추가

```hub-button
types: Meeting, Issue, Module, Deliverable, Doc
```
````

버튼 목록·라벨·폴더·템플릿은 **설정 → Hub Button** 의 타입 규칙에서 관리하며,
규칙을 고치면 열려 있는 모든 허브가 `Ctrl+R` 없이 즉시 갱신된다.

### 전체 문법

````markdown
```hub-button
requireType: Project-Hub    # 생략 시 설정 기본값. false = 검증 안 함
buttons:
  - Meeting                 # ① 레지스트리 그대로
  - type: Doc               # ② 라벨만 덮어쓰기
    label: 📚 이번 프로젝트 자료
  - label: 🐛 결함 추가      # ③ 애드혹 (설정에 등록하지 않는 1회용)
    folder: 결함
    template: Template/Defect.md
```
````

## 두 가지 동작

### 노트 생성 (`create-note`)

1. 현재 노트가 허브인지 검증 (`Type: Project-Hub`)
2. `<허브 폴더>/<하위 폴더>` 확보 — 그 자리에 동명 *파일*이 있으면 중단
3. 파일명 입력 (입력 중에 경로와 충돌을 보여줌)
4. 템플릿 복사 → Templater `<% … %>` 치환 → frontmatter 에 허브 백링크 주입 → 열기

Templater 가 없거나 실패해도 노트 생성은 성공하며 안내만 뜬다.

### 할일 추가 (`append-task`)

버튼을 누르면 미니 폼이 열리고, 지정한 노트의 **특정 헤딩 아래**에 Tasks 한 줄을 넣는다.

```
- [ ] #task 내용 ⏫ 🆔 abc123 ➕ 2026-08-07 🛫 2026-08-08 📅 2026-08-14
```

대상은 규칙에 여러 개 등록할 수 있고, 경로에 토큰을 쓸 수 있다.

| 토큰 | 뜻 |
|---|---|
| `@current` | 버튼이 있는 노트 (클릭 시점의 H1~H3 를 드롭다운으로 펼침) |
| `@hub/…` | 허브 노트가 있는 폴더 기준 상대 경로 |
| 그 외 | 볼트 절대경로 |

섹션의 끝은 *다음 동급/상위 헤딩 직전*이며, 코드펜스 안의 `#` 은 헤딩으로 보지 않는다.

## 설정

**설정 → Hub Button** 에서 규칙을 추가·편집·정렬·삭제한다. JSON 을 손으로 고칠
필요는 없다 (볼트 간 복사용으로 내보내기/가져오기는 제공).

- 규칙마다 커맨드가 등록되므로 커맨드 팔레트와 모바일 툴바에서도 부를 수 있다
- 잘못된 규칙은 그 규칙만 건너뛰고 블록에 오류 박스를 띄운다 — 조용히 실패하지 않는다

## 요구 플러그인

- **Templater** (선택) — 템플릿의 `<% … %>` 치환용
- Dataview / QuickAdd 는 필요 없다

## 설치 (BRAT)

1. BRAT 설치 → `Add Beta plugin`
2. `hjmoon9212/hub-button` 입력
3. 설정에서 Hub Button 활성화

## 개발

```bash
npm install
npm run build          # tsc 타입체크 + 프로덕션 번들

# 볼트로 바로 감시 빌드
OBSIDIAN_PLUGIN_DIR=C:/obsidian/ob_Moon/.obsidian/plugins/hub-button npm run dev
```

배포는 태그 push 로만 한다 (볼트의 `main.js` 를 직접 고치지 않는다).

```bash
node version-bump.mjs 0.2.0
git commit -am "v0.2.0" && git push
git tag 0.2.0 && git push origin 0.2.0   # v 접두사 없음, manifest.version 과 동일
```

태그가 올라가면 GitHub Actions 가 빌드해서 `main.js` / `manifest.json` /
`styles.css` / `versions.json` 을 첨부한 Release 를 만들고, BRAT 가 그걸 받아간다.

## 라이선스

MIT
