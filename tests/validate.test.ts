import { normalizeHeadings, normalizeSettings, validateRule } from "../src/settings/validate";
import { blankRule } from "../src/settings/Settings";

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

// ── v10 → v11: 단일 heading/level 이 headings[0] 이 된다 ───────────
{
	const { settings } = normalizeSettings({
		version: 10,
		rules: [{ name: "A", file: "a.md", heading: "할 일", level: 2, tags: ["#task"] }],
	});
	const r = settings.rules[0];
	eq(settings.version, 11, "스키마가 11 로 오른다");
	eq(r.headings, [{ heading: "할 일", level: 2 }], "예전 헤딩 하나가 목록이 된다");
	eq([r.heading, r.level], ["할 일", 2], "사본도 그대로");
	eq(r.enabled, true, "헤딩이 있으니 켜진 채로");
}

// ── headings 가 있으면 그쪽이 이기고, 사본은 첫 항목을 따른다 ─────
{
	const { settings } = normalizeSettings({
		version: 11,
		rules: [
			{
				name: "B",
				file: "b.md",
				heading: "옛것",
				level: 1,
				headings: [
					{ heading: "Inbox", level: 1 },
					{ heading: "Later", level: 2 },
				],
			},
		],
	});
	const r = settings.rules[0];
	eq(r.headings.map((h) => h.heading), ["Inbox", "Later"], "headings 가 진실");
	eq([r.heading, r.level], ["Inbox", 1], "사본 = headings[0]");
}

// ── 헤딩이 하나도 없으면 규칙이 꺼진다 ───────────────────────────
{
	const { settings, issues } = normalizeSettings({
		version: 11,
		rules: [{ name: "C", file: "c.md", headings: [{ heading: "  ", level: 1 }] }],
	});
	eq(settings.rules[0].enabled, false, "빈 헤딩뿐이면 끈다");
	eq(issues.some((x) => x.field === "heading"), true, "이유를 남긴다");
}

// ── 정리: 빈 이름 · 중복 · 단계 범위 ────────────────────────────
eq(
	normalizeHeadings(
		[
			{ heading: " A ", level: 1 },
			{ heading: "A", level: 1 },
			{ heading: "A", level: 2 },
			{ heading: "", level: 1 },
			{ heading: "B", level: 9 },
			null,
		],
		"",
		0
	),
	[
		{ heading: "A", level: 1 },
		{ heading: "A", level: 2 },
		{ heading: "B", level: 6 },
	],
	"공백 제거, (이름,단계) 중복 제거, 단계는 0~6"
);
eq(normalizeHeadings(undefined, "", 0), [], "배열도 단일 헤딩도 없으면 빈 목록");

// ── 편집 모달 검증 ────────────────────────────────────────────────
{
	const r = { ...blankRule(), name: "D", file: "d.md" };
	eq(
		validateRule(r, [], -1).some((e) => e.includes("헤딩")),
		true,
		"헤딩이 없으면 막는다"
	);
	r.headings = [
		{ heading: "X", level: 1 },
		{ heading: "X", level: 1 },
	];
	eq(
		validateRule(r, [], -1).some((e) => e.includes("두 번")),
		true,
		"같은 헤딩 두 번이면 막는다"
	);
	r.headings = [
		{ heading: "X", level: 1 },
		{ heading: "X", level: 2 },
	];
	eq(validateRule(r, [], -1), [], "단계가 다르면 다른 헤딩");
}

console.log(`validate: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
