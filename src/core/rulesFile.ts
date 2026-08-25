/**
 * 규칙을 `.obsidian` 밖의 볼트 파일에 두기 위한 형식 변환.
 *
 * 왜 밖으로 빼는가 — Obsidian Sync 의 「설치된 커뮤니티 플러그인」은 플러그인
 * 폴더를 통째로 옮긴다. 즉 규칙(`data.json`)을 기기끼리 나눠 가지려면 코드
 * (`main.js`)까지 같이 오가고, 오래 잠들었던 기기가 옛 코드를 밀어 올려
 * 롤백을 만든다. 규칙만 볼트 파일로 내보내면 그 토글을 끈 채로 규칙은
 * 공유된다 — 볼트 파일은 항상 동기화되고 버전 기록도 남는다.
 *
 * 여기에는 obsidian 을 import 하지 않는다. 형식 변환만 담아 테스트한다.
 */

/** `.md` 안에 넣을 때 쓰는 코드블록. 첫 번째 json 블록만 본다. */
const FENCE = /```json\s*\r?\n([\s\S]*?)\r?\n```/;

const HEADER =
	"> [!info] quick-add-button 규칙\n" +
	"> 아래 블록은 플러그인이 다시 쓴다. 버튼은 설정창에서 고칠 것.\n\n";

export function isMarkdown(path: string): boolean {
	return path.toLowerCase().endsWith(".md");
}

/**
 * 파일 내용에서 JSON 부분만 꺼낸다.
 * 노트면 ```json 블록 안, 아니면 파일 전체.
 */
export function unwrapRules(text: string): string {
	const m = FENCE.exec(text);
	return (m ? m[1] : text).trim();
}

/**
 * 파일에 적을 내용을 만든다.
 *
 * 노트일 때 이미 있던 글은 남기고 블록만 갈아 끼운다 — 사용자가 그 노트에
 * 설명을 적어 뒀을 수 있고, 저장할 때마다 그걸 날리면 노트로 둘 이유가 없다.
 */
export function wrapRules(json: string, path: string, previous = ""): string {
	if (!isMarkdown(path)) return `${json}\n`;
	const block = "```json\n" + json + "\n```";
	if (FENCE.test(previous)) return previous.replace(FENCE, block);
	const head = previous.trim() ? `${previous.trimEnd()}\n\n` : HEADER;
	return `${head}${block}\n`;
}

/** 규칙 파일의 알맹이. 못 읽으면 null — 부르는 쪽이 알리고 멈춘다. */
export function parseRules(text: string): { rules: unknown[] } | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(unwrapRules(text));
	} catch {
		return null;
	}
	if (Array.isArray(parsed)) return { rules: parsed };
	const obj = parsed as { rules?: unknown };
	if (obj && Array.isArray(obj.rules)) return { rules: obj.rules };
	return null;
}
