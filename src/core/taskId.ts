import { App } from "obsidian";

const ID_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ID_LEN = 6;

/**
 * 볼트에서 이미 쓰인 🆔 를 모은다.
 *
 * 🆔 는 metadataCache 의 listItems 에 담기지 않으므로(그건 체크 상태와 위치만
 * 안다) 본문을 봐야 한다. 다만 task 가 하나도 없는 파일은 캐시만 보고 건너뛰고,
 * 읽을 때도 cachedRead 를 쓴다 — 현행 dataviewjs 의 dv.pages() 전수 스캔보다
 * 훨씬 적게 만진다.
 */
export async function collectTaskIds(app: App): Promise<Set<string>> {
	const used = new Set<string>();
	const re = /🆔\s*([A-Za-z0-9]+)/g;

	for (const file of app.vault.getMarkdownFiles()) {
		const items = app.metadataCache.getFileCache(file)?.listItems;
		if (!items?.some((i) => i.task !== undefined)) continue;

		const text = await app.vault.cachedRead(file);
		if (!text.includes("🆔")) continue;

		re.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = re.exec(text)) !== null) used.add(m[1]);
	}
	return used;
}

/** 볼트 전역에서 쓰이지 않은 6자리 🆔 를 만든다. */
export async function newTaskId(app: App): Promise<string> {
	const used = await collectTaskIds(app);
	let id: string;
	do {
		id = "";
		for (let i = 0; i < ID_LEN; i++) {
			id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
		}
	} while (used.has(id));
	return id;
}
