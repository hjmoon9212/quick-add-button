/** 할일을 넣을 자리 한 곳. */
export interface TaskTarget {
	/**
	 * 볼트 절대경로 | "@current"(버튼이 있는 노트) | "@folder/…"(버튼이 있는 노트의
	 * 폴더 기준 상대경로)
	 */
	file: string;
	/** 삽입할 헤딩 텍스트. "" 이면 파일 맨 끝에 넣는다 */
	heading?: string;
	/** 헤딩 레벨(1~6). 0/미지정이면 텍스트만으로 매칭 */
	level?: number;
	/** "h1-h3" → 클릭 시점에 그 파일의 H1~H3 를 드롭다운으로 펼친다 */
	headings?: "h1-h3";
	/** 드롭다운 표시 라벨. 없으면 파일명 + 헤딩으로 자동 생성 */
	label?: string;
	/** 대상 파일이 없을 때 이 템플릿을 복사해 만든다 */
	createFrom?: string;
}

export interface TaskDefaults {
	tag: string;
	/** "" | "today" | "tomorrow" | "+7" */
	due: string;
	start: string;
	/** Tasks 우선순위 이모지. "" = 보통 */
	priority: string;
	created: boolean;
	id: boolean;
	/** "end" = 섹션 끝, "top" = 섹션 맨 위 */
	position: "end" | "top";
}

/** 버튼 하나 = 규칙 하나. */
export interface RuleDef {
	/** 코드블록에서 부르는 이름 */
	name: string;
	/** 버튼에 찍히는 글자 */
	label: string;
	enabled: boolean;
	targets: TaskTarget[];
	defaults: TaskDefaults;
}

export interface QuickAddButtonSettings {
	version: number;
	/** 폼의 태그 드롭다운 후보 */
	taskTags: string[];
	rules: RuleDef[];
}

export const DEFAULT_TASK_DEFAULTS: TaskDefaults = {
	tag: "#task",
	due: "today",
	start: "",
	priority: "",
	created: true,
	id: false,
	position: "end",
};

export const DEFAULT_SETTINGS: QuickAddButtonSettings = {
	version: 1,
	taskTags: ["#task", "#task/ISSUE", "#task/Deploy"],
	rules: [
		{
			name: "TempTask",
			label: "⚡ 임시 할일",
			enabled: true,
			targets: [
				{
					file: "0. Note/0. Inbox/Temp Tasks.md",
					heading: "Quick Add",
					level: 1,
					label: "임시(Inbox)",
				},
				{ file: "@current", headings: "h1-h3", label: "현재 노트" },
			],
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
		targets: [{ file: "@current", headings: "h1-h3", label: "현재 노트" }],
		defaults: { ...DEFAULT_TASK_DEFAULTS },
	};
}
