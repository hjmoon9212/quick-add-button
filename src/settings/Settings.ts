export interface TaskDefaults {
	/** "" | "today" | "tomorrow" | "+7" */
	due: string;
	start: string;
	/** Tasks 우선순위 이모지. "" = 보통 */
	priority: string;
	created: boolean;
	id: boolean;
	/** 헤딩 아래 어디에 넣을지. "end" = 섹션 끝, "top" = 헤딩 바로 밑 */
	position: "end" | "top";
}

/** 버튼 하나 = 규칙 하나. 넣을 자리와 태그가 버튼에 고정된다. */
export interface RuleDef {
	/** 코드블록에서 부르는 이름 */
	name: string;
	/** 버튼에 찍히는 글자 */
	label: string;
	enabled: boolean;
	/** 삽입할 노트의 볼트 경로 */
	file: string;
	/** 삽입할 헤딩 텍스트 */
	heading: string;
	/** 헤딩 레벨(1~6). 같은 이름의 헤딩이 여러 개일 때 구분한다 */
	level: number;
	/** 이 버튼이 쓰는 태그. 여러 개면 폼에서 고른다. 첫 번째가 기본 */
	tags: string[];
	defaults: TaskDefaults;
}

export interface QuickAddButtonSettings {
	version: number;
	rules: RuleDef[];
}

export const DEFAULT_TASK_DEFAULTS: TaskDefaults = {
	due: "today",
	start: "",
	priority: "",
	created: true,
	id: true,
	position: "end",
};

export const DEFAULT_SETTINGS: QuickAddButtonSettings = {
	version: 5,
	rules: [
		{
			name: "TempTask",
			label: "⚡ 임시 할일",
			enabled: true,
			file: "0. Note/0. Inbox/Temp Tasks.md",
			heading: "Quick Add",
			level: 1,
			tags: ["#task"],
			defaults: { ...DEFAULT_TASK_DEFAULTS },
		},
	],
};

/** 새 규칙의 초기값. */
export function blankRule(): RuleDef {
	return {
		name: "",
		label: "",
		enabled: true,
		file: "",
		heading: "",
		level: 0,
		tags: ["#task"],
		defaults: { ...DEFAULT_TASK_DEFAULTS },
	};
}
