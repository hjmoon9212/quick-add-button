import { App, TFile } from "obsidian";

interface TemplaterLike {
	overwrite_file_commands?: (file: TFile, active?: boolean) => Promise<void>;
}

function getTemplater(app: App): TemplaterLike | null {
	const plugins = (app as unknown as {
		plugins?: { plugins?: Record<string, { templater?: TemplaterLike }> };
	}).plugins?.plugins;
	return plugins?.["templater-obsidian"]?.templater ?? null;
}

export function hasTemplater(app: App): boolean {
	return getTemplater(app) !== null;
}

/**
 * 새로 만든 노트의 <% … %> 를 치환한다.
 *
 * 현행 dataviewjs 는 setTimeout(…, 100) 뒤에 커맨드를 쏘는 레이스였고, 가이드
 * 문서 트러블슈팅에도 "200~300ms로 조정"이 적혀 있었다. API 를 await 하면
 * 그 튜닝 자체가 필요 없어진다.
 *
 * 실패해도 던지지 않는다 — 노트 생성 자체는 이미 성공했으므로 되돌리지 않고
 * 호출자가 Notice 만 띄우게 한다.
 */
export async function runTemplater(app: App, file: TFile): Promise<boolean> {
	const tp = getTemplater(app);
	if (tp?.overwrite_file_commands) {
		try {
			await tp.overwrite_file_commands(file);
			return true;
		} catch {
			/* 폴백으로 내려간다 */
		}
	}
	// API 형태가 바뀐 경우를 위한 폴백. 활성 파일 대상이라 정확도가 떨어지므로
	// 어디까지나 차선책이다.
	const commands = (app as unknown as {
		commands?: { executeCommandById?: (id: string) => boolean };
	}).commands;
	try {
		return !!commands?.executeCommandById?.(
			"templater-obsidian:replace-in-file-templater"
		);
	} catch {
		return false;
	}
}
