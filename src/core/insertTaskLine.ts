import { App, TFile } from "obsidian";
import { findInsertIndex } from "./findInsertIndex";

/**
 * 지정한 헤딩 아래에 한 줄을 넣는다. 헤딩을 못 찾으면 파일을 고치지 않고 false.
 *
 * 자리를 고르는 건 findInsertIndex 가 하고(테스트가 거기 붙어 있다), 여기서는
 * vault.process 로 원자적으로 쓰기만 한다 — read→modify 사이에 다른 편집이
 * 끼어들지 않는다.
 */
export async function insertTaskLine(
	app: App,
	file: TFile,
	line: string,
	heading: string,
	level: number,
	atTop: boolean
): Promise<boolean> {
	if (!heading) return false;
	let ok = false;

	await app.vault.process(file, (data) => {
		const lines = data.split("\n");
		const at = findInsertIndex(lines, heading, level, atTop);
		if (at === null) return data;

		lines.splice(at, 0, line);
		ok = true;
		return lines.join("\n");
	});

	return ok;
}
