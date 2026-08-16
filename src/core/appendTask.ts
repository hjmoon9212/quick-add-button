import { App, MarkdownView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import { RuleDef } from "../settings/Settings";
import { insertTaskLine } from "./insertTaskLine";
import { CURRENT, isDynamicTarget } from "./paths";
import { resolveTargetFile } from "./resolveFile";

/**
 * 규칙이 가리키는 자리를 사람이 읽는 한 줄로.
 *
 * 파일이 실제로 뭔지 아는 자리(폼)에서는 푼 파일을 넘긴다 — `@current › 할 일`
 * 보다 `2026-08-16 › 할 일` 이 낫다. 설정탭처럼 기준 노트가 없는 자리에서는
 * 토큰을 그대로 읽히게 둔다.
 */
export function targetLabel(rule: RuleDef, resolved?: TFile | null): string {
	const where = resolved
		? baseName(resolved.path)
		: rule.file === CURRENT
			? "이 노트"
			: baseName(rule.file);
	return `${where} › ${rule.heading}`;
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

/**
 * 조립된 task 한 줄을 규칙이 가리키는 헤딩 아래에 넣는다.
 * sourcePath = 이 버튼을 누른 기준 노트 (`@current` · 상대경로 · 링크 해석의 기준).
 */
export async function appendTask(
	app: App,
	rule: RuleDef,
	line: string,
	atTop: boolean,
	sourcePath: string
): Promise<Inserted | null> {
	const file = resolveTargetFile(app, rule.file, sourcePath);
	if (!file) {
		new Notice(
			isDynamicTarget(rule.file) && !sourcePath
				? `⚠️ 기준이 될 노트가 없습니다: ${rule.file}`
				: `⚠️ 파일을 찾을 수 없습니다: ${rule.file}`
		);
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
	new Notice(`✅ 추가됨 → ${targetLabel(rule, file)}`);
	return { file, index };
}

/**
 * 넣은 줄이 보이게 노트를 띄운다. 세 갈래다 — **이미 있는 것을 먼저 쓴다.**
 *
 *   1. 지금 보고 있는 노트   → 다시 열지 않고 스크롤만
 *   2. 다른 탭에 열려 있음   → 그 탭을 앞으로 (새 탭을 만들지 않는다)
 *   3. 어디에도 없음         → 지금 탭에 연다
 *
 * 1이 필요한 이유: 버튼 블록과 넣을 헤딩이 같은 노트에 있는 경우가 흔한데,
 * 여기서 파일을 다시 열면 편집 중이던 상태가 통째로 튄다. 그렇다고 아무것도
 * 안 하면 헤딩이 화면 밖일 때 "이동"이 안 되는 것처럼 보인다 — 그래서 스크롤만.
 *
 * **포커스는 어느 갈래에서도 옮기지 않는다.** 폼을 열어 둔 채 부르므로 탭이
 * 포커스를 가져가면 입력칸에서 커서가 빠져 연속 추가가 끊긴다. scrollIntoView 는
 * 포커스를 안 건드리고, openFile 과 setActiveLeaf 에는 각각 active·focus 를
 * 꺼서 넘긴다.
 */
export async function revealInserted(app: App, at: Inserted): Promise<void> {
	const active = app.workspace.getActiveViewOfType(MarkdownView);
	if (active?.file?.path === at.file.path) {
		scrollTo(active, at.index);
		return;
	}

	const leaf = findLeafFor(app, at.file.path);
	if (leaf) {
		// 이미 그 노트를 들고 있는 탭이다. 백그라운드 탭은 deferred 라 editor 가
		// 아직 없을 수 있으므로, openFile 로 로드시키고 eState 로 줄을 맞춘다.
		await leaf.openFile(at.file, { eState: { line: at.index }, active: false });
		app.workspace.setActiveLeaf(leaf, { focus: false });
		return;
	}

	await app.workspace
		.getLeaf(false)
		.openFile(at.file, { eState: { line: at.index }, active: false });
}

function scrollTo(view: MarkdownView, line: number): void {
	const pos = { line, ch: 0 };
	view.editor.scrollIntoView({ from: pos, to: pos }, true);
}

/**
 * 그 노트를 이미 열어 둔 탭. 없으면 null.
 *
 * `leaf.view.file` 은 못 쓴다 — 백그라운드 탭은 deferred 라 뷰가 아직 안 만들어져
 * 있다. 뷰를 건드리지 않는 getViewState() 는 그 상태에서도 경로를 들고 있다.
 *
 * 사이드바에 같은 노트가 떠 있는 경우가 있어 **본문 영역을 먼저** 고른다.
 */
function findLeafFor(app: App, path: string): WorkspaceLeaf | null {
	let main: WorkspaceLeaf | null = null;
	let other: WorkspaceLeaf | null = null;

	app.workspace.iterateAllLeaves((leaf) => {
		const state = leaf.getViewState();
		if (state.type !== "markdown") return;
		if ((state.state as { file?: string } | undefined)?.file !== path) return;

		if (leaf.getRoot() === app.workspace.rootSplit) main ??= leaf;
		else other ??= leaf;
	});

	return main ?? other;
}
