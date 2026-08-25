import { isMarkdown, parseRules, unwrapRules, withExtension, wrapRules } from "../src/core/rulesFile";

let pass = 0;
let fail = 0;
function eq(actual: unknown, expected: unknown, msg: string): void {
	if (JSON.stringify(actual) === JSON.stringify(expected)) {
		pass++;
	} else {
		fail++;
		console.error(
			`FAIL ${msg}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`
		);
	}
}

// ── 어떤 파일이냐 ─────────────────────────────────────────────────
eq(isMarkdown("자료/규칙.md"), true, ".md 는 노트");
eq(isMarkdown("자료/규칙.MD"), true, "확장자 대문자도 노트");
eq(isMarkdown("자료/규칙.json"), false, ".json 은 그냥 파일");

// ── 꺼내기 ────────────────────────────────────────────────────────
const NOTE = '설명 한 줄\n\n```json\n{ "rules": [] }\n```\n\n뒤에 붙은 글\n';
eq(unwrapRules(NOTE), '{ "rules": [] }', "노트에서는 블록 안만 꺼낸다");
eq(unwrapRules('  { "rules": [] }  '), '{ "rules": [] }', "블록이 없으면 전체를 쓴다");

// ── 넣기 ──────────────────────────────────────────────────────────
const JSON_TEXT = '{\n "rules": []\n}';
eq(wrapRules(JSON_TEXT, "규칙.json"), JSON_TEXT + "\n", "노트가 아니면 그대로 쓴다");

const rewritten = wrapRules('{ "rules": [1] }', "규칙.md", NOTE);
eq(rewritten.includes("설명 한 줄"), true, "앞에 적어둔 글은 남는다");
eq(rewritten.includes("뒤에 붙은 글"), true, "뒤에 적어둔 글도 남는다");
eq(unwrapRules(rewritten), '{ "rules": [1] }', "블록만 갈아 끼운다");

const fresh = wrapRules('{ "rules": [] }', "규칙.md");
eq(unwrapRules(fresh), '{ "rules": [] }', "새 노트도 다시 읽힌다");
eq(fresh.includes("quick-add-button 규칙"), true, "새로 만들 때는 설명을 붙인다");

// 사람이 블록만 적어둔 노트 — 설명 없이도 갈아끼운다
const bare = "```json\n{}\n```\n";
eq(unwrapRules(wrapRules('{ "rules": [2] }', "x.md", bare)), '{ "rules": [2] }', "설명 없는 노트");

// ── 읽어들이기 ────────────────────────────────────────────────────
eq(parseRules(NOTE), { rules: [] }, "노트에서 규칙을 읽는다");
eq(parseRules('{"version":10,"rules":[{"name":"A"}]}'), { rules: [{ name: "A" }] }, "객체 형태");
eq(parseRules('[{"name":"A"}]'), { rules: [{ name: "A" }] }, "배열만 적어도 받는다");
eq(parseRules("깨진 내용"), null, "못 읽으면 null");
eq(parseRules('{"rules":"배열이 아님"}'), null, "rules 가 배열이 아니면 null");
eq(parseRules(""), null, "빈 파일도 null");

// ── 확장자 보정 ───────────────────────────────────────────────────
eq(withExtension("Plugin/규칙"), "Plugin/규칙.md", "확장자가 없으면 .md 를 붙인다");
eq(withExtension("Plugin/규칙.md"), "Plugin/규칙.md", "이미 .md 면 그대로");
eq(withExtension("Plugin/규칙.json"), "Plugin/규칙.json", "다른 확장자도 그대로");
eq(withExtension("  /Plugin/규칙  "), "Plugin/규칙.md", "공백과 앞의 / 는 떼어낸다");
eq(withExtension("규칙"), "규칙.md", "루트 파일");
eq(withExtension("2026. 자료/규칙"), "2026. 자료/규칙.md", "폴더 이름의 점은 확장자가 아니다");
eq(withExtension(""), "", "빈 값은 빈 값");

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
