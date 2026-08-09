import { QuickAddButtonSettings, RuleDef } from "../settings/Settings";

export interface BlockSpec {
	/** 표시할 규칙 이름. 비어 있으면 "켜져 있는 규칙 전부" */
	include: string[];
	exclude: string[];
}

export type ParseResult =
	| { ok: true; spec: BlockSpec }
	| { ok: false; message: string };

/**
 * 코드블록 본문을 읽는다. 받는 건 두 줄뿐이라 YAML 라이브러리를 쓰지 않는다.
 *
 *   (빈 블록)              → 켜져 있는 규칙 전부
 *   rules: TempTask, Idea  → 이 규칙만, 이 순서로
 *   exclude: Maint         → 전부에서 이것만 빼고
 */
export function parseBlock(source: string): ParseResult {
	const spec: BlockSpec = { include: [], exclude: [] };

	for (const raw of source.split("\n")) {
		const body = raw.trim();
		if (!body || body.startsWith("#")) continue;

		const m = body.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
		if (!m) return { ok: false, message: `해석할 수 없는 줄: ${body}` };

		const [, key, value] = m;
		switch (key) {
			case "rules":
				spec.include.push(...splitList(value));
				break;
			case "exclude":
				spec.exclude.push(...splitList(value));
				break;
			default:
				return {
					ok: false,
					message: `알 수 없는 항목: ${key} (쓸 수 있는 것: rules, exclude)`,
				};
		}
	}
	return { ok: true, spec };
}

function splitList(v: string): string[] {
	return v
		.split(",")
		.map((s) => s.trim().replace(/^["']|["']$/g, ""))
		.filter(Boolean);
}

export type ResolvedButton =
	| { ok: true; rule: RuleDef }
	| { ok: false; name: string; message: string };

/** 코드블록이 요청한 버튼을 실제 규칙으로 맞춘다. */
export function resolveButtons(
	spec: BlockSpec,
	settings: QuickAddButtonSettings
): ResolvedButton[] {
	if (!spec.include.length) {
		return settings.rules
			.filter((r) => r.enabled && !spec.exclude.includes(r.name))
			.map((rule) => ({ ok: true as const, rule }));
	}

	return [...new Set(spec.include)]
		.filter((name) => !spec.exclude.includes(name))
		.map((name) => {
			const found = settings.rules.find((r) => r.name === name);
			if (!found) {
				return { ok: false as const, name, message: `등록되지 않은 규칙: "${name}"` };
			}
			if (!found.enabled) {
				return { ok: false as const, name, message: `꺼져 있는 규칙: "${name}"` };
			}
			return { ok: true as const, rule: found };
		});
}
