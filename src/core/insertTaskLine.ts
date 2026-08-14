import { App, TFile } from "obsidian";
import { findInsertIndex } from "./findInsertIndex";

/**
 * 지정한 헤딩 아래에 한 줄을 넣고 **넣은 줄 번호**를 돌려준다.
 * 헤딩을 못 찾으면 파일을 고치지 않고 null.
 *
 * 줄 번호를 돌려주는 건 "추가 후 그 노트로 이동" 이 그 줄에 커서를 두기 위해서다.
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
): Promise<number | null> {
	if (!heading) return null;
	let inserted: number | null = null;

	await app.vault.process(file, (data) => {
		const lines = data.split("\n");
		const at = findInsertIndex(lines, heading, level, atTop);
		if (at === null) return data;

		lines.splice(at, 0, line);
		inserted = at;
		return lines.join("\n");
	});

	return inserted;
}
