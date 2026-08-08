# Quick Add Button

노트 본문에 **버튼**을 놓고, 누르면 미니 폼으로 **다른 노트의 특정 헤딩 아래**에
할일 한 줄을 넣는 Obsidian 플러그인.

QuickAdd 의 Capture 로 하던 "임시 할일 추가"를 확장한 것이다. QuickAdd 는 파일 맨 위나 맨
아래로만 넣을 수 있는데, 여기서는 **파일과 헤딩까지 설정에서 정해** 그 헤딩 아래로
넣는다.

## 쓰는 법

노트 아무 데나 이렇게 넣는다.

````markdown
```quick-add-button
```
````

빈 블록이면 켜져 있는 규칙이 전부 버튼으로 뜬다. 골라 쓰려면:

````markdown
```quick-add-button
rules: TempTask, Idea
```

```quick-add-button
exclude: Maint
```
````

버튼을 누르면:

```
┌─ ⚡ 임시 할일 ─────────────────────┐
│ #task  →  Temp Tasks › Quick Add  │
│ 내용  [_______________________]   │  ← Enter = 추가
│ 우선순위 [없음 ▾]                  │
│ 🛫 시작 [____]  📅 마감 [____]     │
│         [오늘] [내일] [+7일] [지움] │
│ 위치  [섹션 끝 ▾]   ☐🆔  ☑➕      │
│ 미리보기  - [ ] #task … 📅 …       │
│                        [➕ 추가]   │
└───────────────────────────────────┘
```

들어가는 줄은 Obsidian Tasks 문법 그대로다.

```
- [ ] #task 내용 ⏫ 🆔 abc123 ➕ 2026-08-07 🛫 2026-08-08 📅 2026-08-14
```

GCal 캘린더를 지정한 버튼이면 태그 뒤에 라우팅 태그가 붙는다.

```
- [ ] #task/tobuy #gcal/Routine 내용 📅 2026-08-14
```

연달아 넣는 경우가 많아 추가해도 폼이 닫히지 않는다 (Esc 로 닫는다).

## 설정

**설정 → Quick Add Button** 에서 규칙(= 버튼)을 추가·편집·정렬·삭제한다.
규칙 하나가 **넣을 자리 하나**를 가리킨다.

| 항목 | |
|---|---|
| **파일** | 입력하면 볼트의 노트를 검색해 고른다 |
| **헤딩** | 고른 파일의 헤딩 목록이 바로 채워진다. **이 헤딩 아래**에 할일이 들어간다 |
| **태그** | 이 버튼이 쓸 태그. 콤마로 여러 개 두면 폼에서 고른다 (`#task, #task/ISSUE`). 맨 앞이 기본값 |
| **GCal 캘린더** | [tasks-gcal-sync](https://github.com/hjmoon9212/tasks-gcal-sync) 의 라우팅 태그 (`#gcal/Routine`). 붙이면 그 캘린더로 일정이 간다. 비워 두면 폼에 칸이 안 뜨고 줄에도 안 붙는다. 콤마로 여러 개 두면 폼에서 고르고, 폼에는 `없음` 도 있다. **전체** 버튼으로 아는 캘린더를 한 번에 넣고, **지우기** 로 비운다 |

헤딩 아래 어디에 넣을지는 `섹션 끝` / `헤딩 바로 밑` 중에 고른다.

규칙마다 커맨드가 등록되므로 커맨드 팔레트와 모바일 툴바에서도 부를 수 있다.

## 동작 세부

- **섹션의 끝** = 다음 동급/상위 헤딩 직전. 그 앞의 빈 줄은 건너뛰고 넣는다
- 헤딩을 못 찾으면 아무것도 고치지 않고 알린다 (엉뚱한 자리에 넣지 않는다)
- **코드펜스 안의 `#` 은 헤딩으로 보지 않는다** — 파일에 ` ``` ` 블록이 있어도 자리가 밀리지 않는다
- 파일 수정은 `vault.process` 로 하므로 읽고 쓰는 사이에 다른 편집이 끼어들지 않는다
- 🆔 를 켜면 볼트 전역에서 안 쓰인 6자리를 붙인다 (task 가 있는 파일만 훑는다)
- `#gcal/…` 는 **태그 바로 뒤, 내용 앞**에 붙인다. tasks-gcal-sync 가 이벤트 제목에서 이 태그를 떼므로 캘린더에는 내용만 남는다
- GCal 캘린더는 목록에 없는 이름도 그대로 쓸 수 있다 (자동완성은 편의용). 없는 캘린더면 tasks-gcal-sync 가 기본 캘린더로 보낸다
- 시작일이 마감일보다 뒤면 거부한다
- 잘못된 규칙은 그 규칙만 건너뛰고 블록에 오류 박스를 띄운다 — 조용히 실패하지 않는다

## 요구 플러그인

없다. Tasks 플러그인이 있으면 넣은 줄이 쿼리·캘린더에 잡히지만, 이 플러그인 자체는
Dataview / QuickAdd / Templater 없이 돈다.

## 설치 (BRAT)

1. BRAT 설치 → `Add Beta plugin`
2. `hjmoon9212/quick-add-button` 입력
3. 설정에서 Quick Add Button 활성화

## 개발

```bash
npm install
npm run build          # tsc 타입체크 + 프로덕션 번들

# 볼트로 바로 감시 빌드
OBSIDIAN_PLUGIN_DIR=C:/obsidian/ob_Moon/.obsidian/plugins/quick-add-button npm run dev
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
