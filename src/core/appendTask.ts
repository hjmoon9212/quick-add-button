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

/** 넣는 데 성공했을 때 어디에 넣었는지. 실패하면 null. */
export interface Inserted {
	file: TFile;
	/** 0-based 줄 번호 */
	index: number;
}

/** 조립된 task 한 줄을 규칙이 가리키는 헤딩 아래에 넣는다. */
export async function appendTask(
	app: App,
	rule: RuleDef,
	line: string,
	atTop: boolean
): Promise<Inserted | null> {
	const file = app.vault.getAbstractFileByPath(rule.file);
	if (!(file instanceof TFile)) {
		new Notice(`⚠️ 파일을 찾을 수 없습니다: ${rule.file}`);
		return null;
	}

	const index = await insertTaskLine(
		app,
		file,
		line,
		rule.heading,
		rule.level,
		atTop
	);
	if (index === null) {
		new Notice(`⚠️ 헤딩을 찾지 못했습니다: ${rule.heading}`);
		return null;
	}
	new Notice(`✅ 추가됨 → ${targetLabel(rule)}`);
	return { file, index };
}

/**
 * 넣은 줄로 이동한다. 지금 보고 있는 탭을 쓴다 — "이동"이니까.
 *
 * 이미 열려 있는 탭을 찾아 가는 방법도 있지만, 백그라운드 탭은 deferred 라
 * view.file 이 비어 있어 믿을 수 없다. 현재 탭에 여는 쪽이 예측 가능하다.
 */
export async function revealInserted(app: App, at: Inserted): Promise<void> {
	await app.workspace
		.getLeaf(false)
		.openFile(at.file, { eState: { line: at.index }, active: true });
}
