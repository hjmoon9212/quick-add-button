/** 로컬 기준 오늘 (YYYY-MM-DD). UTC 로 찍으면 아침/저녁에 하루가 어긋난다. */
export function todayISO(): string {
	const d = new Date();
	const p = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** ISO 날짜에 일수를 더한다. 달/해 경계는 Date 가 처리하게 둔다. */
export function addDays(iso: string, n: number): string {
	const [y, m, d] = iso.split("-").map(Number);
	const dt = new Date(y, m - 1, d);
	dt.setDate(dt.getDate() + n);
	const p = (x: number) => String(x).padStart(2, "0");
	return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/** 설정의 기본 날짜 토큰("today" | "tomorrow" | "+7" | "")을 실제 날짜로. */
export function resolveDateToken(token: string): string {
	const today = todayISO();
	switch (token) {
		case "today":
			return today;
		case "tomorrow":
			return addDays(today, 1);
		case "+7":
			return addDays(today, 7);
		default:
			return "";
	}
}
