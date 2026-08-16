/**
 * 규칙의 `file` 값을 다루는 순수 함수들. obsidian 을 안 쓰므로 테스트할 수 있다
 * — findInsertIndex 와 같은 이유로 여기 따로 둔다.
 */

/** 규칙의 file 값이 "지금 보고 있는 노트" 를 뜻하는 토큰. */
export const CURRENT = "@current";

/**
 * 여는 시점마다 가리키는 노트가 달라지는 값인가.
 *
 * 설정탭의 ⚠️ 검사와 규칙 편집의 헤딩 드롭다운은 "파일 하나"를 전제로 하는데,
 * 이런 값은 그 전제가 깨진다. 그래서 두 곳 다 이 함수로 갈라진다.
 *
 * 이름만 적은 값(`Temp Tasks`)은 **고정**이다 — 링크 해석은 볼트 전역이라
 * 어느 노트에서 눌러도 같은 노트를 가리킨다.
 */
export function isDynamicTarget(value: string): boolean {
	const v = value.trim();
	return v === CURRENT || v.startsWith("./") || v.startsWith("../");
}

/**
 * 현재 노트 폴더 기준 상대경로를 볼트 절대경로로 편다.
 *
 * 볼트 밖으로 나가면(`../` 가 루트를 넘김) null — 그런 경로는 가리킬 노트가 없다.
 * 기준 노트가 없어도(리본을 눌렀는데 아무 노트도 안 열려 있는 경우) null.
 */
export function resolveRelativePath(
	sourcePath: string,
	rel: string
): string | null {
	if (!sourcePath) return null;

	const cut = sourcePath.lastIndexOf("/");
	const parts = cut < 0 ? [] : sourcePath.slice(0, cut).split("/");

	for (const seg of rel.split("/")) {
		if (!seg || seg === ".") continue;
		if (seg === "..") {
			if (!parts.length) return null;
			parts.pop();
			continue;
		}
		parts.push(seg);
	}

	return parts.length ? parts.join("/") : null;
}
