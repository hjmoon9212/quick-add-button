import {
	canonicalGcal,
	DEFAULT_SETTINGS,
	DEFAULT_TASK_DEFAULTS,
	QuickAddButtonSettings,
	RuleDef,
} from "./Settings";

export interface ValidationIssue {
	/** 규칙 인덱스. 전역 설정 문제면 -1 */
	index: number;
	field: string;
	message: string;
}

/** 예전 구조. 마이그레이션에만 쓴다. */
interface LegacyRule {
	targets?: { file?: string; heading?: string; level?: number }[];
	/** v4: 태그가 문자열 하나였다 */
	tag?: string;
	/** v3: 태그가 폼 기본값 안에 있었다 */
	defaults?: { tag?: string };
}

/**
 * data.json 은 사용자가 직접 고칠 수 있는 파일이고 TS 타입은 런타임에 없다.
 * 그래서 로드 시점에 반드시 정규화한다. 잘못된 규칙 하나 때문에 전체 설정이
 * 죽으면 안 되므로, 고칠 수 있으면 고치고 못 고치면 그 규칙만 끈다.
 */
export function normalizeSettings(raw: unknown): {
	settings: QuickAddButtonSettings;
	issues: ValidationIssue[];
} {
	const issues: ValidationIssue[] = [];
	const src = (raw ?? {}) as Partial<QuickAddButtonSettings>;
	const prevVersion = Number(src.version) || 1;

	const settings: QuickAddButtonSettings = { version: 7, rules: [] };

	const rawRules = Array.isArray(src.rules) ? src.rules : DEFAULT_SETTINGS.rules;
	const seen = new Set<string>();

	rawRules.forEach((rr, i) => {
		const r = rr as Partial<RuleDef> & LegacyRule;
		const name = str(r.name, "").trim();
		if (!name) {
			issues.push({ index: i, field: "name", message: "규칙 이름이 비었습니다" });
			return;
		}
		if (seen.has(name)) {
			issues.push({ index: i, field: "name", message: `규칙 이름이 중복됩니다: ${name}` });
			return;
		}
		seen.add(name);

		// v1 → v2: targets[] 중 파일과 헤딩이 다 있는 첫 항목을 쓴다.
		let file = str(r.file, "").replace(/^\/+/, "");
		let heading = str(r.heading, "");
		let level = Number(r.level) || 0;

		if (!file && Array.isArray(r.targets)) {
			const t = r.targets.find(
				(x) => x?.file && !String(x.file).startsWith("@") && x.heading
			);
			if (t) {
				file = String(t.file).replace(/^\/+/, "");
				heading = String(t.heading);
				level = Number(t.level) || 0;
			}
		}

		const def: RuleDef = {
			name,
			label: str(r.label, name),
			enabled: r.enabled !== false,
			file,
			heading,
			level,
			// v3 → v4 → v5: defaults.tag(문자열) → tag(문자열) → tags(배열)
			tags: normalizeTags(r),
			// v6: #gcal/… 라우팅 태그. 없으면 빈 배열 = 이 버튼은 gcal 칸을 안 쓴다.
			// v7: 아는 캘린더는 볼트 표준 표기(소문자)로 되돌린다.
			gcals: cleanList(r.gcals).map(canonicalGcal),
			defaults: { ...DEFAULT_TASK_DEFAULTS, ...(r.defaults ?? {}) },
		};
		if (def.defaults.position !== "top") def.defaults.position = "end";
		// v3 부터 🆔 기본값이 켜짐이다. 그 전 설정은 기본값이 꺼짐이던 시절에
		// 저장된 것이므로, 사용자가 끈 것과 구분되지 않아 한 번만 올려준다.
		if (prevVersion < 3) def.defaults.id = true;

		if (!file) {
			issues.push({ index: i, field: "file", message: `${name}: 삽입할 파일이 없습니다` });
			def.enabled = false;
		} else if (!heading) {
			issues.push({ index: i, field: "heading", message: `${name}: 삽입할 헤딩이 없습니다` });
			def.enabled = false;
		}

		settings.rules.push(def);
	});

	return { settings, issues };
}

function normalizeTags(r: Partial<RuleDef> & LegacyRule): string[] {
	const raw = Array.isArray(r.tags) ? r.tags : [r.tag ?? r.defaults?.tag ?? ""];
	const out = cleanList(raw);
	return out.length ? out : ["#task"];
}

/** 문자열 배열에서 공백·빈값·중복 제거. 배열이 아니면 빈 배열. */
function cleanList(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	const out: string[] = [];
	for (const t of raw) {
		const v = String(t ?? "").trim();
		if (v && !out.includes(v)) out.push(v);
	}
	return out;
}

function str(v: unknown, fallback: string): string {
	return typeof v === "string" ? v : fallback;
}

/** 편집 Modal 저장 직전 검사. 반환값이 비어 있으면 저장 가능. */
export function validateRule(
	def: RuleDef,
	all: RuleDef[],
	selfIndex: number
): string[] {
	const errs: string[] = [];
	const name = def.name.trim();

	if (!name) errs.push("규칙 이름을 입력하세요.");
	else if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(name))
		errs.push("규칙 이름은 영문으로 시작하고 영숫자 / - / _ 만 쓸 수 있습니다.");
	else if (all.some((r, i) => i !== selfIndex && r.name.trim() === name))
		errs.push(`이미 같은 이름의 규칙이 있습니다: ${name}`);

	if (!def.file.trim()) errs.push("할일을 넣을 파일을 선택하세요.");
	if (!def.heading.trim()) errs.push("할일을 넣을 헤딩을 선택하세요.");
	if (!def.tags.length) errs.push("태그를 하나 이상 입력하세요.");
	else {
		const bad = def.tags.filter((t) => !t.startsWith("#"));
		if (bad.length) errs.push(`태그는 # 으로 시작해야 합니다: ${bad.join(", ")}`);
	}

	// gcal 은 비워도 된다(그 버튼은 캘린더 라우팅을 안 쓴다는 뜻).
	const badGcal = def.gcals.filter((t) => !/^#[^/\s]+\/\S+$/.test(t));
	if (badGcal.length)
		errs.push(`GCal 태그는 #gcal/캘린더명 형식이어야 합니다: ${badGcal.join(", ")}`);

	return errs;
}
