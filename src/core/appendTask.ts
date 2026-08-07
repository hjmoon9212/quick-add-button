import { App, Notice, TFile } from "obsidian";
import { RuleDef, TaskTarget } from "../settings/Settings";
import { HeadingRef, insertTaskLine, scanHeadings } from "./insertTaskLine";
import { ensureFile, resolveTargetPath } from "./resolve";

/** 폼의 대상 드롭다운 한 항목. */
export interface ResolvedTarget {
	label: string;
	path: string;
	/** "" 이면 헤딩이 아니라 파일 기준(filePos) 으로 넣는다 */
	heading: string;
	level: number;
	filePos: "start" | "end";
	createFrom?: string;
}

/**
 * 규칙의 targets[] 를 버튼을 누른 순간의 실제 선택지로 펼친다.
 * headings: "h1-h3" 인 항목은 그 파일의 헤딩 개수만큼 늘어나고, 헤딩 밖에 넣고
 * 싶을 때를 위해 파일 시작 / 파일 끝도 함께 붙는다.
 */
export async function expandTargets(
	app: App,
	def: RuleDef,
	note: TFile
): Promise<ResolvedTarget[]> {
	const out: ResolvedTarget[] = [];

	for (const t of def.targets) {
		const path = resolveTargetPath(t.file, note);
		if (t.headings === "h1-h3") {
			out.push(...(await expandHeadings(app, t, path, note)));
		} else {
			const heading = t.heading ?? "";
			const filePos = t.filePos === "start" ? "start" : "end";
			out.push({
				label: t.label || defaultLabel(path, heading, filePos),
				path,
				heading,
				level: t.level ?? 0,
				filePos,
				createFrom: t.createFrom,
			});
		}
	}
	return out;
}

async function expandHeadings(
	app: App,
	t: TaskTarget,
	path: string,
	note: TFile
): Promise<ResolvedTarget[]> {
	const file = app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) return [];

	// 캐시가 아니라 본문을 스캔한다. 삽입 로직과 같은 규칙(코드펜스 무시)으로 봐야
	// 드롭다운에 뜬 헤딩과 실제로 들어가는 자리가 어긋나지 않는다.
	const headings: HeadingRef[] = scanHeadings(await app.vault.cachedRead(file));
	const prefix = t.label || (path === note.path ? "현재 노트" : baseName(path));

	const rows: ResolvedTarget[] = headings.map((h) => ({
		label: `${prefix} › ${"·".repeat(h.level - 1)}${h.heading}`,
		path,
		heading: h.heading,
		level: h.level,
		filePos: "end" as const,
		createFrom: t.createFrom,
	}));

	rows.push(
		{
			label: `${prefix} › (파일 시작)`,
			path,
			heading: "",
			level: 0,
			filePos: "start",
			createFrom: t.createFrom,
		},
		{
			label: `${prefix} › (파일 끝)`,
			path,
			heading: "",
			level: 0,
			filePos: "end",
			createFrom: t.createFrom,
		}
	);

	return rows;
}

function baseName(path: string): string {
	const f = path.slice(path.lastIndexOf("/") + 1);
	return f.endsWith(".md") ? f.slice(0, -3) : f;
}

function defaultLabel(
	path: string,
	heading: string,
	filePos: "start" | "end"
): string {
	if (heading) return `${baseName(path)} › ${heading}`;
	return `${baseName(path)} › (파일 ${filePos === "start" ? "시작" : "끝"})`;
}

/** 조립된 task 한 줄을 대상에 넣는다. */
export async function appendTask(
	app: App,
	target: ResolvedTarget,
	line: string,
	atTop: boolean
): Promise<boolean> {
	const file = await ensureFile(app, target.path, target.createFrom);
	if (!file.ok) {
		new Notice(`⚠️ ${file.message}`);
		return false;
	}

	const ok = await insertTaskLine(
		app,
		file.value,
		line,
		target.heading,
		target.level,
		atTop,
		target.filePos
	);
	if (!ok) {
		new Notice(`⚠️ 섹션을 찾지 못했습니다: ${target.heading || target.path}`);
		return false;
	}
	new Notice(`✅ 추가됨 → ${target.label}`);
	return true;
}
