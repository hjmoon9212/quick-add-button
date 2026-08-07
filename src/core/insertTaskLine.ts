import { App, TFile } from "obsidian";

export interface HeadingRef {
	heading: string;
	level: number;
}

/** 코드펜스 안의 "#" 을 헤딩으로 오인하지 않고 H1~H3 를 모은다. */
export function scanHeadings(text: string, maxLevel = 3): HeadingRef[] {
	const out: HeadingRef[] = [];
	let fence = false;
	for (const line of text.split("\n")) {
		if (/^\s*(```|~~~)/.test(line)) {
			fence = !fence;
			continue;
		}
		if (fence) continue;
		const m = line.match(/^(#{1,6})\s+(.*?)\s*$/);
		if (m && m[1].length <= maxLevel) {
			out.push({ heading: m[2], level: m[1].length });
		}
	}
	return out;
}

/** 프론트매터가 끝나는 다음 줄 번호. 없으면 0. */
export function bodyStart(lines: string[]): number {
	if (lines[0]?.trim() !== "---") return 0;
	for (let i = 1; i < lines.length; i++) {
		if (lines[i].trim() === "---") return i + 1;
	}
	return 0; // 닫히지 않은 프론트매터는 프론트매터로 보지 않는다
}

/**
 * 지정한 헤딩 섹션의 끝(또는 맨 위)에 한 줄을 넣는다.
 * heading 이 "" 이면 filePos 에 따라 파일 시작 또는 파일 끝에 넣는다.
 *
 * 섹션의 끝 = 다음 동급/상위 헤딩 직전. 코드펜스 안은 헤딩으로 보지 않는다 —
 * 실제로 Temp Tasks.md 에는 ``` fold 블록 안에 표가 들어 있다.
 *
 * vault.process 를 쓰므로 read→modify 사이에 다른 편집이 끼어들지 않는다.
 */
export async function insertTaskLine(
	app: App,
	file: TFile,
	line: string,
	heading: string,
	level: number,
	atTop: boolean,
	filePos: "start" | "end" = "end"
): Promise<boolean> {
	let ok = false;

	await app.vault.process(file, (data) => {
		const lines = data.split("\n");

		if (!heading) {
			let at: number;
			if (filePos === "start") {
				// 프론트매터 아래로 넣는다. 위에 얹으면 YAML 이 깨진다.
				at = bodyStart(lines);
				while (at < lines.length && lines[at].trim() === "") at++;
			} else {
				at = lines.length;
				while (at > 0 && lines[at - 1].trim() === "") at--;
			}
			lines.splice(at, 0, line);
			ok = true;
			return lines.join("\n");
		}

		let fence = false;
		let hIdx = -1;
		let hLevel = level;

		for (let i = 0; i < lines.length; i++) {
			if (/^\s*(```|~~~)/.test(lines[i])) {
				fence = !fence;
				continue;
			}
			if (fence) continue;
			const m = lines[i].match(/^(#{1,6})\s+(.*?)\s*$/);
			if (!m || m[2] !== heading) continue;
			// level 이 0 이면 텍스트만으로 매칭 (설정에 레벨이 없는 경우)
			if (level && m[1].length !== level) continue;
			hIdx = i;
			hLevel = m[1].length;
			break;
		}
		if (hIdx < 0) return data;

		let end = lines.length;
		fence = false;
		for (let i = hIdx + 1; i < lines.length; i++) {
			if (/^\s*(```|~~~)/.test(lines[i])) {
				fence = !fence;
				continue;
			}
			if (fence) continue;
			const m = lines[i].match(/^(#{1,6})\s+/);
			if (m && m[1].length <= hLevel) {
				end = i;
				break;
			}
		}

		let at: number;
		if (atTop) {
			at = hIdx + 1;
			while (at < end && lines[at].trim() === "") at++;
		} else {
			at = end;
			while (at > hIdx + 1 && lines[at - 1].trim() === "") at--;
		}

		lines.splice(at, 0, line);
		ok = true;
		return lines.join("\n");
	});

	return ok;
}
