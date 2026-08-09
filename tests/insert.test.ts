import { findInsertIndex } from "../src/core/findInsertIndex";

let pass = 0;
let fail = 0;
function eq(actual: unknown, expected: unknown, msg: string): void {
	if (JSON.stringify(actual) === JSON.stringify(expected)) {
		pass++;
	} else {
		fail++;
		console.error(`FAIL ${msg}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`);
	}
}

/** 넣은 결과를 눈으로 보기 위한 헬퍼. 못 넣으면 null. */
function insert(
	text: string,
	heading: string,
	level: number,
	atTop: boolean,
	line = "NEW"
): string | null {
	const lines = text.split("\n");
	const at = findInsertIndex(lines, heading, level, atTop);
	if (at === null) return null;
	lines.splice(at, 0, line);
	return lines.join("\n");
}

// ── 헤딩을 못 찾으면 아무것도 안 한다 ──────────────────────────────
eq(findInsertIndex(["# A", "- [ ] x"], "B", 1, false), null, "없는 헤딩 → null");
eq(findInsertIndex(["# A"], "", 1, false), null, "빈 헤딩 → null");
eq(findInsertIndex(["# A", "text"], "A", 2, false), null, "레벨이 다르면 → null");
eq(findInsertIndex(["# A", "## A", "t"], "A", 2, true), 2, "같은 이름은 레벨로 고른다");
eq(findInsertIndex(["# A", "text"], "A", 0, true), 1, "level 0 은 텍스트만으로 맞춘다");

// ── 코드펜스 ──────────────────────────────────────────────────────
eq(
	insert("# A\n\n```\n# A\n```\n\n- [ ] x\n", "A", 1, false),
	"# A\n\n```\n# A\n```\n\n- [ ] x\nNEW\n",
	"펜스 안의 # 은 헤딩이 아니다"
);
eq(
	findInsertIndex("````\n```\n# A\n```\n````\n# A\n- [ ] x".split("\n"), "A", 1, true),
	6,
	"4-백틱 안의 3-백틱은 펜스를 닫지 않는다"
);
eq(
	findInsertIndex("```\n~~~\n# A\n```\n# A\n- [ ] x".split("\n"), "A", 1, true),
	5,
	"~~~ 는 ``` 을 닫지 못한다"
);
eq(
	findInsertIndex("```js\n# A\n```\n# A\nt".split("\n"), "A", 1, true),
	4,
	"정보문자열이 붙은 여는 펜스"
);
eq(
	insert("# A\n- [ ] x\n\n```\n- [ ] 코드 안\n```\n", "A", 1, false),
	"# A\n- [ ] x\nNEW\n\n```\n- [ ] 코드 안\n```\n",
	"펜스 안의 목록 항목은 세지 않는다"
);

// ── frontmatter ───────────────────────────────────────────────────
eq(
	findInsertIndex("---\n# 주석\ntag: A\n---\n# A\nt".split("\n"), "주석", 1, true),
	null,
	"frontmatter 안의 # 은 헤딩이 아니다"
);
eq(
	findInsertIndex("---\ntag: x\n---\n# A\nt".split("\n"), "A", 1, true),
	4,
	"frontmatter 뒤의 헤딩은 찾는다"
);
eq(
	findInsertIndex("---\n# A\nt".split("\n"), "A", 1, true),
	2,
	"닫히지 않은 --- 는 frontmatter 가 아니다"
);

// ── atTop = 헤딩 바로 밑 ──────────────────────────────────────────
eq(
	insert("# A\n\n- [ ] 기존\n", "A", 1, true),
	"# A\n\nNEW\n- [ ] 기존\n",
	"헤딩 밑 빈 줄은 건너뛴다"
);
eq(insert("# A\n# B\n", "A", 1, true), "# A\nNEW\n# B\n", "빈 섹션");
eq(
	insert("# A\n\n## A-1\n- [ ] 하위\n", "A", 1, true),
	"# A\n\nNEW\n## A-1\n- [ ] 하위\n",
	"atTop 도 하위 헤딩을 넘지 않는다"
);

// ── end = 마지막 목록 항목 뒤 ─────────────────────────────────────
eq(
	insert("# A\n- [ ] 1\n- [ ] 2\n\n메모\n\n# B\n", "A", 1, false),
	"# A\n- [ ] 1\n- [ ] 2\nNEW\n\n메모\n\n# B\n",
	"목록 뒤 산문이 있으면 목록 끝에 붙는다"
);
eq(
	insert("# A\n- [ ] 1\n\n- [ ] 2\n\n- [ ] 3\n", "A", 1, false),
	"# A\n- [ ] 1\n\n- [ ] 2\n\n- [ ] 3\nNEW\n",
	"목록 중간의 빈 줄에서 멈추지 않는다"
);
eq(
	insert("# A\n- [ ] 1\n  이어지는 줄\n메모\n", "A", 1, false),
	"# A\n- [ ] 1\n  이어지는 줄\nNEW\n메모\n",
	"들여쓴 이어짐 줄까지 넘긴다"
);
eq(
	insert("# A\n- 1\n  - 중첩\n메모\n", "A", 1, false),
	"# A\n- 1\n  - 중첩\nNEW\n메모\n",
	"중첩 항목도 목록이다"
);
eq(
	insert("# A\n1. 하나\n2) 둘\n메모\n", "A", 1, false),
	"# A\n1. 하나\n2) 둘\nNEW\n메모\n",
	"번호 목록"
);
eq(
	insert("# A\n산문만 있다\n\n\n# B\n", "A", 1, false),
	"# A\n산문만 있다\nNEW\n\n\n# B\n",
	"목록이 없으면 본문 끝(빈 줄 되감기)으로 폴백"
);
eq(
	insert("# A\n- [ ] 1\n\n## A-1\n- [ ] 하위\n", "A", 1, false),
	"# A\n- [ ] 1\nNEW\n\n## A-1\n- [ ] 하위\n",
	"하위 헤딩의 목록은 이 헤딩 것이 아니다"
);
eq(
	insert("## A\n- [ ] 1\n### 더 깊은\n- [ ] 2\n## B\n", "A", 2, false),
	"## A\n- [ ] 1\nNEW\n### 더 깊은\n- [ ] 2\n## B\n",
	"더 깊은 헤딩에서도 범위가 끊긴다"
);
eq(
	insert("# A\n- [ ] 1\n", "A", 1, false),
	"# A\n- [ ] 1\nNEW\n",
	"파일 끝"
);

// ── Temp Tasks.md 실제 모양 ───────────────────────────────────────
const real = [
	"# ⚡ 빠른 추가",
	"",
	"```quick-add-button",
	"```",
	"# Tasks",
	"",
	"- [ ] #task 지출 비용 체크 📅 2026-08-09 🆔 uVaLGk",
	"- [ ] #task 냉장고 청소",
	"",
	"- [ ] #task 삼성카드 해지 검토",
	"- [x] #task 임대청약 서류제출 ✅ 2026-08-06",
	"",
	"",
].join("\n");
eq(findInsertIndex(real.split("\n"), "Tasks", 1, false), 11, "실제 Temp Tasks: 마지막 항목 뒤");
eq(
	findInsertIndex(real.split("\n"), "⚡ 빠른 추가", 1, false),
	4,
	"목록이 없으면 닫는 펜스 뒤 · 다음 헤딩 앞"
);

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
