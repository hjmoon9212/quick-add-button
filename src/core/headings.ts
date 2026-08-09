import { App, TFile } from "obsidian";

export interface HeadingOption {
	heading: string;
	level: number;
}

/**
 * 파일의 헤딩 목록. 삽입 로직과 같은 규칙으로 **코드펜스 안은 뺀다** — 규칙 편집
 * 드롭다운과 설정탭 경고와 실제 삽입이 같은 것을 헤딩으로 봐야 한다.
 */
export function headingsOf(app: App, file: TFile): HeadingOption[] {
	const cache = app.metadataCache.getFileCache(file);
	if (!cache) return [];

	const fences = (cache.sections ?? [])
		.filter((s) => s.type === "code")
		.map((s) => [s.position.start.line, s.position.end.line] as const);

	return (cache.headings ?? [])
		.filter(
			(h) =>
				!fences.some(
					([a, b]) => h.position.start.line >= a && h.position.start.line <= b
				)
		)
		.map((h) => ({ heading: h.heading, level: h.level }));
}

/** 규칙이 가리키는 헤딩이 실제로 있는지. level 0 이면 이름만 본다. */
export function hasHeading(
	options: HeadingOption[],
	heading: string,
	level: number
): boolean {
	return options.some((h) => h.heading === heading && (!level || h.level === level));
}
