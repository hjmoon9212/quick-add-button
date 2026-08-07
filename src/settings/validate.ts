import {
	DEFAULT_SETTINGS,
	DEFAULT_TASK_DEFAULTS,
	QuickAddButtonSettings,
	RuleDef,
	TaskTarget,
} from "./Settings";

export interface ValidationIssue {
	/** 규칙 인덱스. 전역 설정 문제면 -1 */
	index: number;
	field: string;
	message: string;
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
		version: 1,
		taskTags:
			Array.isArray(src.taskTags) && src.taskTags.length
				? src.taskTags.map((t) => String(t))
				: [...DEFAULT_SETTINGS.taskTags],
		rules: [],
	};

	const rawRules = Array.isArray(src.rules) ? src.rules : DEFAULT_SETTINGS.rules;
	const seen = new Set<string>();

	rawRules.forEach((rr, i) => {
		const r = rr as Partial<RuleDef>;
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

		const targets = (Array.isArray(r.targets) ? r.targets : [])
			.map((x) => normalizeTarget(x as Partial<TaskTarget>))
			.filter((x): x is TaskTarget => x !== null);

		const def: RuleDef = {
			name,
			label: str(r.label, name),
			enabled: r.enabled !== false,
			targets,
			defaults: { ...DEFAULT_TASK_DEFAULTS, ...(r.defaults ?? {}) },
		};
		if (def.defaults.position !== "top") def.defaults.position = "end";

		if (!targets.length) {
			issues.push({
				index: i,
				field: "targets",
				message: `${name}: 삽입 대상이 하나도 없습니다`,
			});
			def.enabled = false;
		}

		settings.rules.push(def);
	});

	return { settings, issues };
}

function normalizeTarget(t: Partial<TaskTarget>): TaskTarget | null {
	const file = String(t?.file ?? "").trim();
	if (!file) return null;
	const out: TaskTarget = { file };
	if (t.heading) out.heading = String(t.heading);
	if (t.level) out.level = Number(t.level) || 0;
	if (t.headings === "h1-h3") out.headings = "h1-h3";
	if (t.label) out.label = String(t.label);
	if (t.createFrom) out.createFrom = String(t.createFrom);
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
		errs.push("규칙 이름은 영문으로 시작하고 영숫자 / - / _ 만 쓸 수 있습니다 (코드블록에서 이 이름으로 부릅니다).");
	else if (all.some((r, i) => i !== selfIndex && r.name.trim() === name))
		errs.push(`이미 같은 이름의 규칙이 있습니다: ${name}`);

	if (!def.targets.length) errs.push("삽입 대상을 최소 하나 추가하세요.");
	def.targets.forEach((t, i) => {
		if (!t.file.trim()) errs.push(`대상 ${i + 1}: 파일을 선택하세요.`);
	});

	return errs;
}
