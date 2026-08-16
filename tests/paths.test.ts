import { isDynamicTarget, resolveRelativePath } from "../src/core/paths";

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

// ── 상대경로 펴기 ─────────────────────────────────────────────────
const NOTE = "0. Note/2. Area/Life Admin/로그/2026-08.md";

eq(resolveRelativePath(NOTE, "./Living.md"), "0. Note/2. Area/Life Admin/로그/Living.md", "./ 는 같은 폴더");
eq(resolveRelativePath(NOTE, "../Living.md"), "0. Note/2. Area/Life Admin/Living.md", "../ 는 상위 폴더");
eq(resolveRelativePath(NOTE, "../../Living.md"), "0. Note/2. Area/Living.md", "../ 두 번");
eq(resolveRelativePath(NOTE, "./sub/x.md"), "0. Note/2. Area/Life Admin/로그/sub/x.md", "하위 폴더로 내려가기");
eq(resolveRelativePath(NOTE, "./x.md/"), "0. Note/2. Area/Life Admin/로그/x.md", "끝의 / 는 무시");

// 루트 노트 — 위로 더 갈 곳이 없다
eq(resolveRelativePath("Temp.md", "./x.md"), "x.md", "루트 노트의 ./");
eq(resolveRelativePath("Temp.md", "../x.md"), null, "루트에서 ../ 는 볼트 밖 → null");
eq(resolveRelativePath("A/B/n.md", "../../../x.md"), null, "볼트 밖으로 넘어가면 null");

// 기준 노트가 없으면 펼 수 없다 (리본을 눌렀는데 아무 노트도 안 열려 있는 경우)
eq(resolveRelativePath("", "./x.md"), null, "기준 노트가 없으면 null");

// ── 어떤 값이 "그때그때 달라지는" 값인가 ──────────────────────────
eq(isDynamicTarget("@current"), true, "@current");
eq(isDynamicTarget("  @current  "), true, "앞뒤 공백은 무시");
eq(isDynamicTarget("./로그.md"), true, "./");
eq(isDynamicTarget("../Living.md"), true, "../");
eq(isDynamicTarget("0. Note/0. Inbox/Temp Tasks.md"), false, "볼트 절대경로는 고정");
eq(isDynamicTarget("Temp Tasks"), false, "이름만 적은 것도 고정 — 링크 해석은 볼트 전역이다");
eq(isDynamicTarget("@currently.md"), false, "@current 로 시작만 하는 다른 이름");

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
