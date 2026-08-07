import {
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

/** v1 의 targets[] 구조. 마이그레이션에만 쓴다. */
interface LegacyTarget {
	file?: string;
	heading?: string;
	level?: number;
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

	const settings: QuickAddButtonSettings = {
		version: 2,
		taskTags:
			Array.isArray(src.taskTags) && src.taskTags.length
				? src.taskTags.map((t) => String(t))
				: [...DEFAULT_SETTINGS.taskTags],
		rules: [],
	};

	const rawRules = Array.isArray(src.rules) ? src.rules : DEFAULT_SETTINGS.rules;
	const seen = new Set<string>();

	rawRules.forEach((rr, i) => {
		const r = rr as Partial<RuleDef> & { targets?: LegacyTarget[] };
		const name = str(r.name, "").trim();
		if (!name) {
			issues.push({ index: i, field: "name", message: "규칙 이름이 비었습니다" });
			return;
		}
		if (seen.has(name)) {
			issues.push({
				index: i,
				field: "name",
				message: `규칙 이름이 중복됩니다: ${name}`,
			});
			return;
		}
		seen.add(name);

		// v1 → v2: targets[] 중 파일과 헤딩이 다 있는 첫 항목을 쓴다.
		// @current 처럼 설정 시점에 헤딩을 정할 수 없던 항목은 버린다.
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
			defaults: { ...DEFAULT_TASK_DEFAULTS, ...(r.defaults ?? {}) },
		};
		if (def.defaults.position !== "top") def.defaults.position = "end";

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
		errs.push("규칙 이름은 영문으로 시작하고 영숫자 / - / _ 만 쓸 수 있습니다 (코드블록에서 이 이름으로 부릅니다).");
	else if (all.some((r, i) => i !== selfIndex && r.name.trim() === name))
		errs.push(`이미 같은 이름의 규칙이 있습니다: ${name}`);

	if (!def.file.trim()) errs.push("삽입할 파일을 선택하세요.");
	if (!def.heading.trim()) errs.push("삽입할 헤딩을 선택하세요.");

	return errs;
}
