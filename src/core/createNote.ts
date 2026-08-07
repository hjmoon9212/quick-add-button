import { App, Notice, TFile } from "obsidian";
import { HubButtonSettings, HubTypeDef } from "../settings/Settings";
import { ensureFolder, errMsg, hubFolder, joinPath } from "./resolve";
import { hasTemplater, runTemplater } from "./templater";

/**
 * 템플릿 기반으로 하위 노트를 만들고 허브로 백링크를 건다.
 *
 * 현행 dataviewjs 대비 순서를 바꿨다:
 *   현행: 템플릿 읽기 → 정규식 Project 치환 → create → openFile → setTimeout(Templater)
 *   신규: 템플릿 읽기 → create → await Templater → frontmatter 주입 → openFile
 *
 * Templater 를 먼저 돌리면 그것이 frontmatter 를 재작성해도 백링크가 살아남고,
 * openFile 을 마지막으로 미루면 "빈 템플릿이 잠깐 보였다 치환되는" 깜빡임이 없다.
 */
export async function createNote(
	app: App,
	hub: TFile,
	def: HubTypeDef,
	settings: HubButtonSettings,
	name: string
): Promise<void> {
	const folderPath = joinPath(hubFolder(hub), def.folder ?? "");
	const folder = await ensureFolder(app, folderPath);
	if (!folder.ok) {
		new Notice(`⚠️ ${folder.message}`);
		return;
	}

	const path = `${folderPath}/${name}.md`;
	if (app.vault.getAbstractFileByPath(path)) {
		new Notice(`⚠️ 이미 존재합니다: ${path}`);
		return;
	}

	const tplPath = def.template ?? "";
	const tpl = app.vault.getAbstractFileByPath(tplPath);
	if (!(tpl instanceof TFile)) {
		new Notice(`⚠️ 템플릿이 없습니다: ${tplPath}`);
		return;
	}

	let file: TFile;
	try {
		file = await app.vault.create(path, await app.vault.read(tpl));
	} catch (e) {
		new Notice(`⚠️ 노트 생성 실패: ${errMsg(e)}`);
		return;
	}

	// Templater 실패는 노트 생성을 되돌리지 않는다. 안내만 하고 계속 진행한다.
	if (settings.runTemplater) {
		if (!hasTemplater(app)) {
			new Notice("Templater 가 없어 <% … %> 를 치환하지 못했습니다");
		} else if (!(await runTemplater(app, file))) {
			new Notice("Templater 치환에 실패했습니다");
		}
	}

	// 정규식 치환 대신 frontmatter 키를 직접 세팅한다. 현행은 Project: "[[ ]]" 라는
	// 정확한 표기를 정규식으로 찾았기 때문에 따옴표/공백이 어긋나면 조용히 실패했다.
	if (settings.linkField) {
		try {
			await app.fileManager.processFrontMatter(file, (fm) => {
				fm[settings.linkField] = `[[${hub.basename}]]`;
			});
		} catch (e) {
			new Notice(`백링크 주입 실패: ${errMsg(e)}`);
		}
	}

	await app.workspace.getLeaf().openFile(file);
	new Notice(`✅ 생성됨 → ${path}`);
}
