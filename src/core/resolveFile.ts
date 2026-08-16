import { App, TFile } from "obsidian";
import { CURRENT, resolveRelativePath } from "./paths";

/**
 * 규칙이 가리키는 노트를 찾는다. 못 찾으면 null.
 *
 * sourcePath = 이 버튼을 누른 기준 노트. 코드블록에서 누르면 블록이 놓인 노트,
 * 리본·커맨드에서 누르면 그때 보고 있던 노트다.
 *
 * 해석 순서 — 앞의 것이 이기므로 기존 규칙(볼트 절대경로)의 뜻이 바뀌지 않는다.
 *   1. `@current`      → 기준 노트 자신
 *   2. `./` `../`      → 기준 노트의 폴더에서 편 경로
 *   3. 볼트 절대경로   → 지금까지 저장된 규칙이 전부 이 형태다
 *   4. 링크 해석       → `[[Temp Tasks]]` 와 똑같은 규칙. 이름만 적어도 찾는다
 */
export function resolveTargetFile(
	app: App,
	value: string,
	sourcePath: string
): TFile | null {
	const v = value.trim();
	if (!v) return null;

	if (v === CURRENT) return byPath(app, sourcePath);

	if (v.startsWith("./") || v.startsWith("../")) {
		const abs = resolveRelativePath(sourcePath, v);
		return abs ? byPath(app, abs) : null;
	}

	const direct = byPath(app, v);
	if (direct) return direct;

	// 링크 해석은 sourcePath 를 기준으로 한다 — 같은 이름의 노트가 여럿이면
	// 옵시디언이 링크에서 고르는 것과 같은 것을 고른다.
	return app.metadataCache.getFirstLinkpathDest(v, sourcePath) ?? null;
}

/** `.md` 를 빼먹은 경로도 받아준다 — 링크처럼 적는 사람이 있다. */
function byPath(app: App, path: string): TFile | null {
	if (!path) return null;
	const hit =
		app.vault.getAbstractFileByPath(path) ??
		app.vault.getAbstractFileByPath(`${path}.md`);
	return hit instanceof TFile ? hit : null;
}
