import { App, TAbstractFile, TFile, TFolder } from "obsidian";

export type Result<T> = { ok: true; value: T } | { ok: false; message: string };

/**
 * 블록이 렌더된 노트를 잡는다.
 *
 * 현행 dataviewjs 는 app.workspace.getActiveFile() 을 썼는데, 그러면 사이드바나
 * 호버 팝오버에서 렌더될 때 엉뚱한 노트를 잡는다. CodeBlockProcessor 는
 * ctx.sourcePath 를 주므로 그 문제가 구조적으로 없다.
 */
export function resolveNote(app: App, sourcePath: string): Result<TFile> {
	const f = app.vault.getAbstractFileByPath(sourcePath);
	if (!(f instanceof TFile)) {
		return { ok: false, message: "현재 노트를 찾을 수 없습니다" };
	}
	return { ok: true, value: f };
}

/** 노트가 놓인 폴더 경로. 볼트 루트면 "" (앞에 "/" 를 만들지 않는다). */
export function noteFolder(note: TFile): string {
	const p = note.parent?.path ?? "";
	return p === "/" ? "" : p;
}

export function joinPath(...parts: string[]): string {
	return parts
		.filter((p) => p !== "" && p !== "/")
		.map((p) => p.replace(/^\/+|\/+$/g, ""))
		.join("/");
}

/**
 * 경로 토큰을 실제 볼트 경로로 푼다.
 *   "@current"   → 버튼이 있는 노트
 *   "@folder/…"  → 그 노트가 있는 폴더 기준 상대
 *   그 외         → 볼트 절대경로
 */
export function resolveTargetPath(spec: string, note: TFile): string {
	if (spec === "@current") return note.path;
	if (spec.startsWith("@folder/")) return joinPath(noteFolder(note), spec.slice(8));
	return spec.replace(/^\/+/, "");
}

/** 폴더가 있게 만든다. 그 자리에 동명 "파일"이 있으면 만들지 않고 알린다. */
export async function ensureFolder(app: App, path: string): Promise<Result<TFolder>> {
	if (!path) return { ok: false, message: "폴더 경로가 비었습니다" };

	const existing: TAbstractFile | null = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFolder) return { ok: true, value: existing };
	if (existing) {
		return { ok: false, message: `같은 이름의 파일이 존재합니다: ${path}` };
	}
	try {
		return { ok: true, value: await app.vault.createFolder(path) };
	} catch (e) {
		const again = app.vault.getAbstractFileByPath(path);
		if (again instanceof TFolder) return { ok: true, value: again };
		return { ok: false, message: `폴더 생성 실패: ${errMsg(e)}` };
	}
}

/** 대상 파일을 얻고, 없으면 createFrom 템플릿(또는 빈 파일)으로 만든다. */
export async function ensureFile(
	app: App,
	path: string,
	createFrom?: string
): Promise<Result<TFile>> {
	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) return { ok: true, value: existing };
	if (existing) return { ok: false, message: `같은 이름의 폴더가 존재합니다: ${path}` };

	const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
	if (parent) {
		const folder = await ensureFolder(app, parent);
		if (!folder.ok) return folder;
	}

	let content = "";
	if (createFrom) {
		const tpl = app.vault.getAbstractFileByPath(createFrom);
		if (tpl instanceof TFile) content = await app.vault.read(tpl);
	}
	try {
		return { ok: true, value: await app.vault.create(path, content) };
	} catch (e) {
		const again = app.vault.getAbstractFileByPath(path);
		if (again instanceof TFile) return { ok: true, value: again };
		return { ok: false, message: `파일 생성 실패: ${errMsg(e)}` };
	}
}

export function errMsg(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}
