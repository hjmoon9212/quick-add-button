import { App, TAbstractFile, TFile, TFolder } from "obsidian";

export type Result<T> = { ok: true; value: T } | { ok: false; message: string };

/**
 * 블록이 렌더된 노트를 허브로 해석한다.
 *
 * 현행 dataviewjs 는 app.workspace.getActiveFile() 을 썼는데, 그러면 사이드바나
 * 호버 팝오버에서 렌더될 때 엉뚱한 노트를 허브로 오인한다. CodeBlockProcessor 는
 * ctx.sourcePath 를 주므로 그 문제가 구조적으로 없다.
 */
export function resolveHub(
	app: App,
	sourcePath: string,
	requireType: string | false
): Result<TFile> {
	const f = app.vault.getAbstractFileByPath(sourcePath);
	if (!(f instanceof TFile)) {
		return { ok: false, message: "현재 노트를 찾을 수 없습니다" };
	}
	if (requireType) {
		const type = app.metadataCache.getFileCache(f)?.frontmatter?.["Type"];
		if (type !== requireType) {
			return {
				ok: false,
				message: `허브 노트(Type: ${requireType})에서만 사용할 수 있습니다`,
			};
		}
	}
	return { ok: true, value: f };
}

/** 허브 노트가 놓인 폴더 경로. 볼트 루트면 "" (앞의 "/" 를 만들지 않는다). */
export function hubFolder(hub: TFile): string {
	const p = hub.parent?.path ?? "";
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
 *   "@current"   → 블록이 있는 노트
 *   "@hub/…"     → 허브 폴더 기준 상대
 *   그 외         → 볼트 절대경로
 */
export function resolveTargetPath(spec: string, hub: TFile): string {
	if (spec === "@current") return hub.path;
	if (spec.startsWith("@hub/")) return joinPath(hubFolder(hub), spec.slice(5));
	if (spec === "@hub") return hubFolder(hub);
	return spec.replace(/^\/+/, "");
}

/**
 * 폴더가 있게 만든다. 그 자리에 동명 "파일"이 있으면 만들지 않고 에러를 돌려준다
 * (현행 dataviewjs 의 분리 체크를 그대로 유지 — 실제 사고에서 나온 방어다).
 */
export async function ensureFolder(app: App, path: string): Promise<Result<TFolder>> {
	if (!path) return { ok: false, message: "폴더 경로가 비었습니다" };

	const existing: TAbstractFile | null = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFolder) return { ok: true, value: existing };
	if (existing) {
		return { ok: false, message: `같은 이름의 파일이 존재합니다: ${path}` };
	}
	try {
		const created = await app.vault.createFolder(path);
		return { ok: true, value: created };
	} catch (e) {
		// 동시 생성 등으로 이미 만들어졌을 수 있다.
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
