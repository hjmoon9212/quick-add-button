import { App, Notice, TFile } from "obsidian";
import { RuleDef } from "../settings/Settings";
import { insertTaskLine } from "./insertTaskLine";

/** 규칙이 가리키는 자리를 사람이 읽는 한 줄로. */
export function targetLabel(rule: RuleDef): string {
	return `${baseName(rule.file)} › ${rule.heading}`;
}

export function baseName(path: string): string {
	const f = path.slice(path.lastIndexOf("/") + 1);
	return f.endsWith(".md") ? f.slice(0, -3) : f;
}

/** 조립된 task 한 줄을 규칙이 가리키는 헤딩 아래에 넣는다. */
export async function appendTask(
	app: App,
	rule: RuleDef,
	line: string,
	atTop: boolean
): Promise<boolean> {
	const file = app.vault.getAbstractFileByPath(rule.file);
	if (!(file instanceof TFile)) {
		new Notice(`⚠️ 파일을 찾을 수 없습니다: ${rule.file}`);
		return false;
	}

	const ok = await insertTaskLine(
		app,
		file,
		line,
		rule.heading,
		rule.level,
		atTop
	);
	if (!ok) {
		new Notice(`⚠️ 헤딩을 찾지 못했습니다: ${rule.heading}`);
		return false;
	}
	new Notice(`✅ 추가됨 → ${targetLabel(rule)}`);
	return true;
}
