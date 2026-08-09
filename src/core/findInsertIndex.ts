/**
 * 할일 한 줄을 넣을 줄 번호를 고른다. obsidian 을 안 쓰는 순수 함수라 테스트할 수
 * 있다 — 사용자 노트를 고치는 유일한 로직이므로 여기가 검증 대상이다.
 */

/** 여는/닫는 코드펜스. 정보문자열까지 나눠 잡는다. */
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
/** ATX 헤딩. CommonMark 대로 앞 공백 3칸까지 허용한다. */
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*$/;
/** 목록 항목. `- [ ] …` 도 `1. …` 도 여기 걸린다. */
const LIST_ITEM = /^\s*([-*+]|\d+[.)])\s/;

/**
 * 각 줄이 코드펜스 안(또는 펜스 줄 자신)인지 표시한다.
 *
 * 마커의 **문자와 길이**를 기억해야 한다. ```` 블록 안의 ``` 은 닫는 펜스가
 * 아니고, ~~~ 는 ``` 을 닫지 못한다. 한 번 뒤집히면 그 뒤 헤딩 판정이 통째로
 * 반대가 되어 엉뚱한 섹션에 쓰게 된다.
 */
function codeMask(lines: string[]): boolean[] {
	const mask = new Array<boolean>(lines.length).fill(false);
	let open = "";

	for (let i = 0; i < lines.length; i++) {
		const m = lines[i].match(FENCE);

		if (!open) {
			// 백틱 펜스는 정보문자열에 백틱을 못 쓴다 (인라인 코드와 구분되지 않으므로)
			if (m && !(m[1][0] === "`" && m[2].includes("`"))) {
				open = m[1];
				mask[i] = true;
			}
			continue;
		}

		mask[i] = true;
		// 닫는 펜스 = 같은 문자, 길이 이상, 뒤에 아무것도 없음
		if (m && m[1][0] === open[0] && m[1].length >= open.length && !m[2].trim()) {
			open = "";
		}
	}
	return mask;
}

/** frontmatter 를 건너뛴 첫 줄. YAML 안의 `# 주석`을 헤딩으로 보지 않기 위한 것. */
function bodyStart(lines: string[]): number {
	if (lines[0]?.trim() !== "---") return 0;
	for (let i = 1; i < lines.length; i++) {
		const t = lines[i].trim();
		if (t === "---" || t === "...") return i + 1;
	}
	// 닫히지 않았으면 frontmatter 가 아니다 — 본문으로 본다
	return 0;
}

/**
 * 넣을 줄 번호. 헤딩을 못 찾으면 null — 아무것도 고치지 않는다는 뜻이다.
 * 엉뚱한 자리에 쓰느니 안 쓰는 게 낫다.
 *
 * atTop  = 헤딩 바로 밑 (빈 줄은 건너뛴다)
 * 그 외  = 헤딩 직속 본문의 **마지막 목록 항목** 뒤. 목록 다음에 산문이 있어도 목록에
 *          붙는다. 목록이 하나도 없으면 본문 끝(빈 줄 되감기)으로 폴백한다.
 */
export function findInsertIndex(
	lines: string[],
	heading: string,
	level: number,
	atTop: boolean
): number | null {
	if (!heading) return null;

	const code = codeMask(lines);
	const start = bodyStart(lines);

	let hIdx = -1;
	for (let i = start; i < lines.length; i++) {
		if (code[i]) continue;
		const m = lines[i].match(HEADING);
		if (!m || m[2] !== heading) continue;
		// level 0 = 설정에 레벨이 없던 시절의 규칙. 텍스트만으로 맞춘다.
		if (level && m[1].length !== level) continue;
		hIdx = i;
		break;
	}
	if (hIdx < 0) return null;

	// 이 헤딩의 **직속 본문** = 다음 헤딩 전까지. 레벨을 따지지 않는다.
	// 하위 헤딩까지 범위에 넣으면 "# Tasks" 를 골랐는데 그 아래 "## 완료" 안으로
	// 들어가 버린다 — 사용자가 고른 건 헤딩 하나지 그 밑의 다른 바구니가 아니다.
	let end = lines.length;
	for (let i = hIdx + 1; i < lines.length; i++) {
		if (!code[i] && HEADING.test(lines[i])) {
			end = i;
			break;
		}
	}

	if (atTop) {
		let at = hIdx + 1;
		while (at < end && lines[at].trim() === "") at++;
		return at;
	}

	// 마지막 목록 항목. 목록 중간에 빈 줄이 껴 있어도(Temp Tasks 가 실제로 그렇다)
	// 끝까지 훑으므로 첫 덩어리에서 멈추지 않는다.
	let last = -1;
	for (let i = hIdx + 1; i < end; i++) {
		if (!code[i] && LIST_ITEM.test(lines[i])) last = i;
	}

	if (last >= 0) {
		// 그 항목에 딸린 들여쓴 이어짐 줄까지 넘긴다
		let at = last + 1;
		while (at < end && !code[at] && /^\s+\S/.test(lines[at])) at++;
		return at;
	}

	let at = end;
	while (at > hIdx + 1 && lines[at - 1].trim() === "") at--;
	return at;
}
