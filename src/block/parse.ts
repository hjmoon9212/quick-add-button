import { HubButtonSettings, HubTypeDef } from "../settings/Settings";

/** 코드블록이 요청한 버튼 하나. 레지스트리 참조이거나 애드혹 정의다. */
export interface ButtonSpec {
	type?: string;
	label?: string;
	folder?: string;
	template?: string;
}

export interface BlockSpec {
	requireType: string | false;
	buttons: ButtonSpec[];
}

export type ParseResult =
	| { ok: true; spec: BlockSpec }
	| { ok: false; message: string };

/**
 * 코드블록 본문을 읽는다. YAML 라이브러리는 쓰지 않는다 — 값이 스칼라와
 * 콤마 목록, 그리고 buttons 아래의 얕은 리스트뿐이라 의존성이 값을 못 한다.
 *
 * 지원 형식:
 *   types: Meeting, Issue, Doc
 *   requireType: Project-Hub | false
 *   buttons:
 *     - Meeting
 *     - type: Doc
 *       label: 📚 …
 *     - label: 🐛 결함 추가
 *       folder: 결함
 *       template: Template/Defect.md
 */
export function parseBlock(
	source: string,
	settings: HubButtonSettings
): ParseResult {
	const spec: BlockSpec = {
		requireType: settings.requireHubType || false,
		buttons: [],
	};

	const lines = source.split("\n");
	let inButtons = false;
	let current: ButtonSpec | null = null;

	const flush = () => {
		if (current) spec.buttons.push(current);
		current = null;
	};

	for (const raw of lines) {
		const line = raw.replace(/\s+$/, "");
		if (!line.trim() || line.trim().startsWith("#")) continue;

		const indent = line.length - line.trimStart().length;
		const body = line.trim();

		if (indent === 0 && !body.startsWith("-")) {
			flush();
			inButtons = false;

			const m = body.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
			if (!m) return { ok: false, message: `해석할 수 없는 줄: ${body}` };
			const [, key, value] = m;

			switch (key) {
				case "types":
					for (const t of splitList(value)) spec.buttons.push({ type: t });
					break;
				case "requireType":
					spec.requireType =
						value === "false" || value === "no" ? false : value || false;
					break;
				case "buttons":
					if (value) return { ok: false, message: "buttons: 는 값 없이 쓰고 아래에 목록을 적으세요" };
					inButtons = true;
					break;
				default:
					return { ok: false, message: `알 수 없는 항목: ${key}` };
			}
			continue;
		}

		if (!inButtons) {
			return { ok: false, message: `buttons: 밖에서는 목록을 쓸 수 없습니다: ${body}` };
		}

		if (body.startsWith("-")) {
			flush();
			const rest = body.slice(1).trim();
			current = {};
			if (!rest) continue;
			const kv = rest.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
			if (kv) assign(current, kv[1], kv[2]);
			else current.type = rest; // "- Meeting" 축약형
			continue;
		}

		if (!current) {
			return { ok: false, message: `목록 항목 밖의 속성: ${body}` };
		}
		const kv = body.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
		if (!kv) return { ok: false, message: `해석할 수 없는 줄: ${body}` };
		assign(current, kv[1], kv[2]);
	}
	flush();

	if (!spec.buttons.length) {
		return {
			ok: false,
			message: "표시할 버튼이 없습니다. `types: Meeting, Issue` 처럼 적어주세요.",
		};
	}
	return { ok: true, spec };
}

function assign(b: ButtonSpec, key: string, value: string): void {
	const v = unquote(value);
	switch (key) {
		case "type":
			b.type = v;
			break;
		case "label":
			b.label = v;
			break;
		case "folder":
			b.folder = v;
			break;
		case "template":
			b.template = v;
			break;
	}
}

function unquote(v: string): string {
	const t = v.trim();
	if (
		(t.startsWith('"') && t.endsWith('"')) ||
		(t.startsWith("'") && t.endsWith("'"))
	) {
		return t.slice(1, -1);
	}
	return t;
}

function splitList(v: string): string[] {
	return v
		.split(",")
		.map((s) => unquote(s))
		.filter((s) => s.length > 0);
}

export type ResolvedButton =
	| { ok: true; def: HubTypeDef }
	| { ok: false; typeName: string; message: string };

/** 코드블록의 버튼 요청을 레지스트리와 합쳐 실제 정의로 만든다. */
export function resolveButtons(
	spec: BlockSpec,
	settings: HubButtonSettings
): ResolvedButton[] {
	return spec.buttons.map((b) => {
		if (b.type) {
			const found = settings.types.find((t) => t.name === b.type);
			if (!found) {
				return {
					ok: false,
					typeName: b.type,
					message: `등록되지 않은 타입: "${b.type}"`,
				};
			}
			if (!found.enabled) {
				return {
					ok: false,
					typeName: b.type,
					message: `비활성 상태의 규칙: "${b.type}"`,
				};
			}
			return {
				ok: true,
				def: {
					...found,
					label: b.label ?? found.label,
					folder: b.folder ?? found.folder,
					template: b.template ?? found.template,
				},
			};
		}

		// 애드혹 — 레지스트리에 없는 1회용 버튼
		if (!b.label || !b.folder || !b.template) {
			return {
				ok: false,
				typeName: b.label ?? "(이름 없음)",
				message: "애드혹 버튼에는 label · folder · template 이 모두 필요합니다",
			};
		}
		return {
			ok: true,
			def: {
				name: b.label,
				label: b.label,
				action: "create-note",
				enabled: true,
				folder: b.folder,
				template: b.template,
			},
		};
	});
}
